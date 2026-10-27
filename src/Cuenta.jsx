import React, { useState } from 'react';
import { X, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import { cambiarMiClave } from './api.js';
import { useEscape } from './ui.jsx';

/* Cambiar la contraseña propia (cualquier usuario: cliente, operador o Administración) */
export function MiClave({ toast, onClose }) {
  useEscape(onClose);
  const [f, setF] = useState({ actual: '', nueva: '', otra: '' });
  const [ver, setVer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const poner = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setError(null); };

  async function guardar(e) {
    e.preventDefault();
    if (!f.actual || !f.nueva) { setError('Completá la contraseña actual y la nueva'); return; }
    if (f.nueva.trim().length < 6) { setError('La nueva contraseña debe tener al menos 6 caracteres'); return; }
    if (f.nueva !== f.otra) { setError('La nueva contraseña no coincide en los dos campos'); return; }
    setBusy(true);
    try {
      await cambiarMiClave(f.actual, f.nueva);
      toast('Contraseña cambiada. Los otros equipos donde estabas conectado van a pedir entrar de nuevo.');
      onClose();
    } catch (x) { setError(x.message); }
    finally { setBusy(false); }
  }

  const tipo = ver ? 'text' : 'password';
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="phone ds-modal mi-clave" role="dialog" aria-label="Cambiar mi contraseña">
        <div className="phone-notch" />
        <div className="phone-bar"><KeyRound size={13} color="var(--t-E7C15A)" /> <span>CAMBIAR MI CONTRASEÑA</span><button onClick={onClose} className="phone-x" aria-label="Cerrar"><X size={16} /></button></div>
        <form className="phone-screen mi-clave-form" onSubmit={guardar}>
          <label className="fld"><span>Contraseña actual</span><input type={tipo} autoComplete="current-password" value={f.actual} onChange={poner('actual')} autoFocus /></label>
          <label className="fld"><span>Nueva contraseña (mínimo 6)</span><input type={tipo} autoComplete="new-password" value={f.nueva} onChange={poner('nueva')} /></label>
          <label className="fld"><span>Repetí la nueva</span><input type={tipo} autoComplete="new-password" value={f.otra} onChange={poner('otra')} /></label>
          <button type="button" className="mi-clave-ver" onClick={() => setVer((v) => !v)}>{ver ? <EyeOff size={13} /> : <Eye size={13} />} {ver ? 'Ocultar' : 'Mostrar'} contraseñas</button>
          {error && <div className="r6-error" role="alert">{error}</div>}
          <button type="submit" className="axt-btn primary" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />} Cambiar contraseña
          </button>
        </form>
      </div>
    </>
  );
}
