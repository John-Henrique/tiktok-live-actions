import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Widget from './Widget.jsx'
import Login from './Login.jsx'
import Register from './Register.jsx'
import LegendOverlay from './LegendOverlay.jsx'
import Landing from './Landing.jsx'

import CliLogin from './CliLogin.jsx'

const isWidget = window.location.pathname === '/widget'

const Page = ({ title, children }) => {
  useEffect(() => {
    document.title = title ? `${title} - TikTok Live Actions` : 'TikTok Live Actions';
  }, [title]);
  return children;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isWidget ? <Page title="Widget de Interações"><Widget /></Page> : (
      <Router>
        <Routes>
          <Route path="/" element={<Page title="Início"><Landing /></Page>} />
          <Route path="/login" element={<Page title="Entrar"><Login /></Page>} />
          <Route path="/register" element={<Page title="Criar Conta"><Register /></Page>} />
          <Route path="/dashboard/*" element={<Page title="Painel de Controle"><App /></Page>} />
          <Route path="/widget" element={<Page title="Widget"><Widget /></Page>} />
          <Route path="/legend" element={<Page title="Legenda"><LegendOverlay /></Page>} />
          <Route path="/cli-login" element={<Page title="Autorização CLI"><CliLogin /></Page>} />
        </Routes>
      </Router>
    )}
  </StrictMode>,
)
