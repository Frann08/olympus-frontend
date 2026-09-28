import React from 'react';
import { createRoot } from 'react-dom/client';
import './tema.css';
import './styles.css';
import App from './App.jsx';
import { registerSW } from 'virtual:pwa-register';

// Versión nueva publicada: se instala y la app se recarga sola (antes quedaba la vieja
// hasta cerrarla y abrirla dos veces). Si queda abierta, revisa cada hora.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) { if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000); },
});

createRoot(document.getElementById('root')).render(<App />);
