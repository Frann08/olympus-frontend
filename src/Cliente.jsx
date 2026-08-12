import React, { useState, useEffect } from 'react';
import {
  Building2, Smartphone, ChevronRight, Radio, X, Wifi, WifiOff, RefreshCw,
  ScanLine, ClipboardList, CheckCircle2, Plus, Trash2, Loader2,
} from 'lucide-react';
import { api } from './api.js';
import { getUser } from './api.js';
import { Band, Pill, CertRow, Spinner, ErrorNote, daysLabel, daysFrom } from './ui.jsx';
import { saveBundle, loadBundle, bundleAt, getQueue, saveQueue, useOnline, agoLabel } from './offline.js';

const DUE = 60;
const cstat = (exp) => { const d = daysFrom(exp); return d < 0 ? 'overdue' : d <= DUE ? 'due' : 'certified'; };
const withStatus = (certs) => (certs || []).map((c) => ({ ...c, status: cstat(c.expires_date) }));
const astat = (certs) => {
  const s = (certs || []).map((c) => cstat(c.expires_date));
  return s.includes('overdue') ? 'overdue' : s.includes('due') ? 'due' : s.length ? 'certified' : 'sin_cert';
};

export default function Cliente({ toast }) {
  const user = getUser();
  const online = useOnline();
  const [bundle, setBundle] = useState(() => loadBundle());
  const [loading, setLoading] = useState(!loadBundle());
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(bundleAt());
  const [modalAsset, setModalAsset] = useState(null);

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
      <div style={{ font: '500 13px "IBM Plex Sans"', color: '#8B98A5', marginTop: 12, textAlign: 'center' }}>
        Conectate a internet una vez para descargar tus activos. Después funciona sin señal.
      </div>
    </div>
  );

  const assets = bundle.map((a) => ({ ...a, certificates: withStatus(a.certificates), status: astat(a.certificates) }))
    .sort((a, b) => (a.next_expiry || '9999').localeCompare(b.next_expiry || '9999'));
  const allCerts = assets.flatMap((a) => a.certificates);
  const summary = {
    overdue: allCerts.filter((c) => daysFrom(c.expires_date) < 0).length,
    due30: allCerts.filter((c) => { const d = daysFrom(c.expires_date); return d >= 0 && d <= 30; }).length,
    due90: allCerts.filter((c) => { const d = daysFrom(c.expires_date); return d > 30 && d <= 90; }).length,
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: '#2A2410', border: '1px solid #4A3E1E', display: 'grid', placeItems: 'center' }}>
            <Building2 size={20} color="#D9B44A" />
          </div>
          <div>
            <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#6A7681' }}>SESIÓN DE CLIENTE</div>
            <div style={{ font: '700 18px "Space Grotesk", sans-serif', color: '#EAF0F3' }}>{user?.name || 'Cliente'}</div>
          </div>
        </div>
        <div className={'net-pill ' + (online ? 'on' : 'off')}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online ? 'En línea' : 'Sin conexión'}
        </div>
      </div>

      <div className="cli-grid">
        <ExpiringCard s={summary} />
        <Relevamiento assets={assets} online={online} toast={toast} />
      </div>

      <div className="axt-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
        <div className="axt-toolbar">
          <span style={{ font: '700 15px "Space Grotesk"', color: '#EAF0F3' }}>Tus activos</span>
          <span style={{ font: '500 12px "IBM Plex Mono", monospace', color: '#7A8792' }}>
            {assets.length} activos · datos {agoLabel(updatedAt)}
          </span>
        </div>
        <div>
          {assets.map((a) => (
            <button key={a.id} className="cli-row" onClick={() => setModalAsset(a)}>
              <Band status={a.status} h={42} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ font: '600 13px "IBM Plex Sans"', color: '#EAF0F3' }}>{a.name}</div>
                <div style={{ font: '400 11px "IBM Plex Sans"', color: '#7A8792', marginTop: 2 }}>{a.type} · {a.certificates.length} {a.certificates.length === 1 ? 'certificado' : 'certificados'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Pill status={a.status} />
                <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#7A8792', marginTop: 4 }}>{daysLabel(a.next_expiry)}</div>
              </div>
              <ChevronRight size={16} color="#5C6874" />
            </button>
          ))}
        </div>
      </div>

      {modalAsset && <CertModal asset={modalAsset} onClose={() => setModalAsset(null)} toast={toast} />}
    </div>
  );
}

function ExpiringCard({ s }) {
  const total = s.overdue + s.due30 + s.due90;
  return (
    <div className="axt-card" style={{ padding: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div className="axt-card-title" style={{ margin: 0 }}>Tus certificaciones por vencer</div>
        <span style={{ font: '500 11px "IBM Plex Mono", monospace', color: '#7A8792' }}>próximos 90 días</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '14px 0 6px' }}>
        <span style={{ font: '700 46px "Space Grotesk", sans-serif', color: total ? '#EDA53C' : '#4FC98B' }}>{total}</span>
        <span style={{ font: '500 13px "IBM Plex Sans"', color: '#9AA6B1' }}>certificados requieren atención</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, margin: '16px 0 4px' }}>
        {[['Vencidos', s.overdue, '#E5605C'], ['≤ 30 días', s.due30, '#EDA53C'], ['31–90 días', s.due90, '#D9B44A']].map(([l, v, c]) => (
          <div key={l} style={{ background: '#171419', border: '1px solid #2A2732', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ font: '700 24px "Space Grotesk"', color: c }}>{v}</div>
            <div style={{ font: '500 11px "IBM Plex Sans"', color: '#8B98A5', marginTop: 2 }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Relevamiento de campo: escanear offline, armar lista, sincronizar ----
function Relevamiento({ assets, online, toast }) {
  const [queue, setQueue] = useState(() => getQueue());
  const [scanning, setScanning] = useState(false);
  const [picker, setPicker] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const setQ = (nq) => { setQueue(nq); saveQueue(nq); };

  const addToken = (token) => {
    const a = assets.find((x) => x.token === token);
    if (queue.some((i) => i.token === token)) { toast('Ese tag ya está en la lista'); return; }
    const item = { token, name: a ? a.name : 'Activo desconocido', status: a ? a.status : 'sin_cert', scanned_at: new Date().toISOString() };
    setQ([...queue, item]);
    toast(a ? 'Agregado: ' + a.name : 'Tag sin activo asociado');
  };

  async function scan() {
    if ('NDEFReader' in window) {
      try {
        const reader = new window.NDEFReader();
        await reader.scan();
        setScanning(true);
        reader.onreading = (ev) => {
          let url = null;
          for (const rec of ev.message.records) {
            try { const txt = new TextDecoder().decode(rec.data); if (txt && txt.indexOf('tag=') !== -1) url = txt; } catch { /* noop */ }
          }
          if (url) { const m = url.match(/tag=([A-Za-z0-9]+)/); if (m) addToken(m[1]); }
        };
      } catch (e) { setScanning(false); toast('No se pudo leer NFC (' + e.message + ')'); setPicker(true); }
    } else {
      setPicker(true); // sin Web NFC (iPhone/escritorio): elegir de la lista
    }
  }

  async function sync() {
    if (!online) { toast('Necesitás conexión para sincronizar'); return; }
    if (!queue.length) return;
    setSyncing(true);
    try {
      const r = await api('/api/me/relevamientos', {
        method: 'POST',
        body: JSON.stringify({ device: (navigator.userAgent || '').slice(0, 40), items: queue.map((i) => ({ token: i.token, scanned_at: i.scanned_at })) }),
      });
      toast('Sincronizado: ' + r.count + ' ítems');
      setQ([]);
    } catch (e) { toast('Error al sincronizar: ' + e.message); }
    finally { setSyncing(false); }
  }

  return (
    <div className="axt-card" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <ClipboardList size={16} color="#D9B44A" />
        <span style={{ font: '600 14px "Space Grotesk", sans-serif', color: '#EAF0F3' }}>Relevamiento de campo</span>
      </div>
      <div style={{ font: '400 11.5px "IBM Plex Sans"', color: '#7A8792', marginBottom: 14, lineHeight: 1.5 }}>
        Escaneá tags sin señal y armá la lista. Sincronizás al recuperar internet.
      </div>

      <button className="axt-btn primary" onClick={scan} style={{ marginBottom: 10 }}>
        <ScanLine size={15} /> {scanning ? 'Escaneando… acercá un tag' : 'Escanear tag'}
      </button>

      {queue.length === 0 ? (
        <div style={{ font: '500 12px "IBM Plex Sans"', color: '#6A7681', textAlign: 'center', padding: '14px 0' }}>
          Lista vacía.
        </div>
      ) : (
        <div style={{ maxHeight: 180, overflowY: 'auto', marginBottom: 10 }}>
          {queue.map((it, i) => (
            <div key={it.token + i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderBottom: '1px solid #201C24' }}>
              <Band status={it.status} h={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '600 12.5px "IBM Plex Sans"', color: '#EAF0F3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name}</div>
              </div>
              <button className="axt-x sm" onClick={() => setQ(queue.filter((x) => x.token !== it.token))}><X size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <button className="axt-btn" onClick={sync} disabled={!queue.length || syncing} style={{ opacity: queue.length && online ? 1 : 0.6 }}>
        {syncing ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
        {online ? `Sincronizar (${queue.length})` : `Pendiente de sincronizar (${queue.length})`}
      </button>

      {picker && <Picker assets={assets} onPick={(t) => { addToken(t); }} onClose={() => setPicker(false)} />}
    </div>
  );
}

function Picker({ assets, onPick, onClose }) {
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="phone" style={{ width: 340 }}>
        <div className="phone-notch" />
        <div className="phone-bar"><ScanLine size={13} color="#D9B44A" /> <span>ELEGIR TAG</span><button onClick={onClose} className="phone-x"><X size={16} /></button></div>
        <div className="phone-screen">
          <div style={{ font: '400 11.5px "IBM Plex Sans"', color: '#7A8792', marginBottom: 10 }}>
            Sin lector NFC en este dispositivo: tocá un activo para agregarlo a la lista (simula el escaneo).
          </div>
          {assets.map((a) => (
            <button key={a.id} className="cli-row" style={{ padding: '10px 4px' }} onClick={() => onPick(a.token)}>
              <Band status={a.status} h={34} />
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ font: '600 13px "IBM Plex Sans"', color: '#EAF0F3' }}>{a.name}</div>
                <div style={{ font: '400 11px "IBM Plex Sans"', color: '#7A8792' }}>{a.type}</div>
              </div>
              <Plus size={15} color="#D9B44A" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function CertModal({ asset, onClose, toast }) {
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-bar"><Radio size={13} color="#D9B44A" /> <span>OLYMPUS TRACE</span><button onClick={onClose} className="phone-x"><X size={16} /></button></div>
        <div className="phone-screen">
          <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', paddingBottom: 14, borderBottom: '1px solid #201C24' }}>
            <Band status={asset.status} h={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#6A7681' }}>{asset.type}</div>
              <div style={{ font: '700 17px "Space Grotesk", sans-serif', color: '#EAF0F3', margin: '3px 0 6px' }}>{asset.name}</div>
              <Pill status={asset.status} />
            </div>
          </div>
          <div style={{ font: '600 11px "IBM Plex Mono", monospace', color: '#7A8792', letterSpacing: '.5px', margin: '16px 0 4px' }}>CERTIFICADOS</div>
          <div>
            {asset.certificates.map((c, i) => (
              <CertRow key={c.id || i} c={c} last={i === asset.certificates.length - 1} onDownload={() => toast('Descargando ' + c.number + '.pdf')} />
            ))}
            {asset.certificates.length === 0 && <div style={{ font: '500 13px "IBM Plex Sans"', color: '#7A8792' }}>Sin certificados.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
