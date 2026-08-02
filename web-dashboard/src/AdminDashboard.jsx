import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from './config';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal & Toast states
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUserId, setModalUserId] = useState(null);
  const [modalMinutes, setModalMinutes] = useState('60');
  const [toastMsg, setToastMsg] = useState(null);

  const navigate = useNavigate();

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          if (response.status === 403) {
            navigate('/dashboard');
          } else {
            throw new Error('Falha ao carregar estatísticas');
          }
        } else {
          const data = await response.json();
          setStats(data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [navigate]);

  const openTrialModal = (userId) => {
    setModalUserId(userId);
    setModalMinutes('60');
    setModalOpen(true);
  };

  const submitAddTrial = async () => {
    if (!modalMinutes || isNaN(modalMinutes)) return;
    setModalOpen(false);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/add-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: modalUserId, minutes: parseInt(modalMinutes) })
      });

      if (response.ok) {
        showToast('Tempo adicionado com sucesso!', 'success');
        const refreshResponse = await fetch(`${API_BASE_URL}/api/admin/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (refreshResponse.ok) {
          setStats(await refreshResponse.json());
        }
      } else {
        showToast('Falha ao adicionar tempo.', 'error');
      }
    } catch (err) {
      showToast('Erro na requisição: ' + err.message, 'error');
    }
  };

  if (loading) return <div className="loading-screen">Carregando painel admin...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (!stats) return null;

  const monthlyData = stats.users.reduce((acc, user) => {
    const month = new Date(user.created_at).toLocaleString('pt-BR', { month: 'short' });
    const existing = acc.find(item => item.name === month);
    if (existing) {
      existing.usuarios++;
    } else {
      acc.push({ name: month, usuarios: 1 });
    }
    return acc;
  }, []);

  return (
    <div className="admin-container">
      <header className="admin-header">
        <h1>Painel Administrativo</h1>
        <button onClick={() => navigate('/dashboard')} className="btn-secondary">Voltar ao App</button>
      </header>

      <div className="admin-overview">
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
          <p className="stat-value">R$ {stats.totalRevenue.toFixed(2)}</p>
        </div>
      </div>

      <div className="admin-charts">
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
      </div>

      <div className="admin-users">
        <h2>Gestão de Usuários</h2>
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Email</th>
                <th>Status</th>
                <th>Criado em</th>
                <th>Trial Usado (ms)</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {stats.users.map(user => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`status-badge ${user.plan_status === 'free_trial' ? 'trial' : 'pro'}`}>
                      {user.plan_status === 'free_trial' ? 'Trial' : 'Pro'}
                    </span>
                  </td>
                  <td>{new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                  <td>{user.trial_time_used} ms</td>
                  <td>
                    <button className="btn-small btn-action" onClick={() => openTrialModal(user.id)}>
                      + Tempo de Trial
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Modal for Trial Time */}
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

      {/* Modern Toast Notification */}
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
    </div>
  );
}
