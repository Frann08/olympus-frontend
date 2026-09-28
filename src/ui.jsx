import React, { useState, useEffect } from 'react';
import { CheckCircle2, X, Loader2, AlertTriangle, Download } from 'lucide-react';

/* ---------- estado / formato ---------- */
export const STATUS = {
  certified: { label: 'Vigente',    color: '#4FC98B', band: 'solid' },
  due:       { label: 'Por vencer', color: '#EDA53C', band: 'amber' },
  overdue:   { label: 'Vencido',    color: '#E5605C', band: 'red' },
  sin_cert:  { label: 'Sin certificados', color: '#727E8B', band: 'gray' },
  anterior:  { label: 'Anterior', color: '#727E8B', band: 'gray' },
};
const MONTHS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
export const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  return `${String(x.getUTCDate()).padStart(2,'0')} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};
export const daysFrom = (d) => Math.round((new Date(d) - new Date()) / 86400000);
export const daysLabel = (d) => {
  if (d == null) return '—';
  const n = daysFrom(d);
  return n < 0 ? `${Math.abs(n)} d vencido` : n === 0 ? 'vence hoy' : `en ${n} d`;
};

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
    <span className="axt-pill" style={{ color: s.color, borderColor: s.color + '55', background: s.color + '16' }}>
      <span style={{ width: 6, height: 6, borderRadius: 6, background: s.color, display: 'inline-block' }} />{s.label}
    </span>
  );
}

export function EncChip({ ok, label }) {
  return (
    <span className="enc" style={{ color: ok ? '#4FC98B' : '#7A8792', borderColor: ok ? '#4A3E1E' : '#322D38', background: ok ? '#1B1609' : '#171419' }}>
      {ok ? <CheckCircle2 size={12} /> : <X size={12} />} {label}
    </span>
  );
}

export function StatTile({ label, value, sub, color, icon: Icon, i = 0 }) {
  return (
    <div className="axt-card axt-tile" style={{ animationDelay: `${i * 55}ms` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ font: '500 12px "IBM Plex Sans"', color: '#8B98A5' }}>{label}</span>
        {Icon && <Icon size={16} color={color} />}
      </div>
      <div style={{ font: '700 30px "Oswald", sans-serif', color: '#EAF0F3', marginTop: 10, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ font: '500 11px "IBM Plex Mono", monospace', color, marginTop: 7 }}>{sub}</div>}
    </div>
  );
}

export function CertRow({ c, last, onDownload }) {
  const isInsp = !!(c.resultado || c.precinto || c.cert_type === 'Inspección');
  const resColor = c.resultado === 'NO APTO' ? '#E5605C' : c.resultado === 'APTO' ? '#4FC98B' : '#8B98A5';
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: last ? 'none' : '1px solid #201C24' }}>
      <Band status={c.status} h={onDownload || c.pdf_url ? 58 : 40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ font: '600 13px "IBM Plex Sans"', color: '#EAF0F3' }}>{isInsp ? `Inspección · Informe ${c.number}` : c.cert_type}</span>
          {c.resultado && <span style={{ font: '600 10.5px "IBM Plex Sans"', color: resColor, border: `1px solid ${resColor}55`, background: resColor + '16', padding: '1px 7px', borderRadius: 20 }}>{c.resultado}</span>}
        </div>
        <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#7A8792', marginTop: 3 }}>
          {isInsp ? (c.inspector || '') : `${c.number}${c.inspector ? ` · ${c.inspector}` : ''}`}{c.presion ? ` · ${c.presion}` : ''}
        </div>
        {c.precinto && c.precinto !== 'N/A' && (
          <div style={{ font: '400 10.5px "IBM Plex Mono", monospace', color: '#8A7A55', marginTop: 4, wordBreak: 'break-all' }}>Precinto: {c.precinto}</div>
        )}
        <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ font: '400 11px "IBM Plex Sans"', color: '#8B98A5' }}>Emitido {fmtDate(c.issued_date)}</span>
          <span style={{ font: '400 11px "IBM Plex Sans"', color: '#8B98A5' }}>Vence {fmtDate(c.expires_date)}</span>
        </div>
        {c.pdf_url ? (
          <a className="axt-btn small" style={{ marginTop: 9, textDecoration: 'none', display: 'inline-flex' }} href={c.pdf_url} target="_blank" rel="noreferrer"><Download size={13} /> Ver informe (BM)</a>
        ) : onDownload ? (
          <button className="axt-btn small" style={{ marginTop: 9 }} onClick={onDownload}><Download size={13} /> Descargar PDF</button>
        ) : null}
      </div>
      <div style={{ textAlign: 'right' }}>
        <Pill status={c.status} />
        <div style={{ font: '600 12px "IBM Plex Mono", monospace', color: (STATUS[c.status] || STATUS.sin_cert).color, marginTop: 5 }}>
          {c.status === 'anterior' ? 'reemplazada' : daysLabel(c.expires_date)}
        </div>
      </div>
    </div>
  );
}

export function Spinner({ label = 'Cargando…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '48px 0', color: '#7A8792' }}>
      <Loader2 size={18} className="spin" />
      <span style={{ font: '500 13px "IBM Plex Sans"' }}>{label}</span>
    </div>
  );
}

export function ErrorNote({ error }) {
  return (
    <div className="axt-card" style={{ padding: 18, display: 'flex', gap: 10, alignItems: 'flex-start', borderColor: '#3A1E1D' }}>
      <AlertTriangle size={16} color="#E5605C" style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ font: '500 13px "IBM Plex Sans"', color: '#E5A3A1' }}>
        {error}
        <div style={{ font: '400 12px "IBM Plex Sans"', color: '#8B98A5', marginTop: 4 }}>
          ¿El backend está corriendo? Verificá <code>VITE_API_BASE</code> y que la API responda en <code>/api/health</code>.
        </div>
      </div>
    </div>
  );
}

export function Toast({ msg }) {
  return <div className="axt-toast"><CheckCircle2 size={16} color="#4FC98B" /> {msg}</div>;
}
