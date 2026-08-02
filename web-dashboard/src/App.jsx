import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import Confetti from 'react-confetti';
import { io } from 'socket.io-client';
import { API_BASE_URL } from './config';
import './index.css';

const API_URL = `${API_BASE_URL}/api/rules`;
const GIFTS_API = `${API_BASE_URL}/api/available-gifts`;

// Custom Dropdown Component para suportar imagens
const CustomGiftSelect = ({ value, onChange, availableGifts }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedGift = availableGifts.find(g => g.name === value);
  
  return (
    <div className="custom-dropdown image-dropdown" ref={dropdownRef}>
      <div 
        className="rule-image-container clickable-image" 
        onClick={() => setIsOpen(!isOpen)}
        title="Clique para trocar o presente"
      >
        {selectedGift ? (
          <img src={selectedGift.url} alt={selectedGift.name} className="rule-gift-image" />
        ) : (
          <div className="placeholder-icon">🎁</div>
        )}
      </div>
      
      {isOpen && (
        <ul className="dropdown-list">
          {availableGifts.map(g => (
            <li 
              key={g.filename} 
              className="dropdown-item"
              onClick={() => { onChange(g.name); setIsOpen(false); }}
            >
              <img src={g.url} alt={g.name} className="dropdown-img-small" />
              <div className="dropdown-item-details">
                <span className="gift-name">{g.name}</span>
                {g.diamondCount > 0 && <span className="gift-cost">💎 {g.diamondCount}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CustomModeSelect = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = [
    { id: 'presentes', label: 'Apenas Presentes e Alertas (Recomendado)' },
    { id: 'tudo', label: 'Tudo (Presentes, Alertas e Chat ao vivo)' }
  ];

  const selected = options.find(o => o.id === value);

  return (
    <div className="custom-text-dropdown" ref={dropdownRef} style={{position: 'relative'}}>
      <div 
        className="custom-dropdown-header"
        onClick={() => setIsOpen(!isOpen)}
        style={{
            padding: '0.8rem', borderRadius: '8px', border: '1px solid #3f3f46', 
            background: '#18181b', color: '#fff', cursor: 'pointer',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}
      >
        <span>{selected?.label}</span>
        <span style={{fontSize: '0.8rem', opacity: 0.6}}>▼</span>
      </div>
      
      {isOpen && (
        <ul className="dropdown-list" style={{
            position: 'absolute', top: '100%', left: 0, right: 0, 
            background: '#27272a', border: '1px solid #3f3f46', 
            borderRadius: '8px', marginTop: '4px', padding: 0, 
            listStyle: 'none', zIndex: 100, overflow: 'hidden'
        }}>
          {options.map(o => (
            <li 
              key={o.id}
              onClick={() => { onChange(o.id); setIsOpen(false); }}
              style={{
                  padding: '1rem', cursor: 'pointer', 
                  background: value === o.id ? 'rgba(0, 229, 143, 0.1)' : 'transparent',
                  color: value === o.id ? '#00E58F' : '#fff',
                  borderBottom: '1px solid #3f3f46',
                  transition: 'background 0.2s'
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // States for new features
  const [showConfetti, setShowConfetti] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [proExpiresAt, setProExpiresAt] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(30);
  const activeTab = location.pathname.split('/').pop() || 'rules';
  const [targetUsername, setTargetUsername] = useState('');
  const [rules, setRules] = useState([]);
  const [availableGifts, setAvailableGifts] = useState([]);
  const [status, setStatus] = useState('Buscando configurações...');
  const [user, setUser] = useState(null);
  const [pixData, setPixData] = useState(null);
  const [loadingPix, setLoadingPix] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState({ ruleId: null, field: null });
  const [isLive, setIsLive] = useState(false);
  const [remainingMs, setRemainingMs] = useState(60 * 60 * 1000);
  
  // Pega modo "admin" da URL apenas para ver mais logs se quiser
  const [timeLeftStr, setTimeLeftStr] = useState('60 min 0 seg');
  const [widgetMode, setWidgetMode] = useState('presentes');
  const [legendStyle, setLegendStyle] = useState('vertical');
  
  // States for account tab
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (!token || !userData) {
      navigate('/login');
      return;
    }
    setUser(JSON.parse(userData));
    fetchData(token);

    // Conecta o socket para ouvir eventos como pagamento completo
    const socket = io(API_BASE_URL, {
      auth: { token }
    });

    socket.on('payment-completed', () => {
      setShowConfetti(true);
      setToastMsg({ msg: 'Pagamento recebido! Você agora é PRO!', type: 'success' });
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    });

    socket.on('tiktok-connected', () => {
      setIsLive(true);
    });

    socket.on('tiktok-disconnected', () => {
      setIsLive(false);
    });

    return () => socket.disconnect();
  }, [navigate]);

  const showToast = (msg, type = 'success') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchData = async (token) => {
    try {
      const giftsRes = await fetch(GIFTS_API);
      const data = await giftsRes.json();
      const followOption = {
        filename: 'follow.png',
        name: 'Novo Seguidor',
        id: 'follow',
        diamondCount: 0,
        url: 'https://cdn-icons-png.flaticon.com/512/4138/4138124.png'
      };
      const likeOption = {
        filename: 'like.png',
        name: 'Curtida',
        id: 'like',
        diamondCount: 0,
        url: 'https://cdn-icons-png.flaticon.com/512/833/833472.png'
      };
      const shareOption = {
        filename: 'share.png',
        name: 'Compartilhamento',
        id: 'share',
        diamondCount: 0,
        url: 'https://cdn-icons-png.flaticon.com/512/2823/2823086.png'
      };
      const giftsData = [followOption, likeOption, shareOption, ...data];
      setAvailableGifts(giftsData);

      const rulesRes = await fetch(API_URL, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (rulesRes.status === 401 || rulesRes.status === 403) {
        localStorage.removeItem('token');
        navigate('/login');
        return;
      }
      
      try {
        const userRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (userRes.ok) {
          const freshUser = await userRes.json();
          setUser(freshUser);
          localStorage.setItem('user', JSON.stringify(freshUser));
        }
      } catch (e) {
        console.error('Falha ao atualizar dados do usuario', e);
      }
      
      const rulesData = await rulesRes.json();
      
      if (rulesData.targetUsername) {
        setTargetUsername(rulesData.targetUsername);
      }
      
      if (rulesData.rules) {
        let rulesArray = [];
        if (Array.isArray(rulesData.rules)) {
          // Adapt to unified format
          const adapted = rulesData.rules.map(r => {
             if (r.actionType !== undefined) { // legacy array format
                return {
                   id: r.id, 
                   triggerType: r.triggerType, 
                   triggerValue: r.triggerValue,
                   actionKeypress: r.actionType === 'keypress' ? r.actionValue : '',
                   actionSound: r.actionType === 'sound' ? r.actionValue : '',
                   actionVideo: r.actionType === 'video' ? r.actionValue : '',
                   actionLabel: r.actionLabel || ''
                };
             }
             return { ...r, actionLabel: r.actionLabel || '' }; // already unified format
          });
          rulesArray = adapted;
        } else {
          rulesArray = Object.keys(rulesData.rules).map(key => ({
            id: Math.random().toString(36).substr(2, 9),
            triggerType: 'gift',
            triggerValue: key,
            actionKeypress: rulesData.rules[key],
            actionSound: '',
            actionVideo: '',
            actionLabel: ''
          }));
        }
        setRules(rulesArray);
      }
      setStatus('Conectado ao Motor');
    } catch (error) {
      console.error(error);
      setStatus('Erro de conexão. O Backend (motor) está rodando?');
    }
  };

  const handleSave = async () => {
    setStatus('Salvando...');
    
    const rulesToSave = rules
      .filter(r => r.triggerValue && (r.actionKeypress || r.actionSound || r.actionVideo))
      .map(r => ({
        id: r.id,
        triggerType: r.triggerType,
        triggerValue: r.triggerValue,
        actionKeypress: r.actionKeypress || '',
        actionSound: r.actionSound || '',
        actionVideo: r.actionVideo || '',
        actionLabel: r.actionLabel || ''
      }));

    const token = localStorage.getItem('token');
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUsername: targetUsername.trim(),
          rules: rulesToSave
        })
      });
      setStatus('Configurações salvas com sucesso! ✨');
      setTimeout(() => setStatus('Conectado ao Motor'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('Erro ao salvar configurações');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const addRule = () => {
    setRules([{ 
      id: Math.random().toString(36).substr(2, 9), 
      triggerType: 'gift',
      triggerValue: availableGifts.length > 0 ? availableGifts[0].name : '', 
      actionKeypress: '',
      actionSound: '',
      actionVideo: '',
      actionLabel: ''
    }, ...rules]);
  };

  const removeRule = (id) => {
    const ruleToRemove = rules.find(r => r.id === id);
    if (ruleToRemove) {
       const token = localStorage.getItem('token');
       const urlsToDelete = [ruleToRemove.actionSound, ruleToRemove.actionVideo].filter(Boolean);
       urlsToDelete.forEach(url => {
           fetch(`${API_BASE_URL}/api/media`, {
             method: 'DELETE',
             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
             body: JSON.stringify({ url })
           }).catch(e => console.error("Erro ao deletar mídia", e));
       });
    }
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id, field, value) => {
    setRules(prevRules => prevRules.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const clearMedia = (ruleId, field) => {
      const rule = rules.find(r => r.id === ruleId);
      if (rule && rule[field]) {
          const token = localStorage.getItem('token');
          fetch(`${API_BASE_URL}/api/media`, {
             method: 'DELETE',
             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
             body: JSON.stringify({ url: rule[field] })
          }).catch(console.error);
          updateRule(ruleId, field, '');
      }
  };

  const handleFileUpload = async (file, ruleId, field) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast('Arquivo muito grande (máximo 10MB).', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('media', file);
    
    const token = localStorage.getItem('token');
    showToast('Enviando mídia para a nuvem...', 'success');
    
    // Clean up old file if changing media
    const oldRule = rules.find(r => r.id === ruleId);
    if (oldRule && oldRule[field]) {
       fetch(`${API_BASE_URL}/api/media`, {
         method: 'DELETE',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
         body: JSON.stringify({ url: oldRule[field] })
       }).catch(e => console.error("Erro ao deletar mídia antiga", e));
    }

    setUploadingMedia({ ruleId, field });

    try {
      const res = await fetch(`${API_BASE_URL}/api/media/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        showToast('Mídia enviada com sucesso!', 'success');
        updateRule(ruleId, field, data.url);
      } else {
        showToast('Erro ao enviar mídia: ' + (data.error || 'Desconhecido'), 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao enviar mídia', 'error');
    } finally {
      setUploadingMedia({ ruleId: null, field: null });
    }
  };

  const generatePix = async () => {
    setLoadingPix(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/pix`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ planDuration: selectedPlan })
      });
      const data = await res.json();
      if (data.success) {
        setPixData(data);
      } else {
        showToast('Erro ao gerar PIX: ' + (data.error || 'Desconhecido'), 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao tentar gerar PIX.', 'error');
    }
    setLoadingPix(false);
  };

  const handleUpdatePassword = async () => {
    if (!newPassword) {
      showToast('Por favor, digite a nova senha.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('As senhas não coincidem. Tente novamente.', 'error');
      return;
    }
    
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (data.success) {
        showToast('Senha atualizada com sucesso! 🔐', 'success');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showToast('Erro: ' + (data.error || 'Desconhecido'), 'error');
      }
    } catch (err) {
      showToast('Erro de conexão ao atualizar senha.', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      } else {
        showToast('Erro: ' + (data.error || 'Desconhecido'), 'error');
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      showToast('Erro de conexão ao excluir conta.', 'error');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(API_URL, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        setTargetUsername(data.targetUsername);
        if (data.rules && Array.isArray(data.rules)) {
          setRules(data.rules);
        }
      } catch (e) {}
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!user || user.plan === 'pro') return;
    
    const localTimeUsed = user.trial_time_used || 0;
    const totalMs = 60 * 60 * 1000;
    
    if (user.trial_used || localTimeUsed >= totalMs) {
      setRemainingMs(0);
      return;
    }
    
    setRemainingMs(Math.max(0, totalMs - localTimeUsed));
  }, [user]);

  useEffect(() => {
    if (remainingMs <= 0) {
       setTimeLeftStr('0 min 0 seg');
       return;
    }
    
    const mins = Math.floor(remainingMs / 60000);
    const secs = Math.floor((remainingMs % 60000) / 1000);
    setTimeLeftStr(`${mins} min ${secs} seg`);

    if (!isLive) return;

    const interval = setInterval(() => {
      setRemainingMs(prev => Math.max(0, prev - 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [remainingMs, isLive]);

  return (
    <div className="saas-layout">
      {/* SIDEBAR */}
      <aside className="saas-sidebar">
        <div className="sidebar-logo">TikTok Live <span>Actions</span></div>
          <div className="sidebar-menu">
            <div 
              className={`sidebar-item ${activeTab === 'rules' || activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard/rules')}
            >
              <span className="icon">🎮</span> Regras de interações
            </div>
            
            <div 
              className={`sidebar-item ${activeTab === 'instructions' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard/instructions')}
            >
              <span className="icon">🚀</span> Cliente desktop
            </div>
            
            <div 
              className={`sidebar-item ${activeTab === 'widget' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard/widget')}
            >
              <span className="icon">📺</span> Alertas e Overlays
            </div>
            
            <div 
              className={`sidebar-item ${activeTab === 'subscription' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard/subscription')}
            >
              <span className="icon">💎</span> Assinatura
            </div>
            
            <div 
              className={`sidebar-item ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => navigate('/dashboard/account')}
            >
              <span className="icon">⚙️</span> Minha conta
            </div>
              
            {user?.is_admin && (
              <div 
                className="sidebar-item"
                onClick={() => navigate('/admin')}
              >
                <span className="icon">👑</span> Painel Admin
              </div>
            )}
          </div>
      </aside>

      {/* CONTENT AREA */}
      <main className="saas-content">
        {showConfetti && <Confetti />}
        
        {(activeTab === 'rules' || activeTab === 'dashboard') && (
          <div className="tab-dashboard">
            <div className="saas-header">
              <h1>Seu Painel</h1>
              <p>Bem-vindo, {user?.email}. Configure a conexão e os gatilhos da sua Live.</p>
            </div>

            <div className="saas-card">
              <div className="input-group username-input-group" style={{marginBottom: 0}}>
                <label>Qual conta do TikTok vamos monitorar?</label>
                <div className="username-wrapper">
                  <span className="at-symbol">@</span>
                  <input 
                    type="text" 
                    placeholder="Ex: hadighazi997"
                    value={targetUsername}
                    onChange={(e) => setTargetUsername(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="rules-section">
              <div className="rules-header">
                <h2>Regras de Ação</h2>
                <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                  <div className="status-badge status-connected" style={{margin: 0}}>
                    <div className="status-dot"></div>
                    {status}
                  </div>
                  <button className="btn-secondary btn-small" onClick={addRule}>+ Adicionar Regra</button>
                </div>
              </div>

              {rules.length === 0 ? (
                <p className="no-rules" style={{background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '16px', textAlign: 'center'}}>Nenhuma regra configurada. Clique em Adicionar Regra.</p>
              ) : (
                <div className="rules-list">
                  {rules.map((rule, index) => (
                    <div 
                      key={rule.id} 
                      className="rule-card" 
                      style={{ position: 'relative', zIndex: rules.length - index }}
                    >
                      <CustomGiftSelect 
                        value={rule.triggerValue}
                        onChange={(val) => {
                          let type = 'gift';
                          if (val === 'Novo Seguidor') type = 'follow';
                          if (val === 'Curtida') type = 'like';
                          if (val === 'Compartilhamento') type = 'share';
                          updateRule(rule.id, 'triggerValue', val);
                          updateRule(rule.id, 'triggerType', type);
                        }}
                        availableGifts={availableGifts}
                      />
                      <div className="rule-inputs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', flex: 1, gap: '1rem', alignItems: 'start' }}>
                        
                        {/* Tecla */}
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                           <span style={{color: '#a1a1aa', fontSize: '0.85rem'}}>⌨️ Apertar Tecla (Bot)</span>
                           <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                             <input 
                               type="text" 
                               placeholder="Aperte uma Tecla..."
                               value={rule.actionKeypress || ''}
                               readOnly
                               onKeyDown={(e) => {
                                   e.preventDefault();
                                   if (e.key === 'Backspace' || e.key === 'Delete') {
                                      updateRule(rule.id, 'actionKeypress', '');
                                      return;
                                   }
                                   let keyName = e.key;
                                   if (e.code === 'Space') keyName = 'Space';
                                   if (['Shift', 'Control', 'Alt', 'Meta'].includes(keyName)) return;
                                   updateRule(rule.id, 'actionKeypress', keyName.toUpperCase());
                               }}
                               style={{flex: 1, cursor: 'pointer', textAlign: 'center', fontWeight: 'bold', border: '2px dashed rgba(255,255,255,0.2)', padding: '0.6rem', background: '#18181b', color: '#fff', borderRadius: '8px'}}
                             />
                             {rule.actionKeypress && (
                                <button className="btn-remove-rule" style={{position: 'static', transform: 'none', background: 'transparent', color: '#ff4444', width: 'auto', height: 'auto', border: 'none', fontSize: '1.2rem'}} onClick={() => updateRule(rule.id, 'actionKeypress', '')} title="Remover Tecla">&times;</button>
                             )}
                           </div>
                        </div>

                        {/* Som */}
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                           <span style={{color: '#a1a1aa', fontSize: '0.85rem'}}>🎵 Tocar Som (Widget)</span>
                           <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                             <label style={{ 
                                 flex: 1, padding: '0.6rem', borderRadius: '8px', 
                                 background: '#18181b', color: '#a1a1aa', border: '2px dashed rgba(255,255,255,0.1)',
                                 cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease',
                                 display: 'block'
                               }}
                               onMouseOver={(e) => e.currentTarget.style.borderColor = '#00E58F'}
                               onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                             >
                               {uploadingMedia.ruleId === rule.id && uploadingMedia.field === 'actionSound' ? (
                                  <span style={{color: '#a1a1aa'}}>⏳ Enviando para a nuvem...</span>
                               ) : rule.actionSound ? (
                                  <span style={{color: '#00E58F', fontWeight: 'bold'}}>
                                     📁 {(rule.actionSound.split('/').pop() || '').replace(/^[^_]+_/, '') || 'Som Selecionado'}
                                  </span>
                               ) : (
                                  <span style={{fontSize: '0.9rem'}}>📂 Escolher áudio...</span>
                               )}
                               <input 
                                 type="file" 
                                 accept="audio/*"
                                 disabled={uploadingMedia.ruleId === rule.id && uploadingMedia.field === 'actionSound'}
                                 onChange={e => handleFileUpload(e.target.files[0], rule.id, 'actionSound')}
                                 style={{ display: 'none' }}
                               />
                             </label>
                             {rule.actionSound && (
                                <button className="btn-remove-rule" style={{position: 'static', transform: 'none', background: 'transparent', color: '#ff4444', width: 'auto', height: 'auto', border: 'none', fontSize: '1.2rem'}} onClick={() => clearMedia(rule.id, 'actionSound')} title="Remover Som">&times;</button>
                             )}
                           </div>
                        </div>

                        {/* Vídeo */}
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                           <span style={{color: '#a1a1aa', fontSize: '0.85rem'}}>🎬 Exibir Vídeo (Widget)</span>
                           <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
                             <label style={{ 
                                 flex: 1, padding: '0.6rem', borderRadius: '8px', 
                                 background: '#18181b', color: '#a1a1aa', border: '2px dashed rgba(255,255,255,0.1)',
                                 cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease',
                                 display: 'block'
                               }}
                               onMouseOver={(e) => e.currentTarget.style.borderColor = '#00E58F'}
                               onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                             >
                               {uploadingMedia.ruleId === rule.id && uploadingMedia.field === 'actionVideo' ? (
                                  <span style={{color: '#a1a1aa'}}>⏳ Enviando para a nuvem...</span>
                               ) : rule.actionVideo ? (
                                  <span style={{color: '#00E58F', fontWeight: 'bold'}}>
                                     📁 {(rule.actionVideo.split('/').pop() || '').replace(/^[^_]+_/, '') || 'Vídeo Selecionado'}
                                  </span>
                               ) : (
                                  <span style={{fontSize: '0.9rem'}}>📂 Escolher vídeo...</span>
                               )}
                               <input 
                                 type="file" 
                                 accept="video/*"
                                 disabled={uploadingMedia.ruleId === rule.id && uploadingMedia.field === 'actionVideo'}
                                 onChange={e => handleFileUpload(e.target.files[0], rule.id, 'actionVideo')}
                                 style={{ display: 'none' }}
                               />
                             </label>
                             {rule.actionVideo && (
                                <button className="btn-remove-rule" style={{position: 'static', transform: 'none', background: 'transparent', color: '#ff4444', width: 'auto', height: 'auto', border: 'none', fontSize: '1.2rem'}} onClick={() => clearMedia(rule.id, 'actionVideo')} title="Remover Vídeo">&times;</button>
                             )}
                           </div>
                        </div>

                        {/* Texto na Legenda */}
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                           <span style={{color: '#a1a1aa', fontSize: '0.85rem'}}>💬 Texto na Legenda</span>
                           <div style={{display: 'flex', gap: '1rem', alignItems: 'center', height: '100%'}}>
                             <input 
                               type="text" 
                               placeholder="Ex: Acelera"
                               value={rule.actionLabel || ''}
                               onChange={(e) => updateRule(rule.id, 'actionLabel', e.target.value)}
                               style={{flex: 1, padding: '0.6rem', border: '2px dashed rgba(255,255,255,0.1)', background: '#18181b', color: '#fff', borderRadius: '8px', fontSize: '0.95rem'}}
                             />
                           </div>
                        </div>


                      </div>
                      <button 
                        className="btn-remove-rule" 
                        onClick={() => removeRule(rule.id)}
                        title="Remover Regra"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{marginTop: '2rem'}}>
                <button className="btn-primary-large" onClick={handleSave}>
                  Salvar e Conectar ao Jogo
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'instructions' && (
          <div className="tab-instructions">
            <div className="saas-header">
              <h1>Guia de Uso</h1>
              <p>Aprenda a conectar os serviços para iniciar as interações na sua live.</p>
            </div>

            <div className="saas-card" style={{marginBottom: '2rem'}}>
              <h2>🖥️ Cliente Desktop (Controle do Jogo)</h2>
              <p style={{color: '#a1a1aa', marginTop: '0.5rem', marginBottom: '1rem'}}>
                O aplicativo desktop é responsável por ler os presentes e apertar as teclas fisicamente no seu computador.
              </p>
              
              <ol style={{color: '#e4e4e7', marginLeft: '1.2rem', lineHeight: '1.6'}}>
                <li style={{marginBottom: '1rem'}}>
                  Baixe o aplicativo para Windows (TikTokLiveActions.exe).<br/>
                  <a href="/TikTokLiveActions.zip" download className="btn-secondary" style={{display: 'inline-block', padding: '0.4rem 1.2rem', marginTop: '0.5rem', textDecoration: 'none', background: '#00E58F', color: '#000', fontWeight: 'bold', border: 'none'}}>Baixar Arquivo .zip</a>
                </li>
                <li style={{marginBottom: '0.5rem'}}>Abra o aplicativo com dois cliques. Ele abrirá o seu navegador automaticamente.</li>
                <li style={{marginBottom: '0.5rem'}}>Na tela do navegador, clique em <strong>"Autorizar Conexão"</strong>.</li>
                <li style={{marginBottom: '0.5rem'}}>O aplicativo mostrará <em>"Acesso autorizado!"</em> e aguardará os comandos da live.</li>
                <li>Deixe-o aberto enquanto estiver jogando.</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === 'widget' && (
          <div className="tab-widget">
            <div className="saas-header">
              <h1>Alertas no OBS</h1>
              <p>Configure widgets para mostrar na tela da sua transmissão.</p>
            </div>
            
            <div className="saas-card">
              <h2>🎦 Widget para OBS Studio (Alertas Visuais)</h2>
              <p style={{color: '#a1a1aa', marginTop: '0.5rem', marginBottom: '1rem'}}>
                Você pode exibir os presentes e os comandos que o seu público envia direto na tela da live.
              </p>
              
              <div className="input-group" style={{marginBottom: '1rem'}}>
                <label>O que você quer exibir na tela?</label>
                <CustomModeSelect 
                  value={widgetMode} 
                  onChange={setWidgetMode} 
                />
              </div>

              <div className="input-group">
                <label>Link Exclusivo do seu Widget (Mantenha em segredo)</label>
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}/widget?modo=${widgetMode}&token=${localStorage.getItem('token')}`}
                  onClick={(e) => { e.target.select(); navigator.clipboard.writeText(e.target.value); showToast('URL copiada para a área de transferência!'); }}
                  style={{cursor: 'pointer', fontFamily: 'monospace', color: '#00E58F', background: 'rgba(0, 229, 143, 0.1)'}}
                />
              </div>

              <ol style={{color: '#e4e4e7', marginLeft: '1.2rem', lineHeight: '1.6', marginTop: '1rem'}}>
                <li style={{marginBottom: '0.5rem'}}>Clique no link acima para copiar (Copiar URL).</li>
                <li style={{marginBottom: '0.5rem'}}>No OBS Studio, em <em>Fontes (Sources)</em>, clique em <strong>+</strong> e escolha <strong>Navegador (Browser)</strong>.</li>
                <li style={{marginBottom: '0.5rem'}}>Cole a URL no campo correspondente, coloque Largura <strong>600</strong> e Altura <strong>800</strong>.</li>
                <li>Sempre que uma regra for disparada, a imagem do presente piscará na tela do seu OBS!</li>
                </ol>

                <hr style={{ borderColor: 'rgba(255,255,255,0.1)', margin: '2rem 0' }} />

                <h2>🧾 Menu de Presentes (Legenda Visual)</h2>
                <p style={{color: '#a1a1aa', marginTop: '0.5rem', marginBottom: '1rem'}}>
                  Mostre na tela da live quais presentes ativam quais comandos, como um cardápio para incentivar o público.
                </p>

                <div className="input-group" style={{marginBottom: '1rem'}}>
                  <label>Qual formato de exibição você prefere?</label>
                  <select 
                    value={legendStyle} 
                    onChange={e => setLegendStyle(e.target.value)}
                    className="custom-dropdown"
                    style={{ padding: '10px', background: '#121214', color: '#fff', border: '1px solid #27272a', borderRadius: '8px', width: '100%', fontSize: '1rem' }}
                  >
                    <option value="vertical">Vertical (Lista em coluna - Ideal para as laterais)</option>
                    <option value="horizontal">Horizontal (Letreiro - Ideal para o rodapé/topo)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Link Exclusivo do seu Menu de Presentes</label>
                  <input 
                    type="text" 
                    readOnly 
                    value={`${window.location.origin}/legend?style=${legendStyle}&token=${localStorage.getItem('token')}`}
                    onClick={(e) => { e.target.select(); navigator.clipboard.writeText(e.target.value); showToast('URL copiada para a área de transferência!'); }}
                    style={{cursor: 'pointer', fontFamily: 'monospace', color: '#00E58F', background: 'rgba(0, 229, 143, 0.1)'}}
                  />
                </div>

                <ol style={{color: '#e4e4e7', marginLeft: '1.2rem', lineHeight: '1.6', marginTop: '1rem'}}>
                  <li style={{marginBottom: '0.5rem'}}>Copie a URL acima.</li>
                  <li style={{marginBottom: '0.5rem'}}>Adicione uma nova Fonte de Navegador (Browser) no OBS.</li>
                  <li style={{marginBottom: '0.5rem'}}>Para formato Vertical use Largura 300 e Altura 800. Para Horizontal use Largura 1000 e Altura 150.</li>
                </ol>
            </div>
          </div>
        )}

        {activeTab === 'subscription' && (
          <div className="tab-subscription">
            <div className="saas-header">
              <h1>Sua Assinatura</h1>
              <p>Gerencie seu plano e faça upgrade para desbloquear limite de tempo.</p>
            </div>

            <div className="saas-card">
              <div className="subscription-status">
                <div>
                  <h2 style={{fontSize: '1.5rem', marginBottom: '0.2rem'}}>
                    {user?.plan === 'pro' ? 'Plano Pro 🌟' : 'Plano Trial'}
                  </h2>
                  <p style={{color: '#a1a1aa', margin: 0}}>
                    {user?.plan === 'pro' ? 'Acesso ilimitado e prioritário ativo.' : 'Você está testando a ferramenta gratuitamente.'}
                  </p>
                </div>
                <div className="sub-badge" style={user?.plan === 'pro' ? {background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', borderColor: 'rgba(236, 72, 153, 0.2)'} : {}}>
                  Ativo
                </div>
              </div>

              {user?.plan !== 'pro' && (
                <>
                  <div className="sub-timer">
                    Tempo restante da Live Teste (Total de 1 Hora):<br/>
                    <span>{timeLeftStr}</span>
                  </div>

                  <h3 style={{marginBottom: '1rem'}}>Fazer Upgrade para Plano Pro</h3>
                  <p style={{color: '#a1a1aa', marginBottom: '1.5rem'}}>
                    Quando o seu tempo acabar, será necessário ter uma assinatura para continuar usando o app na sua Live. 
                    Escolha um plano abaixo para liberar acesso ilimitado!
                  </p>
                  
                  {!pixData ? (
                    <>
                      <div className="plans-grid">
                        <div className={`plan-card ${selectedPlan === 30 ? 'active' : ''}`} onClick={() => setSelectedPlan(30)}>
                          <div className="plan-title">Mensal</div>
                          <div className="plan-price">R$ 20<span>/mês</span></div>
                          <ul className="plan-features">
                            <li>Suporte prioritário</li>
                            <li>Tempo de live ilimitado</li>
                            <li>Acesso a todos os alertas</li>
                          </ul>
                        </div>
                        
                        <div className={`plan-card ${selectedPlan === 90 ? 'active' : ''}`} onClick={() => setSelectedPlan(90)}>
                          <div className="plan-discount">-16% OFF</div>
                          <div className="plan-title">Trimestral</div>
                          <div className="plan-price">R$ 50<span>/trimestre</span></div>
                          <ul className="plan-features">
                            <li>Equivale a R$ 16,66/mês</li>
                            <li>Renovação a cada 3 meses</li>
                          </ul>
                        </div>
                        
                        <div className={`plan-card ${selectedPlan === 180 ? 'active' : ''}`} onClick={() => setSelectedPlan(180)}>
                          <div className="plan-discount">-25% OFF</div>
                          <div className="plan-title">Semestral</div>
                          <div className="plan-price">R$ 90<span>/semestre</span></div>
                          <ul className="plan-features">
                            <li>Equivale a R$ 15,00/mês</li>
                            <li>Renovação a cada 6 meses</li>
                          </ul>
                        </div>
                        
                        <div className={`plan-card ${selectedPlan === 365 ? 'active' : ''}`} onClick={() => setSelectedPlan(365)}>
                          <div className="plan-discount">-37% OFF</div>
                          <div className="plan-title">Anual</div>
                          <div className="plan-price">R$ 150<span>/ano</span></div>
                          <ul className="plan-features">
                            <li>Equivale a R$ 12,50/mês</li>
                            <li>Melhor custo benefício</li>
                          </ul>
                        </div>
                      </div>
                      
                      <div className="payment-methods" style={{display: 'flex', justifyContent: 'center', marginTop: '1rem'}}>
                        <button className="btn-pix" onClick={generatePix} disabled={loadingPix} style={{fontSize: '1.2rem', padding: '1rem 3rem'}}>
                          {loadingPix ? 'Gerando PIX...' : 'Pagar com PIX'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="pix-checkout" style={{background: '#fff', color: '#000', padding: '2rem', borderRadius: '16px', textAlign: 'center'}}>
                      <h3 style={{marginBottom: '1rem', color: '#000'}}>Escaneie o QR Code</h3>
                      <img src={pixData.qrCodeImage} alt="QR Code PIX" style={{width: '250px', height: '250px', margin: '0 auto', display: 'block', borderRadius: '8px', border: '1px solid #ccc'}} />
                      <p style={{marginTop: '1rem', fontSize: '0.9rem'}}>Ou copie e cole o código abaixo:</p>
                      <textarea readOnly value={pixData.brCode} style={{width: '100%', height: '80px', marginTop: '0.5rem', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid #ccc'}} />
                      <div style={{marginTop: '1.5rem', color: '#10b981', fontWeight: 'bold'}}>
                        🔄 Aguardando confirmação do pagamento...
                      </div>
                      <p style={{marginTop: '0.5rem', fontSize: '0.85rem', color: '#6b7280'}}>A tela será atualizada automaticamente.</p>
                      <button className="btn-secondary" style={{marginTop: '1rem', color: '#000', borderColor: '#ccc'}} onClick={() => window.location.reload()}>Já paguei (Atualizar Tela)</button>
                    </div>
                  )}
                </>
              )}
              {user?.plan === 'pro' && proExpiresAt && (
                <div style={{marginTop: '2rem'}}>
                  <h3 style={{marginBottom: '0.5rem'}}>Próxima Cobrança</h3>
                  <p>
                    O seu acesso expira em: <strong>{new Date(proExpiresAt).toLocaleDateString('pt-BR')}</strong>
                  </p>
                  
                  {new Date(proExpiresAt).getTime() - Date.now() < 5 * 24 * 60 * 60 * 1000 && (
                    <div style={{background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '1rem', borderRadius: '8px', marginTop: '1rem', color: '#ef4444'}}>
                      ⚠️ <strong>Atenção:</strong> Sua assinatura vence em menos de 5 dias. Efetue um novo pagamento para continuar com o acesso ilimitado.
                      <div style={{marginTop: '1rem'}}>
                        <button className="btn-secondary" onClick={() => {
                          const u = {...user};
                          u.plan = 'free_trial';
                          setUser(u); // Simula fim do plano pra abrir o checkout
                        }}>Renovar Agora</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {paymentHistory.length > 0 && (
                <div style={{marginTop: '3rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem'}}>
                  <h3>Últimos Pagamentos</h3>
                  <table style={{width: '100%', marginTop: '1rem', textAlign: 'left', borderCollapse: 'collapse'}}>
                    <thead>
                      <tr style={{borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
                        <th style={{padding: '0.5rem'}}>Data</th>
                        <th style={{padding: '0.5rem'}}>Plano</th>
                        <th style={{padding: '0.5rem'}}>Valor</th>
                        <th style={{padding: '0.5rem'}}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((p, i) => (
                        <tr key={i} style={{borderBottom: '1px solid rgba(255,255,255,0.05)'}}>
                          <td style={{padding: '0.5rem'}}>{new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
                          <td style={{padding: '0.5rem'}}>{p.plan_duration} Dias</td>
                          <td style={{padding: '0.5rem'}}>R$ {(p.amount / 100).toFixed(2)}</td>
                          <td style={{padding: '0.5rem', color: p.status === 'COMPLETED' ? '#10b981' : '#fbbf24'}}>{p.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'account' && (
          <div className="tab-account">
            <div className="saas-header">
              <h1>Minha Conta</h1>
              <p>Gerencie seus dados de acesso e segurança da plataforma.</p>
            </div>

            <div className="saas-card">
              <h2>Segurança e Acesso</h2>
              <p style={{color: '#a1a1aa', marginTop: '0.5rem', marginBottom: '2rem'}}>
                Mantenha suas credenciais seguras. Para alterar o e-mail, entre em contato com o suporte.
              </p>
              
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem'}}>
                <div>
                  <div className="input-group">
                    <label>Email Atual (Conta)</label>
                    <input type="email" disabled value={user?.email || ''} style={{opacity: 0.5, cursor: 'not-allowed', background: 'rgba(255,255,255,0.02)'}} />
                  </div>
                </div>

                <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                  <div className="input-group" style={{marginBottom: 0}}>
                    <label>Nova Senha</label>
                    <input 
                      type="password" 
                      placeholder="Digite uma nova senha segura" 
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                  </div>

                  <div className="input-group" style={{marginBottom: 0}}>
                    <label>Confirmar Nova Senha</label>
                    <input 
                      type="password" 
                      placeholder="Repita a nova senha" 
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>

                  <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem'}}>
                    <button className="btn-primary" style={{padding: '0.8rem 2rem'}} onClick={handleUpdatePassword}>
                      Atualizar Senha
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="saas-card" style={{marginTop: '2rem', border: '1px solid rgba(239, 68, 68, 0.2)'}}>
              <h2 style={{color: '#ef4444'}}>Zona de Perigo</h2>
              <p style={{color: '#a1a1aa', marginTop: '0.5rem', marginBottom: '1.5rem'}}>
                Ações irreversíveis relacionadas à sua conta.
              </p>
              {!showDeleteConfirm ? (
                <button className="btn-secondary" style={{color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)'}} onClick={() => setShowDeleteConfirm(true)}>
                  Excluir Minha Conta
                </button>
              ) : (
                <div className="slide-in" style={{padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '12px'}}>
                  <h3 style={{color: '#ef4444', marginBottom: '0.5rem'}}>Tem certeza absoluta?</h3>
                  <p style={{color: '#fff', marginBottom: '1.5rem', fontSize: '0.9rem'}}>
                    Esta ação não pode ser desfeita. Todo o seu acesso, configurações de live e dias restantes do plano Pro serão perdidos permanentemente.
                  </p>
                  <div style={{display: 'flex', gap: '1rem'}}>
                    <button className="btn-primary" style={{background: '#ef4444', borderColor: '#ef4444', color: '#fff', fontWeight: 'bold'}} onClick={handleDeleteAccount}>
                      Sim, Excluir Definitivamente
                    </button>
                    <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: toastMsg.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(0, 229, 143, 0.95)',
          color: toastMsg.type === 'error' ? '#fff' : '#000',
          padding: '16px 24px',
          borderRadius: '8px',
          fontWeight: 'bold',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          zIndex: 9999,
          animation: 'slideIn 0.3s ease-out'
        }}>
          {toastMsg.msg}
        </div>
      )}
    </div>
  );
}
