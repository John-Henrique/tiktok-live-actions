import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from './config';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = searchParams.get('session');

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('${API_BASE_URL}/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        if (session) {
          navigate(`/login?session=${session}`);
        } else {
          navigate('/login');
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
            <h2>Crie sua conta e comece agora!</h2>
            <p>Junte-se a criadores de conteúdo que já monetizam suas lives com interações automáticas.</p>
            
            <div className="info-card">
              <div className="info-icon">🎁</div>
              <div>
                <h4>Plano Trial Gratuito</h4>
                <p>Use por 1 hora completa na sua primeira live para ver a mágica acontecer antes de decidir.</p>
              </div>
            </div>
            
            <div className="info-card">
              <div className="info-icon">🔒</div>
              <div>
                <h4>Segurança em 1º lugar</h4>
                <p>Nós nunca pediremos a senha do seu TikTok. Apenas precisamos do seu @usuário para ler o chat público.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="auth-form-container">
          <div className="auth-form-box">
            <h2>Criar Conta</h2>
            <p className="auth-subtitle">Preencha seus dados para começar seu Trial</p>
            
            {error && <div className="auth-error">{error}</div>}
            
            <form onSubmit={handleRegister}>
              <div className="input-group">
                <label>Email</label>
                <input type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="input-group">
                <label>Senha</label>
                <input type="password" placeholder="Mínimo de 6 caracteres" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn-primary-large" style={{width: '100%', marginTop: '1rem'}}>
                Criar minha conta
              </button>
            </form>
            
            <p className="auth-link">
              Já tem uma conta? <Link to={`/login${session ? `?session=${session}` : ''}`}>Fazer Login</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
