import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from './config';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = searchParams.get('session');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('${API_BASE_URL}/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (session) {
          navigate(`/cli-login?session=${session}`);
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-split">
        
        {/* Left Side: Info */}
        <div className="auth-info">
          <Link to="/" className="auth-logo">TikTok Live <span>Actions</span></Link>
          <div className="auth-instructions">
            <h2>Bem-vindo de volta!</h2>
            <p>Faça login para acessar o seu painel de controle e conectar sua live.</p>
            
            <div className="info-card">
              <div className="info-icon">🎮</div>
              <div>
                <h4>Controle total</h4>
                <p>Edite suas regras de presentes a qualquer momento durante a live.</p>
              </div>
            </div>
            
            <div className="info-card">
              <div className="info-icon">⚡</div>
              <div>
                <h4>Conexão instantânea</h4>
                <p>Nosso motor processa eventos em tempo real, sem atrasos.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="auth-form-container">
          <div className="auth-form-box">
            <h2>Entrar na sua conta</h2>
            <p className="auth-subtitle">Preencha seus dados para continuar</p>
            
            {error && <div className="auth-error">{error}</div>}
            
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label>Email</label>
                <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Senha</label>
                <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn-primary-large" style={{width: '100%', marginTop: '1rem'}}>
                Entrar no Painel
              </button>
            </form>
            
            <p className="auth-link">
              Não tem uma conta? <Link to={`/register${session ? `?session=${session}` : ''}`}>Crie uma grátis</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
