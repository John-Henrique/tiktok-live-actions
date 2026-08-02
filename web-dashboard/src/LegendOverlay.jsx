import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { API_BASE_URL } from './config';
import './index.css';

const LegendOverlay = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const style = searchParams.get('style') || 'vertical';
  
  const [rules, setRules] = useState([]);
  const [gifts, setGifts] = useState([]);

  useEffect(() => {
    // Add transparent background to body for OBS
    document.body.style.backgroundColor = 'transparent';
    document.body.style.overflow = 'hidden'; // Evita barras de rolagem no OBS
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.overflow = '';
    };
  }, []);

  const fetchData = async () => {
    try {
      if (!token) return;
      
      const giftsRes = await fetch(`${API_BASE_URL}/api/available-gifts`);
      const giftsData = await giftsRes.json();
      setGifts(giftsData);

      const rulesRes = await fetch(`${API_BASE_URL}/api/rules`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const rulesData = await rulesRes.json();
      setRules(rulesData);
    } catch (e) {
      console.error('Erro ao carregar dados da legenda:', e);
    }
  };

  useEffect(() => {
    fetchData();
    
    if (!token) return;
    
    // Conecta via WebSocket usando o token para atualizações em tempo real
    const socket = io(API_BASE_URL, {
      auth: { token }
    });
    
    // Escuta quando as regras são salvas no banco de dados e recarrega instantaneamente
    socket.on('rules-updated', (newRules) => {
        if (Array.isArray(newRules)) setRules(newRules);
        else fetchData(); // Se o formato não vier perfeito, puxa via API
    });
    
    return () => {
        socket.disconnect();
    };
  }, [token]);

  // Se não houver token ou regras, não renderiza nada para ficar invisível no OBS
  if (!token || rules.length === 0) return null;

  return (
    <div className={`legend-overlay-container ${style}`}>
      <div className="legend-title">MENU DE PRESENTES</div>
      <div className="legend-list">
        {rules.map((rule, idx) => {
          const giftInfo = gifts.find(g => g.name === rule.giftId);
          if (!giftInfo) return null;
          
          let actionText = '';
          if (rule.type === 'key') actionText = `Aperta ${rule.key}`;
          if (rule.type === 'sound') actionText = 'Toca Som';
          if (rule.type === 'video') actionText = 'Toca Vídeo';

          return (
            <div key={idx} className="legend-item glassmorphism">
              <img src={giftInfo.url} alt={giftInfo.name} className="legend-gift-icon" />
              <div className="legend-gift-details">
                <span className="legend-gift-name">{giftInfo.name}</span>
                <span className="legend-gift-action">{actionText}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LegendOverlay;
