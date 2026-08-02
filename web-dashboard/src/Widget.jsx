import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { API_BASE_URL } from './config';
import './widget.css';

const SOCKET_URL = API_BASE_URL;
const GIFTS_API = `${API_BASE_URL}/api/available-gifts`;

const widgetCooldowns = new Map();
const COOLDOWN_MS = 3000;

export default function Widget() {
  const [events, setEvents] = useState([]);
  const [availableGifts, setAvailableGifts] = useState([]);

  const searchParams = new URLSearchParams(window.location.search);
  const showChat = searchParams.get('modo') === 'tudo';
  const showGifts = searchParams.get('modo') === 'presentes' || searchParams.get('modo') === 'tudo' || !searchParams.has('modo');
  const token = searchParams.get('token');

  const [userRules, setUserRules] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeSound, setActiveSound] = useState(null);

  useEffect(() => {
    // Força o fundo transparente apenas enquanto este componente estiver montado (para o OBS)
    document.body.style.background = 'transparent';

    // Busca a lista de presentes para puxar as imagens oficiais do motor
    fetch(GIFTS_API)
      .then(res => res.json())
      .then(data => setAvailableGifts(data))
      .catch(console.error);

    if (!token) {
      console.error('Widget requer um token de autenticação na URL');
      return;
    }

    // Fetch user rules
    fetch(`${API_BASE_URL}/api/rules`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
         if (data.rules && Array.isArray(data.rules)) {
            setUserRules(data.rules);
         } else if (data.rules) {
            // Backward comp
            const arr = Object.keys(data.rules).map(k => ({
              triggerType: 'gift', triggerValue: k, actionType: 'keypress', actionValue: data.rules[k]
            }));
            setUserRules(arr);
         }
      })
      .catch(console.error);

    const socket = io(SOCKET_URL, {
      auth: { token }
    });
    
    // Listen for rules updates in real time
    socket.on('rules-updated', (rules) => {
        if (Array.isArray(rules)) setUserRules(rules);
    });

    const processMediaRule = (type, value) => {
      // Use the latest state of userRules using a functional state approach or ref
      // Since useEffect closes over userRules, we need to pass rules down or handle it properly.
      // Wait, we can't reliably read `userRules` from the closure without adding it to dependencies (which resets sockets).
      // We'll use a local variable inside the effect? No, we need it dynamic.
    };

    if (showChat) {
      socket.on('chat', (data) => {
        addEvent({
          id: Math.random().toString(36).substr(2, 9),
          type: 'chat',
          username: data.uniqueId,
          comment: data.comment,
        });
      });
    }

    if (showGifts) {
      socket.on('gift-received', (data) => {
        addEvent({
          id: Math.random().toString(36).substr(2, 9),
          type: 'gift',
          username: data.username,
          giftName: data.giftName,
          repeatCount: data.repeatCount,
        });
        evaluateAndPlayMedia('gift', data.giftName);
      });
      
      socket.on('follow', (data) => {
         evaluateAndPlayMedia('follow', 'Novo Seguidor');
      });
      socket.on('like', (data) => {
         evaluateAndPlayMedia('like', 'Curtida');
      });
      socket.on('share', (data) => {
         evaluateAndPlayMedia('share', 'Compartilhamento');
      });
    }

    return () => {
      socket.disconnect();
      document.body.style.background = '';
    };
  }, [showChat, showGifts]);

  const addEvent = (event) => {
    setEvents(prev => {
      const newEvents = [...prev, event];
      // Mantém apenas os últimos 50 eventos para não pesar o OBS
      if (newEvents.length > 50) return newEvents.slice(newEvents.length - 50);
      return newEvents;
    });
  };

  const getGiftImageUrl = (giftName) => {
    const gift = availableGifts.find(g => g.name.toLowerCase() === giftName.toLowerCase());
    return gift ? gift.url : 'https://ui-avatars.com/api/?name=?&background=transparent&color=fff';
  };

  const evaluateAndPlayMedia = (type, value) => {
     setUserRules(currentRules => {
        const matched = currentRules.filter(r => 
           r.triggerType === type && r.triggerValue && r.triggerValue.toLowerCase() === value.toLowerCase()
        );
        matched.forEach(rule => {
           const cooldownKey = `rule_${rule.id}`;
           const now = Date.now();
           if (widgetCooldowns.has(cooldownKey) && (now - widgetCooldowns.get(cooldownKey) < COOLDOWN_MS)) {
               return; // Cooldown ativo, não repete a mídia
           }
           widgetCooldowns.set(cooldownKey, now);

           if (rule.actionVideo) {
               setActiveVideo({ url: rule.actionVideo, id: Math.random() });
           }
           if (rule.actionSound) {
               setActiveSound({ url: rule.actionSound, id: Math.random() });
           }
        });
        return currentRules;
     });
  };

  return (
    <div className="obs-widget-container">
      <div className="event-list">
        {events.map(event => (
          <div key={event.id} className={`event-card slide-in ${event.type}`}>
            {event.type === 'gift' ? (
              <div className="gift-alert">
                <img src={getGiftImageUrl(event.giftName)} alt={event.giftName} className="gift-img-large" />
                <div className="gift-info">
                  <span className="username">@{event.username}</span>
                  <span className="action-text">enviou {event.giftName}</span>
                  {event.repeatCount > 1 && <span className="combo-text">x{event.repeatCount}</span>}
                </div>
              </div>
            ) : (
              <div className="chat-message">
                <span className="username">@{event.username}:</span>
                <span className="comment">{event.comment}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {activeVideo && (
         <div key={activeVideo.id} style={{ position: 'fixed', top: '10%', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
            <video 
               src={activeVideo.url} 
               autoPlay 
               onEnded={() => setActiveVideo(null)}
               style={{ maxWidth: '80vw', maxHeight: '80vh', borderRadius: '16px' }}
            />
         </div>
      )}

      {activeSound && (
         <audio 
            key={activeSound.id}
            src={activeSound.url} 
            autoPlay 
            onEnded={() => setActiveSound(null)} 
         />
      )}
    </div>
  );
}
