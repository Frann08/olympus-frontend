import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, Loader2, AlertTriangle, Download, FileText } from 'lucide-react';

/* ---------- estado / formato ---------- */
export const STATUS = {
  certified: { label: 'Vigente',    color: 'var(--st-ok)', band: 'solid' },
  due:       { label: 'Por vencer', color: 'var(--st-due)', band: 'amber' },
  overdue:   { label: 'Vencido',    color: 'var(--st-bad)', band: 'red' },
  sin_cert:  { label: 'Sin certificados', color: 'var(--st-gris)', band: 'gray' },
  anterior:  { label: 'Anterior', color: 'var(--st-gris)', band: 'gray' },
  no_apto:   { label: 'No apto', color: 'var(--st-bad)', band: 'red' },
};
// Color con transparencia (sirve con variables de tema): tinte(c, 33) = c al 33 %
export const tinte = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;

const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
export const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2,'0')} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};
// Días de calendario entre hoy (hora del teléfono) y una fecha 'YYYY-MM-DD'.
// Así el último día de vigencia dice "vence hoy" todo el día, no "1 d vencido".
export const daysFrom = (d) => {
  const f = Date.parse(String(d).slice(0, 10));
  const h = new Date();
  return Math.round((f - Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())) / 86400000);
};
export const esNoApto = (c) => String(c?.resultado || '').trim().toUpperCase() === 'NO APTO';
export const daysLabel = (d) => {
  if (d == null) return '—';
  const n = daysFrom(d);
  return n < 0 ? `${Math.abs(n)} d vencido` : n === 0 ? 'vence hoy' : `en ${n} d`;
};

/* ---------- cerrar ventanas con Escape o con "Atrás" del celular ----------
   Cada ventana abierta (panel, ficha, modal) suma una entrada al historial del navegador:
   el botón o gesto "Atrás" del celular cierra la de arriba en vez de salir de Olympus.
   Sin ventanas abiertas, "Atrás" va a la pestaña anterior (useAtrasNivel) y, al final,
   pide un segundo "Atrás" para salir. Escape cierra solo la ventana de arriba. */
const ventanas = []; // { cerrar: ref, vivo, enHistoria }
const niveles = []; // funciones que devuelven true si manejaron el "Atrás" (pestaña anterior, etc.)
let base = null; // el de la app (pestañas de Administración, volver al portal): se prueba al final
let ignorar = 0; // "popstate" que provocamos nosotros al sacar entradas
let porSacar = 0; // entradas a sacar del historial (se juntan en una sola vuelta)
const enCola = []; // ventanas que esperan que termine de sacarse una entrada para sumar la suya
let guardia = false; // entrada extra para que el primer "Atrás" sin ventanas no salga de Olympus
let escuchando = false;

const empujar = (v) => {
  if (ignorar || porSacar) { enCola.push(v); return; }
  try { window.history.pushState({ ot: 1 }, ''); v.enHistoria = true; } catch { /* sin historial */ }
};
const armarGuardia = () => {
  if (guardia || !(base || niveles.length) || ventanas.length || ignorar || porSacar) return;
  try { window.history.pushState({ ot: 'g' }, ''); guardia = true; } catch { /* sin historial */ }
};
function escuchar() {
  if (escuchando) return;
  escuchando = true;
  window.addEventListener('popstate', () => {
    if (ignorar) {
      ignorar--;
      if (!ignorar) enCola.splice(0).forEach((v) => v.vivo && empujar(v));
      return;
    }
    const v = ventanas[ventanas.length - 1];
    if (v && v.enHistoria) {
      v.enHistoria = false;
      v.cerrar.current && v.cerrar.current();
      // si la ventana no se cerró (p. ej. está enviando algo), vuelve a ocupar su lugar
      setTimeout(() => { if (v.vivo && !v.enHistoria) empujar(v); }, 0);
      return;
    }
    guardia = false;
    const fns = [...niveles].reverse().concat(base ? [base] : []);
    for (const f of fns) {
      if (f.current && f.current()) { armarGuardia(); return; }
    }
    // ya no hay nada para volver: el próximo "Atrás" sale (se vuelve a armar al tocar la pantalla)
    window.dispatchEvent(new CustomEvent('ot:atras-salir'));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const v = ventanas[ventanas.length - 1];
    if (v && v.cerrar.current) v.cerrar.current();
  });
  // la guardia se arma con un toque del usuario (Chrome ignora entradas agregadas sin tocar nada)
  window.addEventListener('pointerdown', armarGuardia, true);
}

export function useEscape(onClose, activo = true) {
  const ref = React.useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    if (!activo) return undefined;
    escuchar();
    const v = { cerrar: ref, vivo: true, enHistoria: false };
    ventanas.push(v);
    empujar(v);
    return () => {
      v.vivo = false;
      const i = ventanas.indexOf(v);
      if (i >= 0) ventanas.splice(i, 1);
      const j = enCola.indexOf(v);
      if (j >= 0) enCola.splice(j, 1);
      if (!v.enHistoria) return; // ya se sacó con "Atrás"
      v.enHistoria = false;
      // se cerró con la X o Escape: sacar su entrada del historial (todas las que se cierren juntas, de una vez)
      if (!porSacar) queueMicrotask(() => { const n = porSacar; porSacar = 0; ignorar++; window.history.go(-n); });
      porSacar++;
    };
  }, [activo]);
}

// El de toda la app: se usa cuando ninguna pantalla manejó el "Atrás". Sin él no se frena la salida.
export function useAtrasBase(fn, activo = true) {
  const ref = React.useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!activo) return undefined;
    escuchar();
    base = ref;
    return () => { if (base === ref) base = null; };
  }, [activo]);
}

// Pantallas con pestañas: "Atrás" vuelve a la pestaña anterior. fn devuelve true si hizo algo.
export function useAtrasNivel(fn) {
  const ref = React.useRef(fn);
  ref.current = fn;
  useEffect(() => {
    escuchar();
    niveles.push(ref);
    return () => { const i = niveles.indexOf(ref); if (i >= 0) niveles.splice(i, 1); };
  }, []);
}

/* ---------- hook de carga ---------- */
export function useData(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.resolve(fn())
      .then((d) => live && setState({ loading: false, error: null, data: d }))
      .catch((e) => live && setState({ loading: false, error: e.message, data: null }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/* ---------- búsqueda y listas largas ---------- */
// para buscar sin importar mayúsculas ni tildes
export const sinTildes = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Las listas largas se dibujan de a tandas. Vuelve a la primera tanda cuando cambian la búsqueda o los filtros.
export const TANDA = 50;
export function useTanda(...claves) {
  const [n, setN] = useState(TANDA);
  const clave = JSON.stringify(claves);
  useEffect(() => { setN(TANDA); }, [clave]);
  return [n, (todo) => setN((x) => (todo === true ? Infinity : x + TANDA))];
}

export function MostrarMas({ total, visibles, onMas }) {
  if (total <= visibles) return null;
  const quedan = total - visibles;
  return (
    <div className="gs-mas">
      <span>Mostrando {visibles} de {total}</span>
      <button className="axt-btn small" onClick={() => onMas()}>Mostrar {Math.min(TANDA, quedan)} más</button>
      {quedan > TANDA && <button className="axt-btn small" onClick={() => onMas(true)}>Ver todos</button>}
    </div>
  );
}

/* ---------- componentes ---------- */
export function Band({ status, h = 26 }) {
  const s = STATUS[status] || STATUS.sin_cert;
  const cls = s.band === 'amber' ? 'hz-amber' : s.band === 'red' ? 'hz-red' : '';
  const style = s.band === 'solid' || s.band === 'gray' ? { background: s.color } : {};
  return <span className={'axt-band ' + cls} style={{ height: h, ...style }} />;
}

export function Pill({ status }) {
  const s = STATUS[status] || STATUS.sin_cert;
  return (
    <span className="axt-pill" style={{ color: s.color, borderColor: tinte(s.color, 33.3), background: tinte(s.color, 8.6) }}>
      <span style={{ width: 6, height: 6, borderRadius: 6, background: s.color, display: 'inline-block' }} />{s.label}
    </span>
  );
}

export function EncChip({ ok, label }) {
  return (
    <span className="enc" style={{ color: ok ? 'var(--t-4FC98B)' : 'var(--t-7A8792)', borderColor: ok ? 'var(--b-4A3E1E)' : 'var(--b-322D38)', background: ok ? 'var(--s-1B1609)' : 'var(--s-171419)' }}>
      {ok ? <CheckCircle2 size={12} /> : <X size={12} />} {label}
    </span>
  );
}

export function StatTile({ label, value, sub, color, icon: Icon, i = 0 }) {
  return (
    <div className="axt-card axt-tile" style={{ animationDelay: `${i * 55}ms` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ font: '500 12px "IBM Plex Sans"', color: 'var(--t-8B98A5)' }}>{label}</span>
        {Icon && <Icon size={16} color={color} />}
      </div>
      <div style={{ font: '700 30px "Oswald", sans-serif', color: 'var(--t-EAF0F3)', marginTop: 10, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ font: '500 11px "IBM Plex Mono", monospace', color, marginTop: 7 }}>{sub}</div>}
    </div>
  );
}

const VisorInforme = React.lazy(() => import('./VisorInforme.jsx'));

export function CertRow({ c, last, onDownload }) {
  const [verInforme, setVerInforme] = React.useState(false);
  const conDoc = !c.pdf_url && c.informe_doc;
  const isInsp = !!(c.resultado || c.precinto || c.cert_type === 'Inspección');
  const resColor = c.resultado === 'NO APTO' ? 'var(--t-E5605C)' : c.resultado === 'APTO' ? 'var(--t-4FC98B)' : 'var(--t-8B98A5)';
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: last ? 'none' : '1px solid var(--b-201C24)' }}>
      <Band status={c.status} h={onDownload || c.pdf_url || conDoc ? 58 : 40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ font: '600 13px "IBM Plex Sans"', color: 'var(--t-EAF0F3)' }}>{isInsp ? `Inspección · Informe ${c.number}` : c.cert_type}</span>
          {c.resultado && <span style={{ font: '600 10.5px "IBM Plex Sans"', color: resColor, border: `1px solid ${tinte(resColor, 33.3)}`, background: tinte(resColor, 8.6), padding: '1px 7px', borderRadius: 20 }}>{c.resultado}</span>}
        </div>
        <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-7A8792)', marginTop: 3 }}>
          {isInsp ? (c.inspector || '') : `${c.number}${c.inspector ? ` · ${c.inspector}` : ''}`}{c.presion ? ` · ${c.presion}` : ''}
        </div>
        {c.precinto && c.precinto !== 'N/A' && (
          <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-8A7A55)', marginTop: 4, overflowWrap: 'anywhere' }}>Precinto: {c.precinto}</div>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ font: '400 11px "IBM Plex Sans"', color: 'var(--t-8B98A5)' }}>Emitido {fmtDate(c.issued_date)}</span>
          <span style={{ font: '400 11px "IBM Plex Sans"', color: 'var(--t-8B98A5)' }}>Vence {fmtDate(c.expires_date)}</span>
        </div>
        {c.pdf_url ? (
          <a className="axt-btn small" style={{ marginTop: 9, textDecoration: 'none', display: 'inline-flex' }} href={c.pdf_url} target="_blank" rel="noreferrer"><Download size={13} /> Ver informe (BM)</a>
        ) : conDoc ? (
          <button className="axt-btn small" style={{ marginTop: 9 }} onClick={() => setVerInforme(true)}><FileText size={13} /> Ver informe</button>
        ) : onDownload ? (
          <button className="axt-btn small" style={{ marginTop: 9 }} onClick={onDownload}><Download size={13} /> Descargar PDF</button>
        ) : null}
      </div>
      <div style={{ textAlign: 'right' }}>
        <Pill status={c.status} />
        <div style={{ font: '600 12px "IBM Plex Mono", monospace', color: (STATUS[c.status] || STATUS.sin_cert).color, marginTop: 5 }}>
          {c.status === 'anterior' ? 'reemplazada' : c.status === 'no_apto' ? 'no habilitada' : daysLabel(c.expires_date)}
        </div>
      </div>
      {verInforme && (
        <React.Suspense fallback={<div className="vi"><div className="vi-estado"><Spinner /></div></div>}>
          <VisorInforme numero={c.informe_doc.numero} ibm={c.informe_doc.ibm} onClose={() => setVerInforme(false)} />
        </React.Suspense>
      )}
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 0', color: 'var(--t-7A8792)' }}>
      <Loader2 size={18} className="spin" />
      <span style={{ font: '500 13px "IBM Plex Sans"' }}>{label}</span>
    </div>
  );
}

export function ErrorNote({ error }) {
  return (
    <div className="axt-card" style={{ padding: 18, display: 'flex', gap: 10, alignItems: 'flex-start', borderColor: 'var(--b-3A1E1D)' }}>
      <AlertTriangle size={16} color="var(--t-E5605C)" style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ font: '500 13px "IBM Plex Sans"', color: 'var(--t-E5A3A1)' }}>
        {error}
        {import.meta.env.DEV && (
          <div style={{ font: '400 12px "IBM Plex Sans"', color: 'var(--t-8B98A5)', marginTop: 4 }}>
            ¿El backend está corriendo? Verificá <code>VITE_API_BASE</code> y que la API responda en <code>/api/health</code>.
          </div>
        )}
      </div>
    </div>
  );
}

export function Toast({ msg }) {
  return <div className="axt-toast" role="status" aria-live="polite"><CheckCircle2 size={16} color="var(--t-4FC98B)" /> {msg}</div>;
}
