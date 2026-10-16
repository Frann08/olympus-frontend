import React, { useState, useEffect, useRef } from 'react';
import { ScanLine, Search, X, Check, Loader2, SkipForward, AlertTriangle, Link2 } from 'lucide-react';
import { api } from './api.js';
import { useEscape } from './ui.jsx';

/* Pistola UHF (Zebra TC22R u otra) con DataWedge en modo teclado:
   cada tag llega "tipeado" (EPC en hexadecimal) seguido de Enter. Este componente es el
   campo que recibe esas lecturas: no abre el teclado del celular (inputmode none) y junta
   todo lo que llega en un gatillazo para mandarlo de una vez. */

export const normEpc = (v) => {
  const h = String(v ?? '').toUpperCase().replace(/[^0-9A-F]/g, '');
  return h.length >= 8 && h.length <= 128 && h.length % 2 === 0 ? h : null;
};
// "E28068B0000002041AC37B21" → "E280 68B0 0000 0204 1AC3 7B21" (para mostrar)
export const epcLindo = (e) => String(e || '').replace(/(.{4})(?=.)/g, '$1 ');

// Separa lo que llegó en EPCs (por espacios, comas o renglones)
function partir(texto) {
  return String(texto || '').split(/[\s,;]+/).map(normEpc).filter(Boolean);
}

// espera: cuánto esperar después del último tag antes de mandar la tanda (la pistola tipea cada EPC en ~1 s)
export function CapturaPistola({ onLeidos, activo = true, texto = 'Apretá el gatillo de la pistola', ayuda, espera = 350 }) {
  const ref = useRef(null);
  const tanda = useRef([]);
  const timer = useRef(null);
  const [foco, setFoco] = useState(false);
  const [ultimo, setUltimo] = useState(null); // { n, t }
  const cb = useRef(onLeidos);
  cb.current = onLeidos;

  const enviar = () => {
    clearTimeout(timer.current);
    const xs = [...new Set(tanda.current)];
    tanda.current = [];
    if (xs.length) { setUltimo({ n: xs.length, t: Date.now() }); cb.current(xs); }
  };
  // lo que quedó escrito en el campo pasa a la tanda; la tanda sale un instante después del último tag
  const juntar = () => {
    const el = ref.current;
    if (!el || !el.value) return;
    tanda.current.push(...partir(el.value));
    el.value = '';
    clearTimeout(timer.current);
    timer.current = setTimeout(enviar, espera);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  // tomar el foco al aparecer, salvo que el usuario esté escribiendo en otro campo
  useEffect(() => {
    if (!activo) return;
    const a = document.activeElement;
    if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) ref.current && ref.current.focus({ preventScroll: true });
  }, [activo]);

  if (!activo) return null;
  return (
    <label className={'pis-captura' + (foco ? ' lista' : '')}>
      <span className="pis-ico"><ScanLine size={18} /></span>
      <span className="pis-txt">
        <b>{foco ? texto : 'Tocá acá antes de apretar el gatillo'}</b>
        <span>{ultimo && Date.now() - ultimo.t < 4000 ? `Leídos: ${ultimo.n} ${ultimo.n === 1 ? 'tag' : 'tags'}` : (ayuda || (foco ? 'Lista para leer' : 'La pistola escribe acá lo que lee'))}</span>
      </span>
      <input
        ref={ref}
        className="pis-input"
        inputMode="none"
        autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
        aria-label="Lecturas de la pistola"
        onFocus={() => setFoco(true)}
        onBlur={() => { setFoco(false); juntar(); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); juntar(); } }}
        onInput={(e) => {
          // algunos equipos mandan el Enter como salto de línea, o todo junto sin Enter
          if (/[\r\n]/.test(e.target.value)) { juntar(); return; }
          clearTimeout(timer.current);
          timer.current = setTimeout(() => { juntar(); enviar(); }, Math.max(700, espera));
        }}
      />
    </label>
  );
}

// Elegir la pieza a la que pertenece un tag leído que no estaba asociado
export function AsociarPieza({ epc, toast, onClose, onListo }) {
  useEscape(onClose);
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [busy, setBusy] = useState(null);
  const [conflicto, setConflicto] = useState(null); // { pieza, otro }
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setRes([]); return; }
    let live = true;
    const t = setTimeout(() => api('/api/precintos/piezas?q=' + encodeURIComponent(s)).then((r) => live && setRes(r)).catch(() => live && setRes([])), 250);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  async function asociar(p, reasignar = false) {
    if (!p.tag_id) { toast('Esa pieza todavía no tiene tag en Olympus'); return; }
    setBusy(p.asset_id);
    try {
      await api(`/api/precintos/tags/${p.tag_id}/epc`, { method: 'POST', body: JSON.stringify({ epc, reasignar }) });
      toast(`Tag asociado a ${p.code}`);
      onListo && onListo();
      onClose();
    } catch (e) {
      if (e.status === 409 && !reasignar) setConflicto({ pieza: p, mensaje: e.message });
      else toast(e.message);
    } finally { setBusy(null); }
  }
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="phone ds-modal">
        <div className="phone-notch" />
        <div className="phone-bar"><Link2 size={13} color="var(--t-E7C15A)" /> <span>ASOCIAR TAG A UNA PIEZA</span><button onClick={onClose} className="phone-x" aria-label="Cerrar"><X size={16} /></button></div>
        <div className="phone-screen">
          <div className="pis-epc">EPC <b>{epcLindo(epc)}</b></div>
          {conflicto ? (
            <div className="ser-aviso alerta" role="alert">
              <AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} />
              <div>
                <div>{conflicto.mensaje}. ¿Es un tag recuperado que ahora va en <b>{conflicto.pieza.code}</b>?</div>
                <div className="cor-botones" style={{ marginTop: 8 }}>
                  <button className="axt-btn small primary" onClick={() => asociar(conflicto.pieza, true)} disabled={!!busy}>Sí, pasarlo a {conflicto.pieza.code}</button>
                  <button className="axt-btn small" onClick={() => setConflicto(null)}>No</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="ds-buscar">
                <Search size={14} color="var(--t-6E6C69)" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nº de serie o descripción" aria-label="Buscar pieza" />
              </div>
              {q.trim().length < 2 && <div className="ds-sub">Escribí al menos 2 letras del Nº de serie de la pieza que tiene este tag.</div>}
              {res.map((p) => (
                <button key={p.asset_id} className="ds-row" onClick={() => asociar(p)} disabled={!!busy}>
                  <span className="ds-row-txt">
                    <span className="ds-nombre">{p.code}</span>
                    <span className="ds-lugar">{p.name} · {p.cliente}{p.ibm ? ` · IBM ${p.ibm}` : ''}{p.epc ? ' · ya tiene EPC' : ''}</span>
                  </span>
                  {busy === p.asset_id ? <Loader2 size={15} className="spin" /> : <Check size={15} color="var(--t-E7C15A)" />}
                </button>
              ))}
              {q.trim().length >= 2 && !res.length && <div className="ds-sub" style={{ padding: '12px 0' }}>No se encontró ninguna pieza.</div>}
            </>
          )}
        </div>
      </div>
    </>
  );
}

const vibrar = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* sin vibración */ } };

// Asociar el EPC de cada pieza de un informe, una tras otra, con la pistola
export function AsociarSerie({ cola: colaIni, titulo, onClose, onCambio }) {
  const [cola, setCola] = useState(() => colaIni.map((x) => ({ ...x, hecho: false })));
  const [actual, setActual] = useState(0);
  const [aviso, setAviso] = useState(null); // { tipo, texto, reasignar }
  const [busy, setBusy] = useState(false);
  const est = useRef(); est.current = { cola, actual, busy };
  const ultimoOk = useRef(0); // después de asociar, unos segundos se ignoran lecturas (el mismo tag sigue cerca)
  useEscape(onClose);

  const hechos = cola.filter((x) => x.hecho).length;
  const it = cola[actual];
  const fin = hechos === cola.length;
  const siguiente = (xs, desde) => { for (let k = 1; k <= xs.length; k++) { const j = (desde + k) % xs.length; if (!xs[j].hecho) return j; } return -1; };

  async function guardar(epc, reasignar = false) {
    const { cola: xs, actual: i } = est.current;
    const pieza = xs[i];
    setBusy(true);
    try {
      const r = await api(`/api/precintos/tags/${pieza.tag_id}/epc`, { method: 'POST', body: JSON.stringify({ epc, reasignar }) });
      vibrar(140);
      ultimoOk.current = Date.now();
      const nueva = xs.map((x, k) => (k === i ? { ...x, hecho: true, epc: r.epc } : x));
      setCola(nueva);
      const sig = siguiente(nueva, i);
      setAviso({ tipo: 'ok', texto: `✓ ${pieza.code}: tag asociado${r.antes ? ` (era de ${r.antes})` : ''}.${sig >= 0 ? ' Pasá al siguiente.' : ''}` });
      if (sig >= 0) setActual(sig);
      onCambio && onCambio();
    } catch (e) {
      vibrar([90, 60, 90]);
      if (e.status === 409 && !reasignar) setAviso({ tipo: 'alerta', texto: `${e.message}. Usá otro tag, o si es un tag recuperado, pasalo a ${pieza.code}.`, reasignar: epc });
      else setAviso({ tipo: 'error', texto: e.message });
    } finally { setBusy(false); }
  }

  function leidos(epcs) {
    if (est.current.busy || fin) return;
    if (Date.now() - ultimoOk.current < 2500) return;
    if (epcs.length > 1) {
      vibrar([90, 60, 90]);
      setAviso({ tipo: 'alerta', texto: `Se leyeron ${epcs.length} tags a la vez. Alejá las otras piezas o bajá la potencia, y apuntá solo al tag de esta pieza.` });
      return;
    }
    guardar(epcs[0]);
  }

  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <aside className="pr-panel ser" role="dialog" aria-label="Asociar EPC con la pistola">
        <div className="ser-top">
          <div style={{ minWidth: 0 }}>
            <div className="pr-eyebrow">Asociar EPC con la pistola</div>
            <div className="ser-titulo">{titulo}</div>
          </div>
          <button className="axt-x sm" onClick={onClose} aria-label="Cerrar"><X size={15} /></button>
        </div>
        <div className="ser-prog">
          <div className="pr-bar"><i style={{ width: (cola.length ? (hechos / cola.length) * 100 : 0) + '%' }} /></div>
          <span><b>{hechos}</b> de {cola.length} asociados</span>
        </div>

        {fin ? (
          <div className="ser-actual fin">
            <div className="ser-ok-big"><Check size={30} /></div>
            <div className="ser-serial">Listo</div>
            <div className="pr-muted" style={{ textAlign: 'center' }}>Todas las piezas tienen su EPC.</div>
            <button className="axt-btn primary" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>Cerrar</button>
          </div>
        ) : it && (
          <div className="ser-actual on">
            <div className="ser-ahora">Ahora</div>
            <div className="ser-serial">{it.code}</div>
            <div className="ser-desc">{it.name}</div>
            <div style={{ marginTop: 12 }}>
              <CapturaPistola onLeidos={leidos} espera={1800} texto="Apuntá al tag de esta pieza y apretá el gatillo"
                ayuda={busy ? 'Guardando…' : 'Solo ese tag: alejá las otras piezas'} />
            </div>
            {cola.length - hechos > 1 && (
              <div className="ser-botones">
                <button className="axt-btn" onClick={() => { const s = siguiente(cola, actual); if (s >= 0) { setActual(s); setAviso(null); } }}><SkipForward size={14} /> Saltear</button>
              </div>
            )}
          </div>
        )}

        {aviso && (
          <div className={'ser-aviso ' + aviso.tipo} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
            {aviso.tipo !== 'ok' && <AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} />}
            <div style={{ minWidth: 0 }}>
              <div>{aviso.texto}</div>
              {aviso.reasignar && (
                <button className="axt-btn small" style={{ marginTop: 8 }} onClick={() => guardar(aviso.reasignar, true)} disabled={busy}>Es un tag recuperado: pasarlo a {it ? it.code : 'esta pieza'}</button>
              )}
            </div>
          </div>
        )}

        <ol className="ser-lista">
          {cola.map((x, k) => (
            <li key={x.tag_id} className={'ser-item ' + (x.hecho ? 'grabado' : 'pendiente') + (k === actual && !x.hecho ? ' actual' : '')}>
              <button type="button" className="ser-item-btn" disabled={x.hecho} onClick={() => { setActual(k); setAviso(null); }}>
                <span className="ser-marca">{x.hecho ? <Check size={14} /> : k + 1}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="ser-item-serial">{x.code}</span>
                  <span className="ser-item-desc">{x.hecho ? epcLindo(x.epc) : x.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </>
  );
}
