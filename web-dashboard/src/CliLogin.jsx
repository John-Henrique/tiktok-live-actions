import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './index.css';

export default function CliLogin() {
  const [searchParams] = useSearchParams();
  const session = searchParams.get('session');
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      if (session) {
        navigate(`/login?session=${session}`);
      } else {
        navigate('/login');
      }
    }
  }, [navigate, session]);

  const handleAuthorize = async () => {
    setStatus('authorizing');
    const token = localStorage.getItem('token');
    
    try {
      const res = await fetch('http://localhost:3001/api/auth/cli-authorize', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ session })
      });
      
      const data = await res.json();
      if (data.success) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  if (!session) {
    return (
      <div className="auth-page">
        <div className="auth-split" style={{justifyContent: 'center', alignItems: 'center', flexDirection: 'column', textAlign: 'center'}}>
          <h2>Link Inválido</h2>
          <p>Nenhuma sessão foi informada na URL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-split" style={{maxWidth: '600px', display: 'flex', flexDirection: 'column'}}>
        <div className="auth-info" style={{padding: '2rem', textAlign: 'center', background: 'radial-gradient(circle at top, rgba(0, 229, 143, 0.15), transparent 70%)'}}>
          <div className="auth-logo" style={{marginBottom: '1rem'}}>TikTok Live <span>Actions</span></div>
          <h2>Conectar Dispositivo</h2>
          <p style={{marginBottom: 0}}>Você está prestes a autorizar o motor local (Desktop CLI) a se conectar com sua conta.</p>
        </div>
        
        <div className="auth-form-container" style={{padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'}}>
          
          {status === 'idle' && (
            <>
              <div style={{fontSize: '4rem', marginBottom: '1.5rem'}}>💻</div>
              <h3 style={{marginBottom: '0.5rem', color: '#fff'}}>Terminal detectado</h3>
              <p style={{color: '#8b949e', marginBottom: '2rem'}}>
                Ao clicar em autorizar, o seu terminal aberto receberá acesso automático às configurações da sua conta e iniciará a comunicação com a live.
              </p>
              <button className="btn-primary-large" onClick={handleAuthorize} style={{width: '100%'}}>
                ✅ Autorizar Conexão
              </button>
            </>
          )}

          {status === 'authorizing' && (
            <>
              <div style={{fontSize: '3rem', marginBottom: '1.5rem'}} className="status-dot"></div>
              <h3 style={{color: '#fff'}}>Autorizando...</h3>
              <p style={{color: '#8b949e'}}>Enviando chaves para o terminal local.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{fontSize: '4rem', marginBottom: '1.5rem'}}>🎉</div>
              <h3 style={{color: '#00E58F'}}>Autorizado com Sucesso!</h3>
              <p style={{color: '#8b949e'}}>
                O seu terminal já deve estar conectado. Você já pode fechar esta aba e voltar para o aplicativo no computador.
              </p>
              <button className="btn-secondary" onClick={() => navigate('/dashboard')} style={{marginTop: '1rem'}}>
                Ir para o Painel
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{fontSize: '4rem', marginBottom: '1.5rem'}}>❌</div>
              <h3 style={{color: '#ff7b72'}}>Erro na autorização</h3>
              <p style={{color: '#8b949e'}}>A sessão pode ter expirado ou o servidor está offline.</p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
