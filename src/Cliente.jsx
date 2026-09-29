import React, { useState, useEffect, useRef } from 'react';
import {
  Building2, Smartphone, ChevronRight, Radio, X, Wifi, WifiOff, RefreshCw,
  ScanLine, ClipboardList, CheckCircle2, Plus, Trash2, Loader2, History, ExternalLink, Save, Search, FileDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from './api.js';
import { getUser } from './api.js';
import { Band, Pill, CertRow, Spinner, ErrorNote, daysLabel, daysFrom, esNoApto, useEscape } from './ui.jsx';
import { saveBundle, loadBundle, bundleAt, getQueue, saveQueue, useOnline, agoLabel } from './offline.js';

const DUE = 60;
// Estado de una inspección: NO APTO manda; si no, según los días que faltan para vencer
const cstat = (c) => {
  if (esNoApto(c)) return 'no_apto';
  const d = daysFrom(c.expires_date);
  return d < 0 ? 'overdue' : d <= DUE ? 'due' : 'certified';
};
// Una inspección reemplazada por otra más nueva (vigente === false) queda como historial
const withStatus = (certs) => (certs || []).map((c) => ({ ...c, status: c.vigente === false ? 'anterior' : cstat(c) }));
const astat = (certs) => {
  const s = (certs || []).filter((c) => c.vigente !== false).map(cstat);
  return s.includes('no_apto') ? 'no_apto' : s.includes('overdue') ? 'overdue' : s.includes('due') ? 'due' : s.length ? 'certified' : 'sin_cert';
};

export default function Cliente({ toast }) {
  const user = getUser();
  const online = useOnline();
  const [bundle, setBundle] = useState(() => loadBundle());
  const [loading, setLoading] = useState(!loadBundle());
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(bundleAt());
  const [modalAsset, setModalAsset] = useState(null);
  const [q, setQ] = useState('');
  const [fEstado, setFEstado] = useState('all');
  const [fIbm, setFIbm] = useState('all');
  const [tab, setTab] = useState('activos');

  useEffect(() => {
    let live = true;
    if (!online) { setLoading(false); return; }
    api('/api/me/bundle')
      .then((data) => {
        if (!live) return;
        saveBundle(data);
        setBundle(data);
        setUpdatedAt(Date.now());
        setError(null);
        setLoading(false);
      })
      .catch((e) => { if (live) { setError(e.message); setLoading(false); } });
    return () => { live = false; };
  }, [online]);

  if (loading) return <Spinner label="Cargando tus activos…" />;
  if (!bundle) return (
    <div style={{ padding: '10px 0' }}>
      <ErrorNote error={error || 'Todavía no hay datos descargados.'} />
      <div style={{ font: '500 13px "IBM Plex Sans"', color: 'var(--t-8B98A5)', marginTop: 12, textAlign: 'center' }}>
        Conectate a internet una vez para descargar tus activos. Después funciona sin señal.
      </div>
    </div>
  );

  const lista = Array.isArray(bundle) ? bundle : [];
  const assets = lista.map((a) => ({ ...a, certificates: withStatus(a.certificates), status: astat(a.certificates) }))
    .sort((a, b) => (a.next_expiry || '9999').localeCompare(b.next_expiry || '9999'));
  const allCerts = assets.flatMap((a) => a.certificates).filter((c) => c.status !== 'anterior' && c.status !== 'no_apto');
  const summary = {
    overdue: allCerts.filter((c) => daysFrom(c.expires_date) < 0).length,
    due30: allCerts.filter((c) => { const d = daysFrom(c.expires_date); return d >= 0 && d <= 30; }).length,
    due90: allCerts.filter((c) => { const d = daysFrom(c.expires_date); return d > 30 && d <= 90; }).length,
    noApto: assets.filter((a) => a.status === 'no_apto').length,
  };

  const ibms = [...new Set(assets.map((a) => a.ibm).filter(Boolean))];
  const qn = q.trim().toLowerCase();
  const filtered = assets.filter((a) => {
    if (fEstado !== 'all' && a.status !== fEstado) return false;
    if (fIbm !== 'all' && String(a.ibm || '') !== fIbm) return false;
    if (qn) {
      const inText = (a.code || '').toLowerCase().includes(qn)
        || (a.name || '').toLowerCase().includes(qn)
        || (a.certificates || []).some((c) => String(c.number || '').toLowerCase().includes(qn));
      if (!inText) return false;
    }
    return true;
  });
  const EST = [['all', 'Todos'], ['certified', 'Vigentes'], ['due', 'Por vencer'], ['overdue', 'Vencidos'],
    ...(summary.noApto ? [['no_apto', 'No aptos']] : [])];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--s-2A2410)', border: '1px solid var(--b-4A3E1E)', display: 'grid', placeItems: 'center' }}>
            <Building2 size={20} color="var(--t-D9B44A)" />
          </div>
          <div>
            <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-6A7681)' }}>SESIÓN DE CLIENTE</div>
            <div style={{ font: '700 18px "Oswald", sans-serif', color: 'var(--t-EAF0F3)' }}>{user?.name || 'Cliente'}</div>
          </div>
        </div>
        <div className={'net-pill ' + (online ? 'on' : 'off')}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online ? 'En línea' : 'Sin conexión'}
        </div>
      </div>

      <div className="cli-tabs">
        <button className={'cli-tab' + (tab === 'activos' ? ' on' : '')} onClick={() => setTab('activos')}>Mis activos</button>
        <button className={'cli-tab' + (tab === 'relevamientos' ? ' on' : '')} onClick={() => setTab('relevamientos')}>Relevamientos</button>
      </div>

      {tab === 'relevamientos' ? (
        <Relevamiento assets={assets} online={online} toast={toast} />
      ) : (
      <>
        <ExpiringCard s={summary} />

      <div className="axt-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
        <div className="axt-toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
          <span style={{ font: '700 15px "Oswald"', color: 'var(--t-F3F1EC)' }}>Tus activos</span>
          <div className="search cli-buscar" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s-0F0E12)', border: '1px solid var(--b-26262B)', borderRadius: 8, padding: '7px 11px', flex: 1, minWidth: 180, maxWidth: 340 }}>
            <Search size={14} color="var(--t-6E6C69)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por serie, descripción o informe"
              style={{ border: 'none', outline: 'none', background: 'transparent', color: 'var(--t-F3F1EC)', font: '400 13px "IBM Plex Sans"', width: '100%' }} />
            {q && <button className="axt-x sm" onClick={() => setQ('')} aria-label="Borrar búsqueda"><X size={13} /></button>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', padding: '0 16px 14px' }}>
          {EST.map(([v, l]) => (
            <button key={v} onClick={() => setFEstado(v)} className={'fchip' + (fEstado === v ? ' on' : '')}>{l}</button>
          ))}
          {ibms.length > 1 && <span style={{ width: 1, background: 'var(--s-26262B)', margin: '2px 4px' }} />}
          {ibms.length > 1 && <button onClick={() => setFIbm('all')} className={'fchip' + (fIbm === 'all' ? ' on' : '')}>Todos los IBM</button>}
          {ibms.length > 1 && ibms.map((ib) => (
            <button key={ib} onClick={() => setFIbm(ib)} className={'fchip' + (fIbm === ib ? ' on' : '')}>IBM {ib}</button>
          ))}
        </div>

        <div style={{ padding: '0 16px 8px', font: '500 11.5px "IBM Plex Mono", monospace', color: 'var(--t-6E6C69)' }}>
          {filtered.length} de {assets.length} · datos {agoLabel(updatedAt)}
        </div>

        <div>
          {filtered.map((a) => (
            <button key={a.id} className="cli-row" onClick={() => setModalAsset(a)}>
              <Band status={a.status} h={42} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ font: '600 13px "IBM Plex Sans"', color: 'var(--t-F3F1EC)' }}>{a.name}</div>
                <div style={{ font: '400 11px "IBM Plex Sans"', color: 'var(--t-8A97A2)', marginTop: 2 }}>{a.code}{a.ibm ? ` · IBM ${a.ibm}` : ''} · {a.certificates.length} {a.certificates.length === 1 ? 'inspección' : 'inspecciones'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Pill status={a.status} />
                <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-8A97A2)', marginTop: 4 }}>{a.status === 'no_apto' ? 'no habilitada' : daysLabel(a.next_expiry)}</div>
              </div>
              <ChevronRight size={16} color="var(--t-5C6874)" />
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '28px 16px', textAlign: 'center', font: '500 13px "IBM Plex Sans"', color: 'var(--t-6E6C69)' }}>
              No hay activos que coincidan con el filtro.
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {modalAsset && <CertModal asset={modalAsset} onClose={() => setModalAsset(null)} toast={toast} />}
    </div>
  );
}

function ExpiringCard({ s }) {
  const total = s.overdue + s.due30 + s.due90;
  return (
    <div className="axt-card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '4px 12px', flexWrap: 'wrap' }}>
        <div className="axt-card-title" style={{ margin: 0 }}>Tus certificaciones por vencer</div>
        <span style={{ font: '500 11px "IBM Plex Mono", monospace', color: 'var(--t-7A8792)' }}>próximos 90 días</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '14px 0 6px' }}>
        <span style={{ font: '700 46px "Oswald", sans-serif', color: total ? 'var(--t-EDA53C)' : 'var(--t-4FC98B)' }}>{total}</span>
        <span style={{ font: '500 13px "IBM Plex Sans"', color: 'var(--t-9AA6B1)' }}>certificados requieren atención</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, margin: '16px 0 4px' }}>
        {[['Vencidos', s.overdue, 'var(--t-E5605C)'], ['≤ 30 días', s.due30, 'var(--t-EDA53C)'], ['31–90 días', s.due90, 'var(--t-D9B44A)']].map(([l, v, c]) => (
          <div key={l} style={{ background: 'var(--s-171419)', border: '1px solid var(--b-2A2732)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ font: '700 24px "Oswald"', color: c }}>{v}</div>
            <div style={{ font: '500 11px "IBM Plex Sans"', color: 'var(--t-8B98A5)', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
      {s.noApto > 0 && (
        <div style={{ marginTop: 12, font: '600 12.5px "IBM Plex Sans"', color: 'var(--st-bad)' }}>
          {s.noApto} {s.noApto === 1 ? 'pieza NO APTA' : 'piezas NO APTAS'} en la última inspección
        </div>
      )}
    </div>
  );
}

// ---- Relevamiento de campo: escanear offline, armar lista, sincronizar ----
function Relevamiento({ assets, online, toast }) {
  const [queue, setQueue] = useState(() => getQueue());
  const [scanning, setScanning] = useState(false);
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState('');
  const [hist, setHist] = useState([]);
  const [histError, setHistError] = useState(false);
  const [detail, setDetail] = useState(null);
  // La lista vive en una ref además del estado: el lector NFC queda escuchando y
  // cada lectura tiene que sumar a la lista ACTUAL (no a la que había al empezar).
  const queueRef = useRef(queue);
  const setQ = (nq) => { queueRef.current = nq; setQueue(nq); saveQueue(nq); };

  const loadHist = () => {
    if (!online) { setHistError(true); return; }
    api('/api/me/relevamientos').then((h) => { setHist(h); setHistError(false); }).catch(() => setHistError(true));
  };
  useEffect(loadHist, [online]);

  const addToken = (token) => {
    const actual = queueRef.current;
    const a = assets.find((x) => x.token === token);
    if (actual.some((i) => i.token === token)) { toast('Ese tag ya está en esta lista'); return; }
    setQ([...actual, { token, name: a ? a.name : 'Pieza no encontrada en tus activos', status: a ? a.status : 'sin_cert', scanned_at: new Date().toISOString() }]);
    toast(a ? 'Agregado: ' + a.name : 'Tag sin pieza asociada en tus activos');
  };
  const addRef = useRef(addToken);
  addRef.current = addToken;

  // Un solo lector a la vez; se apaga al tocar de nuevo o al salir de la pantalla
  const lectorRef = useRef(null);
  const pararScan = () => { if (lectorRef.current) lectorRef.current.abort(); lectorRef.current = null; setScanning(false); };
  useEffect(() => () => { if (lectorRef.current) lectorRef.current.abort(); }, []);

  async function scan() {
    if (lectorRef.current) { pararScan(); return; }
    if (!('NDEFReader' in window)) { setPicker(true); return; }
    const ctrl = new AbortController();
    try {
      const reader = new window.NDEFReader();
      await reader.scan({ signal: ctrl.signal });
      lectorRef.current = ctrl;
      setScanning(true);
      reader.onreading = (ev) => {
        let url = null;
        for (const rec of ev.message.records) {
          try { const txt = new TextDecoder().decode(rec.data); if (txt && txt.indexOf('tag=') !== -1) url = txt; } catch { /* noop */ }
        }
        const m = url && url.match(/tag=([A-Za-z0-9]+)/);
        if (m) addRef.current(m[1]); else toast('Ese tag no es de Olympus');
      };
      reader.onreadingerror = () => toast('No se pudo leer el tag, acercalo de nuevo');
    } catch (e) {
      ctrl.abort();
      lectorRef.current = null;
      setScanning(false);
      toast(e && e.name === 'NotAllowedError' ? 'Permití el uso de NFC para escanear' : 'No se pudo activar el NFC: revisá que esté prendido');
      setPicker(true);
    }
  }

  async function guardar() {
    if (!online) { toast('Necesitás conexión para guardar'); return; }
    if (!queue.length) return;
    setSaving(true);
    try {
      const r = await api('/api/me/relevamientos', {
        method: 'POST',
        body: JSON.stringify({ nombre: nombre.trim(), device: (navigator.userAgent || '').slice(0, 40), items: queue.map((i) => ({ token: i.token, scanned_at: i.scanned_at })) }),
      });
      toast('Relevamiento guardado: ' + r.count + ' piezas');
      setQ([]); setNombre(''); loadHist();
    } catch (e) { toast('Error al guardar: ' + e.message); }
    finally { setSaving(false); }
  }

  async function exportar(h) {
    try {
      const d = await api('/api/me/relevamientos/' + h.id);
      const rows = d.items.map((it) => ({
        'Nº de serie': it.code || it.token || '',
        'Descripción': it.name || '',
        'IBM': it.ibm || '',
        'Estado': it.status === 'no_apto' ? 'No apto' : estadoLabel(it.next_expiry),
        'Vencimiento': vencMMAAAA(it.next_expiry),
        'Nº de informe': it.informe || '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'relevamiento');
      const base = (h.nombre || ('relevamiento-' + h.id)).replace(/[^\w\-]+/g, '_');
      XLSX.writeFile(wb, base + '.xlsx');
    } catch (e) { toast('No se pudo exportar: ' + e.message); }
  }

  async function borrar(h) {
    if (!window.confirm(`¿Borrar la lista "${h.nombre || 'sin nombre'}"? No se puede deshacer.`)) return;
    try { await api('/api/me/relevamientos/' + h.id, { method: 'DELETE' }); toast('Lista borrada'); loadHist(); }
    catch (e) { toast('No se pudo borrar: ' + e.message); }
  }

  return (
    <div>
      <div className="axt-card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <ClipboardList size={16} color="var(--t-E7C15A)" />
          <span style={{ font: '600 15px "Oswald", sans-serif', color: 'var(--t-F3F1EC)' }}>Nuevo relevamiento</span>
        </div>
        <div style={{ font: '400 11.5px "IBM Plex Sans"', color: 'var(--t-8A97A2)', marginBottom: 14, lineHeight: 1.5 }}>
          Escaneá los tags que tenés enfrente, ponele un nombre y guardá. Cada lista es tuya y queda abajo en "Listas guardadas".
        </div>

        <button className="axt-btn primary" onClick={scan} style={{ marginBottom: 12, width: '100%' }}>
          <ScanLine size={15} /> {scanning ? 'Escaneando… acercá cada tag (tocá para terminar)' : 'Escanear tag'}
        </button>

        {queue.length === 0 ? (
          <div style={{ font: '500 12px "IBM Plex Sans"', color: 'var(--t-6E6C69)', textAlign: 'center', padding: '10px 0' }}>Lista actual vacía.</div>
        ) : (
          <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 12 }}>
            {queue.map((it, i) => (
              <div key={it.token + i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: '1px solid var(--b-1F1F23)' }}>
                <Band status={it.status} h={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: '600 12.5px "IBM Plex Sans"', color: 'var(--t-F3F1EC)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
                </div>
                <button className="axt-x sm" onClick={() => setQ(queueRef.current.filter((x) => x.token !== it.token))} aria-label={'Quitar ' + it.name}><X size={14} /></button>
              </div>
            ))}
          </div>
        )}

        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la lista (ej: Locación Fortín)"
          style={{ width: '100%', background: 'var(--s-0F0E12)', border: '1px solid var(--b-26262B)', borderRadius: 8, padding: '10px 12px', color: 'var(--t-F3F1EC)', font: '400 13px "IBM Plex Sans"', marginBottom: 10, outline: 'none' }} />

        <button className="axt-btn primary" onClick={guardar} disabled={!queue.length || saving} style={{ width: '100%', opacity: queue.length && online ? 1 : 0.55 }}>
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
          {online ? `Guardar relevamiento (${queue.length})` : `Guardá al recuperar señal (${queue.length})`}
        </button>
      </div>

      <div className="axt-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="axt-toolbar">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, font: '700 15px "Oswald"', color: 'var(--t-F3F1EC)' }}><History size={15} color="var(--t-8A97A2)" /> Listas guardadas</span>
          <span style={{ font: '500 12px "IBM Plex Mono", monospace', color: 'var(--t-8A97A2)' }}>{hist.length}</span>
        </div>
        {hist.length === 0 ? (
          <div style={{ padding: '28px 16px', textAlign: 'center', font: '500 13px "IBM Plex Sans"', color: 'var(--t-6E6C69)' }}>
            {histError ? 'Las listas guardadas se ven con conexión a internet.' : 'Todavía no guardaste ninguna lista.'}
          </div>
        ) : hist.map((h) => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderBottom: '1px solid var(--b-1F1F23)' }}>
            <button onClick={() => api('/api/me/relevamientos/' + h.id).then(setDetail).catch(() => toast('No se pudo abrir'))}
              style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
              <div style={{ font: '600 13.5px "IBM Plex Sans"', color: 'var(--t-F3F1EC)' }}>{h.nombre || 'Sin nombre'}</div>
              <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-8A97A2)', marginTop: 3 }}>{h.items} {h.items === 1 ? 'pieza' : 'piezas'} · {fmtDateTime(h.created_at)}</div>
            </button>
            <button className="axt-btn small" onClick={() => exportar(h)}><FileDown size={13} /> Excel</button>
            <button className="axt-x sm" title="Borrar" onClick={() => borrar(h)}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      {picker && <Picker assets={assets} onPick={(t) => { addToken(t); }} onClose={() => setPicker(false)} />}
      {detail && <RelevDetail data={detail} onClose={() => setDetail(null)} toast={toast} />}
    </div>
  );
}

function estadoLabel(exp) {
  if (!exp) return 'Sin dato';
  const d = daysFrom(exp);
  return d < 0 ? 'Vencido' : d <= 60 ? 'Por vencer' : 'Vigente';
}
function vencMMAAAA(exp) {
  if (!exp) return '';
  const m = /^(\d{4})-(\d{2})/.exec(String(exp));
  return m ? `${m[2]}/${m[1]}` : String(exp);
}

function fmtDateTime(s) {
  try { const d = new Date(s); return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return s; }
}

function RelevDetail({ data, onClose, toast }) {
  useEscape(onClose);
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="phone" style={{ width: 360 }}>
        <div className="phone-notch" />
        <div className="phone-bar"><ClipboardList size={13} color="var(--t-E7C15A)" /> <span>RELEVAMIENTO</span><button onClick={onClose} className="phone-x" aria-label="Cerrar"><X size={16} /></button></div>
        <div className="phone-screen">
          <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-8A97A2)', marginBottom: 12 }}>{fmtDateTime(data.created_at)} · {data.items.length} piezas</div>
          {data.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--b-1F1F23)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 12.5px "IBM Plex Mono", monospace', color: 'var(--t-F3F1EC)' }}>{it.code || it.token}</div>
                <div style={{ font: '400 11px "IBM Plex Sans"', color: 'var(--t-8A97A2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name || '—'}</div>
              </div>
              {it.pdf_url
                ? <a className="axt-btn small" style={{ textDecoration: 'none', display: 'inline-flex' }} href={it.pdf_url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Informe</a>
                : <span style={{ font: '400 10.5px "IBM Plex Sans"', color: 'var(--t-6E6C69)' }}>sin informe</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Picker({ assets, onPick, onClose }) {
  useEscape(onClose);
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="phone" style={{ width: 340 }}>
        <div className="phone-notch" />
        <div className="phone-bar"><ScanLine size={13} color="var(--t-D9B44A)" /> <span>AGREGAR PIEZA</span><button onClick={onClose} className="phone-x" aria-label="Cerrar"><X size={16} /></button></div>
        <div className="phone-screen">
          <div style={{ font: '400 11.5px "IBM Plex Sans"', color: 'var(--t-7A8792)', marginBottom: 10 }}>
            Este teléfono o navegador no puede leer tags NFC (funciona en Android con Chrome). Podés agregar la pieza eligiéndola de la lista.
          </div>
          {assets.map((a) => (
            <button key={a.id} className="cli-row" style={{ padding: '10px 4px' }} onClick={() => onPick(a.token)}>
              <Band status={a.status} h={34} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ font: '600 13px "IBM Plex Sans"', color: 'var(--t-EAF0F3)' }}>{a.name}</div>
                <div style={{ font: '400 11px "IBM Plex Sans"', color: 'var(--t-7A8792)' }}>{a.type}</div>
              </div>
              <Plus size={15} color="var(--t-D9B44A)" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function CertModal({ asset, onClose, toast }) {
  useEscape(onClose);
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-bar"><Radio size={13} color="var(--t-D9B44A)" /> <span>OLYMPUS TRACE</span><button onClick={onClose} className="phone-x" aria-label="Cerrar"><X size={16} /></button></div>
        <div className="phone-screen">
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', paddingBottom: 14, borderBottom: '1px solid var(--b-201C24)' }}>
            <Band status={asset.status} h={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-6A7681)' }}>{asset.type}</div>
              <div style={{ font: '700 17px "Oswald", sans-serif', color: 'var(--t-EAF0F3)', margin: '3px 0 6px' }}>{asset.name}</div>
              <Pill status={asset.status} />
            </div>
          </div>
          <div style={{ font: '600 11px "IBM Plex Mono", monospace', color: 'var(--t-7A8792)', letterSpacing: '.5px', margin: '16px 0 4px' }}>CERTIFICADOS</div>
          <div>
            {asset.certificates.map((c, i) => (
              <CertRow key={c.id || i} c={c} last={i === asset.certificates.length - 1} />
            ))}
            {asset.certificates.length === 0 && <div style={{ font: '500 13px "IBM Plex Sans"', color: 'var(--t-7A8792)' }}>Sin certificados.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
