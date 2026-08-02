import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Landing() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    { q: "Como funciona a integração?", a: "Nosso motor se conecta diretamente à sua live do TikTok. Quando alguém envia um presente ou segue, ele simula a tecla configurada no seu teclado instantaneamente." },
    { q: "Quais jogos são compatíveis?", a: "Qualquer jogo! Como simulamos teclas do teclado, funciona no GTA V, Minecraft, Roblox, Valorant, e até mesmo no seu OBS Studio para trocar de cena." },
    { q: "Existe risco de banimento?", a: "Não. Nosso software apenas lê o chat público do TikTok e simula teclas localmente no seu PC. Não injetamos nada nos jogos." },
    { q: "Como funciona o teste grátis?", a: "Você cria sua conta e pode usar 100% das funções por 1 live inteira (limite de 1 hora). Sem precisar colocar cartão de crédito." }
  ];

  return (
    <div className="landing-page">
      <nav className="navbar">
        <div className="nav-logo">TikTok Live <span>Actions</span></div>
        <div className="nav-links">
          <a href="#features">Recursos</a>
          <a href="#pricing">Planos</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-actions">
          <a href="/TikTokLiveActions.zip" download className="btn-login" style={{textDecoration: 'none', marginRight: '1rem', border: '1px solid rgba(255,255,255,0.2)'}}>Baixar Cliente</a>
          <button className="btn-login" onClick={() => navigate('/login')}>Entrar</button>
          <button className="btn-signup" onClick={() => navigate('/register')}>Começar Grátis</button>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-content">
          <h1>Transforme <span className="highlight">Presentes</span> em eventos no seu Jogo</h1>
          <p>
            Vincule presentes, likes e novos seguidores do TikTok Live a ações reais 
            no GTA V, Minecraft, Roblox e qualquer outro jogo. Engajamento no nível máximo.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary-large" onClick={() => navigate('/register')}>
              Criar conta grátis
            </button>
            <button className="btn-secondary-large" onClick={() => document.getElementById('steps').scrollIntoView()}>
              Ver como funciona
            </button>
          </div>
        </div>
      </section>

      <section id="steps" className="steps-section">
        <h2>Três passos simples para a <span className="highlight">mágica</span> acontecer.</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <h3>Conecte sua conta</h3>
            <p>Faça login e informe o seu @ de usuário do TikTok. Não pedimos sua senha da rede social.</p>
          </div>
          <div className="step-card">
            <div className="step-number">02</div>
            <h3>Crie suas Regras</h3>
            <p>Exemplo: "Se mandar 1 Rosa, apertar a tecla G". Você mapeia os presentes para as ações do seu jogo.</p>
          </div>
          <div className="step-card">
            <div className="step-number">03</div>
            <h3>Abra a Live</h3>
            <p>Deixe o nosso Motor rodando em segundo plano e veja a chuva de presentes acontecer no seu game.</p>
          </div>
        </div>
      </section>

      <section className="games-section">
        <h2>Compatível com <span className="highlight">qualquer</span> jogo</h2>
        <p>Como simulamos teclas diretamente no sistema operacional, a imaginação é o limite.</p>
        <div className="games-grid">
          <div className="game-card">
            <img src="https://images.unsplash.com/photo-1605901309584-818e25960b8f?auto=format&fit=crop&q=80&w=400&h=200" alt="Minecraft" />
            <div className="game-info">
              <h3>Minecraft</h3>
              <p>Dropar itens, spawnar monstros ou ativar TNT.</p>
            </div>
          </div>
          <div className="game-card">
            <img src="https://images.unsplash.com/photo-1604085572504-a392ddf0d86a?auto=format&fit=crop&q=80&w=400&h=200" alt="GTA V" />
            <div className="game-info">
              <h3>GTA V</h3>
              <p>Acionar mods, spawnar carros, explodir o jogador.</p>
            </div>
          </div>
          <div className="game-card">
            <img src="https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400&h=200" alt="OBS" />
            <div className="game-info">
              <h3>OBS Studio</h3>
              <p>Trocar cenas, tocar sons e ativar filtros na live.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="pricing" className="pricing-section">
        <h2>Escolha o plano para a sua <span className="highlight">Live</span></h2>
        <div className="pricing-grid">
          <div className="price-card">
            <h3>Trial</h3>
            <div className="price">R$ 0<span>/live</span></div>
            <p>Para você testar a ferramenta na prática.</p>
            <ul>
              <li>✓ 1 Conexão Simultânea</li>
              <li>✓ Limite de 1 hora de live</li>
              <li>✓ Todas as regras liberadas</li>
            </ul>
            <button className="btn-plan-ghost" onClick={() => navigate('/register')}>Testar Agora</button>
          </div>

          <div className="price-card popular">
            <div className="badge">MAIS POPULAR</div>
            <h3>Pro</h3>
            <div className="price">R$ 20<span>/mês</span></div>
            <p>O plano ideal para criadores de conteúdo.</p>
            <ul>
              <li>✓ Tempo Ilimitado de Live</li>
              <li>✓ Suporte Prioritário</li>
              <li>✓ Widget Exclusivo para OBS</li>
              <li>✓ Atualizações gratuitas</li>
            </ul>
            <button className="btn-plan-primary" onClick={() => navigate('/register')}>Assinar Pro</button>
          </div>
        </div>
      </section>

      <section id="faq" className="faq-section">
        <h2>Perguntas Frequentes</h2>
        <div className="faq-container">
          {faqs.map((faq, index) => (
            <div className={`faq-item ${openFaq === index ? 'open' : ''}`} key={index} onClick={() => toggleFaq(index)}>
              <div className="faq-question">
                {faq.q}
                <span className="faq-icon">{openFaq === index ? '−' : '+'}</span>
              </div>
              <div className="faq-answer">
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <div className="footer-content">
          <div className="footer-brand">
            TikTok Live Actions ⚡
            <p>© 2026 Todos os direitos reservados.</p>
          </div>
          <div className="footer-links">
            <a href="#">Termos de Uso</a>
            <a href="#">Privacidade</a>
            <a href="#">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
