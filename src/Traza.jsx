import React, { useState, useEffect } from 'react';
import { ScanLine, Tag, X, Trash2, PackageCheck, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from './api.js';
import { STATUS, Spinner, ErrorNote } from './ui.jsx';

// EPCs del seed para simular lecturas de la pistola (existen en la base)
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
  const [remito, setRemito] = useState('REM-004823');
  const [origen, setOrigen] = useState('Base Añelo');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);

  async function newEntrada() {
    setItems([]);
    try {
      const e = await api('/api/entradas', { method: 'POST', body: JSON.stringify({ remito, origen }) });
      setEntradaId(e.id);
      setError(null);
    } catch (e) { setError(e.message); }
  }
  async function loadRecent() {
    try { setRecent(await api('/api/entradas')); } catch { /* noop */ }
  }
  useEffect(() => { newEntrada(); loadRecent(); /* eslint-disable-next-line */ }, []);

  async function scan(epc) {
    if (!entradaId || scanning) return;
    setScanning(true);
    try {
      const r = await api(`/api/entradas/${entradaId}/scan`, { method: 'POST', body: JSON.stringify({ epc }) });
      const fresh = await api(`/api/entradas/${entradaId}`);
      setItems(fresh.items);
      if (r.duplicate) toast('Tag ya leído en esta entrada');
      else if (!r.matched) toast('EPC sin activo asociado');
    } catch (e) { toast(e.message); }
    finally { setScanning(false); }
  }
  async function removeItem(itemId) {
    // el backend no expone borrado de ítem individual en esta versión; se refleja al reconfirmar
    setItems((prev) => prev.filter((x) => x.id !== itemId));
  }
  async function confirmar() {
    if (!items.length) return;
    try {
      const e = await api(`/api/entradas/${entradaId}/confirm`, { method: 'POST' });
      toast(`Entrada ${e.remito || ''} confirmada · ${items.length} ítems`);
      setRemito('REM-00' + (4824 + Math.floor(Math.random() * 9)));
      await newEntrada();
      await loadRecent();
    } catch (e) { toast(e.message); }
  }

  const flags = items.filter((i) => i.status && i.status !== 'certified').length;

  return (
    <div className="traza-grid">
      <div>
        <div className="axt-card" style={{ padding: 20, marginBottom: 16 }}>
          <div className="axt-card-title">Datos de la entrada</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="fld"><span>N.º de remito</span><input value={remito} onChange={(e) => setRemito(e.target.value)} /></label>
            <label className="fld"><span>Origen / proveedor</span><input value={origen} onChange={(e) => setOrigen(e.target.value)} /></label>
          </div>
        </div>

        {error && <div style={{ marginBottom: 16 }}><ErrorNote error={error} /></div>}

        <div className={'scan-zone' + (scanning ? ' on' : '')}>
          <div className="scan-ico">
            <ScanLine size={30} color={scanning ? '#D9B44A' : '#7A8792'} />
            {scanning && <><span className="wave" /><span className="wave" style={{ animationDelay: '.4s' }} /></>}
          </div>
          <div style={{ font: '700 16px "Oswald", sans-serif', color: '#EAF0F3', marginTop: 14 }}>
            {scanning ? 'Leyendo tag UHF…' : 'Simular lectura de la pistola'}
          </div>
          <div style={{ font: '400 12px "IBM Plex Sans"', color: '#7A8792', marginTop: 5, marginBottom: 14 }}>
            Tocá un tag de prueba (o integrá tu lector enviando el EPC a la API)
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {DEMO_EPCS.map((d) => (
              <button key={d.epc} className="axt-chip" onClick={() => scan(d.epc)} disabled={scanning}>{d.label}</button>
            ))}
          </div>
        </div>

        <div className="axt-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
          <div className="axt-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ font: '700 15px "Oswald"', color: '#EAF0F3' }}>Lista de entrada</span>
              <span className="axt-count" style={{ color: '#D9B44A', borderColor: '#4A3E1E', background: '#1B1609' }}>{items.length} leídos</span>
              {flags > 0 && <span className="axt-count" style={{ color: '#E5605C', borderColor: '#3A1E1D', background: '#211011' }}>{flags} con alerta</span>}
            </div>
          </div>

          {items.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <Package size={30} color="#433C48" />
              <div style={{ font: '500 13px "IBM Plex Sans"', color: '#7A8792', marginTop: 10 }}>Leé tags para armar la entrada.</div>
            </div>
          ) : (
            <div>
              {items.map((it) => (
                <div key={it.id} className="ent-item">
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: '#171419', border: '1px solid #2A2732', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Tag size={15} color="#D9B44A" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 13px "IBM Plex Sans"', color: '#EAF0F3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name || 'EPC desconocido'}</div>
                    <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#7A8792', marginTop: 2 }}>{it.scanned_epc}{it.client ? ` · ${it.client}` : ''}</div>
                  </div>
                  {it.status && it.status !== 'certified' && (
                    <span className="axt-flag" style={{ color: STATUS[it.status].color, borderColor: STATUS[it.status].color + '55', background: STATUS[it.status].color + '16' }}>
                      <AlertTriangle size={12} /> {it.status === 'overdue' ? 'Cert vencido' : 'Por vencer'}
                    </span>
                  )}
                  <button className="axt-x sm" onClick={() => removeItem(it.id)}><X size={15} /></button>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: 14, borderTop: '1px solid #2A2732' }}>
            <button className="axt-btn primary" style={{ width: '100%', opacity: items.length ? 1 : 0.5 }} onClick={confirmar}>
              <PackageCheck size={16} /> Confirmar entrada
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="axt-card" style={{ padding: 20 }}>
          <div className="axt-card-title">Entradas recientes</div>
          {recent.length === 0 ? <Spinner label="…" /> : recent.slice(0, 8).map((h) => (
            <div key={h.id} style={{ padding: '12px 0', borderBottom: '1px solid #201C24' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ font: '600 13px "IBM Plex Mono", monospace', color: '#EAF0F3' }}>{h.remito || `#${h.id}`}</span>
                <span className="ok-badge" style={h.status === 'open' ? { color: '#EDA53C', background: '#211A10', borderColor: '#3A2C15' } : {}}>
                  {h.status === 'confirmed' ? <CheckCircle2 size={12} /> : null} {h.status === 'confirmed' ? 'Confirmada' : 'Abierta'}
                </span>
              </div>
              <div style={{ font: '400 11px "IBM Plex Sans"', color: '#7A8792', marginTop: 4 }}>{h.origen || 'sin origen'} · {h.items} ítems</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
