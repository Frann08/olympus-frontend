import React, { useState, useEffect, useRef } from 'react';
import { ScanLine, Tag, X, Trash2, PackageCheck, Package, AlertTriangle, CheckCircle2, Link2, FlaskConical } from 'lucide-react';
import { api } from './api.js';
import { STATUS, Spinner, tinte } from './ui.jsx';
import { CapturaPistola, AsociarPieza, epcLindo } from './Pistola.jsx';

// EPCs de las piezas de demostración, para probar sin pistola (modo prueba)
const DEMO_EPCS = [
  { epc: 'E280 68B0 0000 0204 1AC3 7B21', label: 'V-101' },
  { epc: 'E280 68B0 0000 0204 1AC3 7B22', label: 'PSV-118 (vencido)' },
  { epc: 'E280 68B0 0000 0204 1AC3 7C31', label: 'P-210' },
  { epc: 'E280 68B0 0000 0204 1AC3 7C32', label: 'TK-05 (vencido)' },
  { epc: 'E280 68B0 0000 0204 1AC3 7D41', label: 'PSV-204' },
  { epc: 'E280 68B0 0000 0204 1AC3 7D45', label: 'SL-22' },
];

export default function Traza({ toast }) {
  const [entradaId, setEntradaId] = useState(null);
  const [items, setItems] = useState([]);
  const [remito, setRemito] = useState('');
  const [origen, setOrigen] = useState('');
  const [scanning, setScanning] = useState(false);
  const [recent, setRecent] = useState(null);
  const [prueba, setPrueba] = useState(false);
  const [asociar, setAsociar] = useState(null); // EPC leído que no tiene pieza
  const enCurso = useRef(Promise.resolve());

  async function loadRecent() {
    try { setRecent(await api('/api/entradas')); } catch { setRecent([]); }
  }
  useEffect(() => { loadRecent(); }, []);

  // La entrada se crea con el primer tag leído, así guarda el remito y el origen que se escribieron.
  // Las lecturas se procesan en orden (la pistola puede mandar varias tandas seguidas).
  const idRef = useRef(null);
  idRef.current = entradaId;
  function leer(epcs) {
    enCurso.current = enCurso.current.then(() => procesar(epcs)).catch(() => {});
  }
  async function procesar(epcs) {
    setScanning(true);
    try {
      let id = idRef.current;
      if (!id) {
        const e = await api('/api/entradas', { method: 'POST', body: JSON.stringify({ remito: remito.trim() || null, origen: origen.trim() || null }) });
        id = e.id;
        idRef.current = id;
        setEntradaId(id);
        loadRecent();
      }
      const r = await api(`/api/entradas/${id}/scan`, { method: 'POST', body: JSON.stringify({ epcs }) });
      const fresh = await api(`/api/entradas/${id}`);
      setItems(fresh.items);
      loadRecent();
      const partes = [];
      if (r.nuevos) partes.push(r.nuevos === 1 ? '1 tag nuevo' : `${r.nuevos} tags nuevos`);
      if (r.repetidos) partes.push(r.repetidos === 1 ? '1 ya estaba' : `${r.repetidos} ya estaban`);
      if (r.sin_pieza) partes.push(r.sin_pieza === 1 ? '1 sin pieza asociada' : `${r.sin_pieza} sin pieza asociada`);
      toast(partes.join(' · ') || 'Sin cambios');
      try { navigator.vibrate && navigator.vibrate(r.sin_pieza ? [90, 60, 90] : 80); } catch { /* sin vibración */ }
    } catch (e) { toast(e.message); }
    finally { setScanning(false); }
  }
  const scan = (epc) => leer([epc]);
  async function recargar() {
    if (!idRef.current) return;
    try { setItems((await api(`/api/entradas/${idRef.current}`)).items); } catch { /* se ve en el próximo cambio */ }
  }
  async function removeItem(itemId) {
    try {
      await api(`/api/entradas/${entradaId}/items/${itemId}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== itemId));
      loadRecent();
    } catch (e) { toast('No se pudo quitar: ' + e.message); }
  }
  const [confirmando, setConfirmando] = useState(false);
  async function confirmar() {
    if (!items.length || !entradaId || confirmando) return;
    setConfirmando(true);
    try {
      const e = await api(`/api/entradas/${entradaId}/confirm`, { method: 'POST' });
      toast(`Entrada ${e.remito || ''} confirmada · ${items.length} ${items.length === 1 ? 'ítem' : 'ítems'}`);
      setEntradaId(null); setItems([]); setRemito(''); setOrigen('');
      await loadRecent();
    } catch (e) { toast(e.message); }
    finally { setConfirmando(false); }
  }

  const ALERTA = { overdue: 'Cert vencido', due: 'Por vencer', no_apto: 'No apto', sin_cert: 'Sin certificados' };
  const flags = items.filter((i) => i.status && i.status !== 'certified').length;

  return (
    <div className="traza-grid">
      <div>
        <div className="axt-card" style={{ padding: 20, marginBottom: 16 }}>
          <div className="axt-card-title">Datos de la entrada</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
            <label className="fld"><span>N.º de remito</span><input value={remito} onChange={(e) => setRemito(e.target.value)} placeholder="Ej: REM-004823" disabled={!!entradaId} /></label>
            <label className="fld"><span>Origen / proveedor</span><input value={origen} onChange={(e) => setOrigen(e.target.value)} placeholder="Ej: Base Añelo" disabled={!!entradaId} /></label>
          </div>
          <div style={{ font: '400 11.5px "IBM Plex Sans"', color: 'var(--t-7A8792)', marginTop: 10 }}>
            {entradaId ? 'Entrada abierta: estos datos quedan fijos hasta confirmarla.' : 'Completalos antes de leer el primer tag.'}
          </div>
        </div>

        <div className={'scan-zone' + (scanning ? ' on' : '')}>
          <div className="scan-ico">
            <ScanLine size={30} color={scanning ? 'var(--t-D9B44A)' : 'var(--t-7A8792)'} />
            {scanning && <><span className="wave" /><span className="wave" style={{ animationDelay: '.4s' }} /></>}
          </div>
          <div style={{ font: '700 16px "Oswald", sans-serif', color: 'var(--t-EAF0F3)', marginTop: 14 }}>
            {scanning ? 'Registrando lecturas…' : 'Leer tags con la pistola'}
          </div>
          <div style={{ font: '400 12px "IBM Plex Sans"', color: 'var(--t-7A8792)', marginTop: 5, marginBottom: 14 }}>
            Apuntá a las piezas y mantené apretado el gatillo de abajo. Los tags leídos se suman solos a la lista.
          </div>
          <CapturaPistola onLeidos={leer} />
          <button className="pis-prueba" onClick={() => setPrueba((v) => !v)} aria-expanded={prueba}>
            <FlaskConical size={13} /> {prueba ? 'Ocultar modo prueba' : 'Modo prueba (sin pistola)'}
          </button>
          {prueba && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 10 }}>
              {DEMO_EPCS.map((d) => (
                <button key={d.epc} className="axt-chip" onClick={() => scan(d.epc)} disabled={scanning}>{d.label}</button>
              ))}
            </div>
          )}
        </div>

        <div className="axt-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
          <div className="axt-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: '700 15px "Oswald"', color: 'var(--t-EAF0F3)' }}>Lista de entrada</span>
              <span className="axt-count" style={{ color: 'var(--t-D9B44A)', borderColor: 'var(--b-4A3E1E)', background: 'var(--s-1B1609)' }}>{items.length} leídos</span>
              {flags > 0 && <span className="axt-count" style={{ color: 'var(--t-E5605C)', borderColor: 'var(--b-3A1E1D)', background: 'var(--s-211011)' }}>{flags} con alerta</span>}
            </div>
          </div>

          {items.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <Package size={30} color="var(--t-433C48)" />
              <div style={{ font: '500 13px "IBM Plex Sans"', color: 'var(--t-7A8792)', marginTop: 10 }}>Leé tags para armar la entrada.</div>
            </div>
          ) : (
            <div>
              {items.map((it) => (
                <div key={it.id} className="ent-item">
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--s-171419)', border: '1px solid var(--b-2A2732)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Tag size={15} color="var(--t-D9B44A)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 13px "IBM Plex Sans"', color: 'var(--t-EAF0F3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name || 'Tag sin pieza asociada'}</div>
                    <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-7A8792)', marginTop: 2, overflowWrap: 'anywhere' }}>{epcLindo(it.scanned_epc)}{it.client ? ` · ${it.client}` : ''}</div>
                  </div>
                  {!it.asset_id && (
                    <button className="axt-btn small" onClick={() => setAsociar(it.scanned_epc)} title="Decir a qué pieza pertenece este tag"><Link2 size={13} /> Asociar</button>
                  )}
                  {it.status && it.status !== 'certified' && (() => {
                    const st = STATUS[it.status] || STATUS.sin_cert;
                    return (
                      <span className="axt-flag" style={{ color: st.color, borderColor: tinte(st.color, 33.3), background: tinte(st.color, 8.6) }}>
                        <AlertTriangle size={12} /> {ALERTA[it.status] || st.label}
                      </span>
                    );
                  })()}
                  <button className="axt-x sm" onClick={() => removeItem(it.id)} title="Quitar de la entrada" aria-label="Quitar de la entrada"><X size={15} /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: 14, borderTop: '1px solid var(--b-2A2732)' }}>
            <button className="axt-btn primary" style={{ width: '100%', opacity: items.length ? 1 : 0.5 }} onClick={confirmar} disabled={!items.length || confirmando}>
              <PackageCheck size={16} /> Confirmar entrada
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="axt-card" style={{ padding: 20 }}>
          <div className="axt-card-title">Entradas recientes</div>
          {recent === null ? <Spinner label="Cargando…" /> : recent.length === 0 ? (
            <div style={{ font: '500 13px "IBM Plex Sans"', color: 'var(--t-7A8792)', padding: '10px 0' }}>Todavía no hay entradas.</div>
          ) : recent.slice(0, 8).map((h) => (
            <div key={h.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--b-201C24)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: '600 13px "IBM Plex Mono", monospace', color: 'var(--t-EAF0F3)' }}>{h.remito || `#${h.id}`}</span>
                <span className="ok-badge" style={h.status === 'open' ? { color: 'var(--t-EDA53C)', background: 'var(--s-211A10)', borderColor: 'var(--b-3A2C15)' } : {}}>
                  {h.status === 'confirmed' ? <CheckCircle2 size={12} /> : null} {h.status === 'confirmed' ? 'Confirmada' : 'Abierta'}
                </span>
              </div>
              <div style={{ font: '400 11px "IBM Plex Sans"', color: 'var(--t-7A8792)', marginTop: 4 }}>{h.origen || 'sin origen'} · {h.items} ítems</div>
            </div>
          ))}
        </div>
      </div>
      {asociar && <AsociarPieza epc={asociar} toast={toast} onClose={() => setAsociar(null)} onListo={recargar} />}
    </div>
  );
}
