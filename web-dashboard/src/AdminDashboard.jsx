import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { API_BASE_URL } from './config';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const activeTab = pathParts[2] || 'overview';

  // Modal & Toast states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUserId, setModalUserId] = useState(null);
  const [modalMinutes, setModalMinutes] = useState('60');
  const [toastMsg, setToastMsg] = useState(null);

  // General Stats
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Filters Date Defaults (Current Month)
  const now = new Date();
  const defaultStartDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const defaultEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  // Users State
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit] = useState(10);
  const [usersStatus, setUsersStatus] = useState('all');
  const [usersStart, setUsersStart] = useState(defaultStartDate);
  const [usersEnd, setUsersEnd] = useState(defaultEndDate);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Payments State
  const [payments, setPayments] = useState([]);
  const [paymentsTotal, setPaymentsTotal] = useState(0);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsLimit] = useState(10);
  const [paymentsStatus, setPaymentsStatus] = useState('all');
  const [paymentsStart, setPaymentsStart] = useState(defaultStartDate);
  const [paymentsEnd, setPaymentsEnd] = useState(defaultEndDate);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Subscriptions State
  const [subscriptions, setSubscriptions] = useState([]);
  const [subsTotal, setSubsTotal] = useState(0);
  const [subsPage, setSubsPage] = useState(1);
  const [subsLimit] = useState(10);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const getToken = () => localStorage.getItem('token');

  // Fetch Overview Stats
  useEffect(() => {
    const fetchStats = async () => {
      const token = getToken();
      if (!token) return navigate('/login');
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) {
          if (res.status === 403) navigate('/dashboard');
          return;
        }
        setStats(await res.json());
      } catch (e) {} finally { setLoadingStats(false); }
    };
    if (activeTab === 'overview') fetchStats();
  }, [activeTab, navigate]);

  // Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users?page=${usersPage}&limit=${usersLimit}&status=${usersStatus}&startDate=${usersStart}&endDate=${usersEnd}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        setUsersTotal(data.total);
      }
    } catch (e) {} finally { setLoadingUsers(false); }
  }, [usersPage, usersLimit, usersStatus, usersStart, usersEnd]);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
  }, [activeTab, fetchUsers]);

  // Fetch Payments
  const fetchPayments = useCallback(async () => {
    setLoadingPayments(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/payments?page=${paymentsPage}&limit=${paymentsLimit}&status=${paymentsStatus}&startDate=${paymentsStart}&endDate=${paymentsEnd}`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments);
        setPaymentsTotal(data.total);
      }
    } catch (e) {} finally { setLoadingPayments(false); }
  }, [paymentsPage, paymentsLimit, paymentsStatus, paymentsStart, paymentsEnd]);

  useEffect(() => {
    if (activeTab === 'finance') fetchPayments();
  }, [activeTab, fetchPayments]);

  // Fetch Subscriptions (Users with PRO status)
  const fetchSubscriptions = useCallback(async () => {
    setLoadingSubs(true);
    try {
      // Reusing users endpoint but locking status=pro
      const res = await fetch(`${API_BASE_URL}/api/admin/users?page=${subsPage}&limit=${subsLimit}&status=pro`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data.users);
        setSubsTotal(data.total);
      }
    } catch (e) {} finally { setLoadingSubs(false); }
  }, [subsPage, subsLimit]);

  useEffect(() => {
    if (activeTab === 'subscriptions') fetchSubscriptions();
  }, [activeTab, fetchSubscriptions]);

  const submitAddTrial = async () => {
    if (!modalMinutes || isNaN(modalMinutes)) return;
    setModalOpen(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/add-trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
        body: JSON.stringify({ userId: modalUserId, minutes: parseInt(modalMinutes) })
      });
      if (res.ok) {
        showToast('Tempo adicionado com sucesso!', 'success');
        if (activeTab === 'users') fetchUsers();
      } else {
        showToast('Falha ao adicionar tempo.', 'error');
      }
    } catch (err) {
      showToast('Erro na requisição: ' + err.message, 'error');
    }
  };

  const renderPagination = (page, total, limit, setPage) => {
    const totalPages = Math.ceil(total / limit) || 1;
    if (totalPages <= 1) return null;
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
        <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button>
        <span style={{color: '#fff'}}>Página {page} de {totalPages}</span>
        <button className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Próxima</button>
      </div>
    );
  };

  const renderOverview = () => {
    if (loadingStats) return <div className="loading-screen">Carregando painel admin...</div>;
    if (!stats) return null;
    
    const monthlyData = (stats.chartData || []).reduce((acc, user) => {
      const month = new Date(user.created_at).toLocaleString('pt-BR', { month: 'short' });
      const existing = acc.find(item => item.name === month);
      if (existing) {
        existing.usuarios++;
      } else {
        acc.push({ name: month, usuarios: 1 });
      }
      return acc;
    }, []);

    const liveData = (stats.liveHistory || []).map(entry => {
      const d = new Date(entry.time);
      return {
        name: `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`,
        conexões: entry.active_count
      };
    });

    return (
      <>
        <div className="admin-overview" style={{ marginTop: '2rem' }}>
          <div className="stat-card">
            <h3>Total de Usuários</h3>
            <p className="stat-value">{stats.totalUsers}</p>
          </div>
          <div className="stat-card">
            <h3>Contas Ativas (Pro)</h3>
            <p className="stat-value">{stats.activeAccounts}</p>
          </div>
          <div className="stat-card">
            <h3>Contas em Teste</h3>
            <p className="stat-value">{stats.trialAccounts}</p>
          </div>
          <div className="stat-card">
            <h3>Sessões Ativas</h3>
            <p className="stat-value">{stats.activeConnections}</p>
          </div>
          <div className="stat-card">
            <h3>Faturamento Total</h3>
            <p className="stat-value">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalRevenue)}</p>
          </div>
        </div>

        <div className="admin-charts" style={{ marginTop: '2rem' }}>
          <div className="chart-container">
            <h2>Crescimento de Usuários</h2>
            <div className="chart-wrapper" style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="name" stroke="#fff" />
                  <YAxis stroke="#fff" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
                  <Line type="monotone" dataKey="usuarios" stroke="#ff0050" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="chart-container" style={{ marginTop: '2rem' }}>
            <h2>Usuários Simultâneos em Live (Últimas 24h)</h2>
            <div className="chart-wrapper" style={{ height: '300px', width: '100%' }}>
              <ResponsiveContainer>
                <AreaChart data={liveData}>
                  <defs>
                    <linearGradient id="colorConexoes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00E58F" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#00E58F" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="name" stroke="#fff" />
                  <YAxis stroke="#fff" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333' }} />
                  <Area type="monotone" dataKey="conexões" stroke="#00E58F" fillOpacity={1} fill="url(#colorConexoes)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderUsers = () => (
    <div className="admin-users" style={{ marginTop: '2rem' }}>
      <h2>Gestão de Usuários</h2>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="input-group" style={{flex: 1}}>
          <label>Status</label>
          <select value={usersStatus} onChange={e => {setUsersStatus(e.target.value); setUsersPage(1);}}>
            <option value="all">Todos</option>
            <option value="pro">Pro</option>
            <option value="trial">Trial</option>
          </select>
        </div>
        <div className="input-group" style={{flex: 1}}>
          <label>Data Início</label>
          <input type="date" value={usersStart} onChange={e => {setUsersStart(e.target.value); setUsersPage(1);}} />
        </div>
        <div className="input-group" style={{flex: 1}}>
          <label>Data Fim</label>
          <input type="date" value={usersEnd} onChange={e => {setUsersEnd(e.target.value); setUsersPage(1);}} />
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Status</th>
              <th>Criado em</th>
              <th>Trial Usado (min)</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loadingUsers ? <tr><td colSpan="6" style={{textAlign:'center'}}>Carregando...</td></tr> : 
            users.length === 0 ? <tr><td colSpan="6" style={{textAlign:'center'}}>Nenhum usuário encontrado.</td></tr> :
            users.map(user => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`status-badge ${user.plan_status === 'free_trial' ? 'trial' : 'pro'}`}>
                    {user.plan_status === 'free_trial' ? 'Trial' : 'Pro'}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                <td>{Math.floor((user.trial_time_used || 0) / 60000)} min</td>
                <td>
                  <button className="btn-small btn-action" onClick={() => { setModalUserId(user.id); setModalMinutes('60'); setModalOpen(true); }}>
                    + Tempo de Trial
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loadingUsers && renderPagination(usersPage, usersTotal, usersLimit, setUsersPage)}
    </div>
  );

  const renderSubscriptions = () => (
    <div className="admin-users" style={{ marginTop: '2rem' }}>
      <h2>Assinaturas e Planos Pro</h2>
      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Usuário ID</th>
              <th>Email</th>
              <th>Status da Assinatura</th>
              <th>Expira em</th>
            </tr>
          </thead>
          <tbody>
            {loadingSubs ? <tr><td colSpan="4" style={{textAlign:'center'}}>Carregando...</td></tr> : 
            subscriptions.length === 0 ? <tr><td colSpan="4" style={{textAlign:'center'}}>Nenhuma assinatura encontrada.</td></tr> :
            subscriptions.map(user => {
              const expiresAt = user.pro_expires_at ? new Date(user.pro_expires_at) : null;
              const now = new Date();
              let statusColor = '#10b981';
              let statusText = 'Ativa';

              if (expiresAt) {
                const daysDiff = (expiresAt - now) / (1000 * 60 * 60 * 24);
                if (daysDiff < 0) {
                  statusColor = '#ef4444';
                  statusText = 'Vencida';
                } else if (daysDiff <= 7) {
                  statusColor = '#f59e0b';
                  statusText = 'A Vencer';
                }
              } else {
                statusText = 'Sem data de exp.';
              }

              return (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className="status-badge" style={{ backgroundColor: statusColor }}>
                      {statusText}
                    </span>
                  </td>
                  <td>{expiresAt ? expiresAt.toLocaleDateString('pt-BR') : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!loadingSubs && renderPagination(subsPage, subsTotal, subsLimit, setSubsPage)}
    </div>
  );

  const renderFinance = () => (
    <div className="admin-users" style={{ marginTop: '2rem' }}>
      <h2>Relatório Financeiro</h2>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="input-group" style={{flex: 1}}>
          <label>Status</label>
          <select value={paymentsStatus} onChange={e => {setPaymentsStatus(e.target.value); setPaymentsPage(1);}}>
            <option value="all">Todos</option>
            <option value="COMPLETED">Aprovado</option>
            <option value="PENDING">Pendente</option>
          </select>
        </div>
        <div className="input-group" style={{flex: 1}}>
          <label>Data Início</label>
          <input type="date" value={paymentsStart} onChange={e => {setPaymentsStart(e.target.value); setPaymentsPage(1);}} />
        </div>
        <div className="input-group" style={{flex: 1}}>
          <label>Data Fim</label>
          <input type="date" value={paymentsEnd} onChange={e => {setPaymentsEnd(e.target.value); setPaymentsPage(1);}} />
        </div>
      </div>

      <div className="table-responsive">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID Cobrança</th>
              <th>Usuário</th>
              <th>Status</th>
              <th>Valor (R$)</th>
              <th>Duração (Dias)</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>
            {loadingPayments ? <tr><td colSpan="6" style={{textAlign:'center'}}>Carregando...</td></tr> : 
            payments.length === 0 ? <tr><td colSpan="6" style={{textAlign:'center'}}>Nenhum pagamento encontrado.</td></tr> :
            payments.map(payment => (
              <tr key={payment.id}>
                <td>...{payment.charge_id.substring(payment.charge_id.length - 8)}</td>
                <td>{payment.email || `ID: ${payment.user_id}`}</td>
                <td>
                  <span className={`status-badge ${payment.status === 'COMPLETED' ? 'pro' : 'trial'}`}>
                    {payment.status}
                  </span>
                </td>
                <td>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount / 100)}</td>
                <td>{payment.plan_duration || 30}</td>
                <td>{new Date(payment.created_at).toLocaleDateString('pt-BR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loadingPayments && renderPagination(paymentsPage, paymentsTotal, paymentsLimit, setPaymentsPage)}
    </div>
  );

  return (
    <div className="saas-layout">
      <aside className="saas-sidebar">
        <div className="sidebar-logo">Painel <span>Admin</span></div>
        <div className="sidebar-menu">
          <div 
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => navigate('/admin/overview')}
          >
            <span className="icon">📊</span> Visão Geral
          </div>
          <div 
            className={`sidebar-item ${activeTab === 'finance' ? 'active' : ''}`}
            onClick={() => navigate('/admin/finance')}
          >
            <span className="icon">💰</span> Faturamento
          </div>
          <div 
            className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => navigate('/admin/users')}
          >
            <span className="icon">👥</span> Usuários
          </div>
          <div 
            className={`sidebar-item ${activeTab === 'subscriptions' ? 'active' : ''}`}
            onClick={() => navigate('/admin/subscriptions')}
          >
            <span className="icon">💎</span> Assinaturas
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <div 
              className="sidebar-item"
              onClick={() => navigate('/dashboard')}
              style={{ color: '#a1a1aa' }}
            >
              <span className="icon">🔙</span> Voltar ao App
            </div>
          </div>
        </div>
      </aside>

      <main className="saas-content" style={{ width: '100%' }}>
        <header className="saas-header">
          <h1>
            {activeTab === 'overview' && 'Visão Geral do Sistema'}
            {activeTab === 'users' && 'Gerenciamento de Contas'}
            {activeTab === 'subscriptions' && 'Controle de Assinaturas'}
            {activeTab === 'finance' && 'Faturamento e Pagamentos'}
          </h1>
        </header>

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'subscriptions' && renderSubscriptions()}
        {activeTab === 'finance' && renderFinance()}

        {modalOpen && (
          <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
          }}>
            <div className="modal-content" style={{
              background: '#18181b', border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '400px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.4rem' }}>Adicionar Tempo de Trial</h2>
              <p style={{ color: '#a1a1aa', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                Defina a quantidade de minutos extras de período gratuito para o usuário #{modalUserId}.
              </p>
              <div className="input-group">
                <label>Minutos (ex: 60 para 1 hora)</label>
                <input 
                  type="number" 
                  value={modalMinutes}
                  onChange={e => setModalMinutes(e.target.value)}
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setModalOpen(false)}>Cancelar</button>
                <button className="btn-primary" style={{ flex: 1 }} onClick={submitAddTrial}>Confirmar</button>
              </div>
            </div>
          </div>
        )}

        {toastMsg && (
          <div className={`toast-notification ${toastMsg.type}`} style={{
            position: 'fixed', bottom: '20px', right: '20px',
            background: toastMsg.type === 'success' ? '#10b981' : '#ef4444',
            color: '#fff', padding: '1rem 1.5rem', borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            zIndex: 1100, fontWeight: 'bold', animation: 'slideUp 0.3s ease-out'
          }}>
            {toastMsg.msg}
          </div>
        )}
      </main>
    </div>
  );
}
