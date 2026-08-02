import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import config from './config';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const response = await fetch(`${config.API_URL}/api/admin/stats`, {
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

  const handleAddTrial = async (userId) => {
    const minutes = prompt('Quantos minutos de trial deseja adicionar?');
    if (!minutes || isNaN(minutes)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${config.API_URL}/api/admin/add-trial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, minutes: parseInt(minutes) })
      });

      if (response.ok) {
        alert('Tempo adicionado com sucesso!');
        const refreshResponse = await fetch(`${config.API_URL}/api/admin/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (refreshResponse.ok) {
          setStats(await refreshResponse.json());
        }
      } else {
        alert('Falha ao adicionar tempo.');
      }
    } catch (err) {
      alert('Erro na requisição: ' + err.message);
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
                    <button className="btn-small btn-action" onClick={() => handleAddTrial(user.id)}>
                      + Tempo de Trial
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
