import React, { useState, useEffect } from 'react';
import { Boxes, Clock, Radio, Tag, ChevronRight, Search, X, CheckCircle2, Plus, Building2, Copy, Check, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from './api.js';
import { useData, Band, Pill, EncChip, StatTile, CertRow, Spinner, ErrorNote, daysLabel } from './ui.jsx';

export default function Admin({ toast }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(null);

  const stats = useData(() => api('/api/stats'), []);
  const clients = useData(() => api('/api/clients'), []);
  const assets = useData(() => api('/api/assets'), []);

  const rows = (assets.data || []).filter((a) => {
    const s = q.trim().toLowerCase();
    const mq = !s || [a.name, a.code, a.type, a.client].some((f) => (f || '').toLowerCase().includes(s));
    const mf = filter === 'all' ? true
      : filter === 'unc' ? (!a.nfc_written || !a.epc_assigned)
      : a.status !== 'certified';
    return mq && mf;
  });

  return (
    <>
      <div className="axt-kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {stats.loading ? <div className="axt-card axt-tile"><Spinner label="…" /></div> : stats.error ? null : (
          <>
            <StatTile i={0} label="Activos" value={stats.data.total} sub={`${(clients.data || []).length} clientes`} color="#D9B44A" icon={Boxes} />
            <StatTile i={1} label="Certificados por vencer" value={stats.data.por_vencer} sub="vencidos + próximos" color="#EDA53C" icon={Clock} />
            <StatTile i={2} label="Tags sin NFC" value={stats.data.sin_nfc} sub="URL sin escribir" color={stats.data.sin_nfc ? '#E5605C' : '#4FC98B'} icon={Radio} />
            <StatTile i={3} label="Tags sin EPC" value={stats.data.sin_epc} sub="UHF sin asociar" color={stats.data.sin_epc ? '#E5605C' : '#4FC98B'} icon={Tag} />
          </>
        )}
      </div>

      {clients.data && (
        <div className="axt-card" style={{ padding: 22, marginTop: 16 }}>
          <div className="axt-card-title">Por vencer por cliente</div>
          {clients.data.map((cl) => (
            <div key={cl.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #201C24' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: '#171419', border: '1px solid #2A2732', display: 'grid', placeItems: 'center' }}>
                  <Building2 size={15} color="#9AA6B1" />
                </div>
                <span style={{ font: '600 13px "IBM Plex Sans"', color: '#DCE3E9' }}>{cl.name}</span>
                <span style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#7A8792' }}>{cl.assets} activos</span>
              </div>
              <span className="axt-count" style={{ color: cl.por_vencer ? '#EDA53C' : '#4FC98B', borderColor: cl.por_vencer ? '#3A2C15' : '#4A3E1E', background: cl.por_vencer ? '#211A10' : '#1B1609' }}>{cl.por_vencer}</span>
            </div>
          ))}
        </div>
      )}

      <div className="axt-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
        <div className="axt-toolbar">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[['all', 'Todos'], ['exp', 'Por vencer'], ['unc', 'Sin codificar']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={'axt-chip' + (filter === k ? ' active' : '')}>{l}</button>
            ))}
          </div>
          <div className="axt-search sm">
            <Search size={15} color="#7A8792" />
            <input className="axt-input" placeholder="Buscar activo o cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {assets.loading ? <Spinner /> : assets.error ? <div style={{ padding: 18 }}><ErrorNote error={assets.error} /></div> : (
          <div className="axt-scroll-x">
            <table className="axt-table">
              <thead><tr>
                <th style={{ width: 6 }}></th><th>Activo</th><th>Tipo</th><th>Cliente</th>
                <th>Certificación</th><th>Codificación</th><th></th>
              </tr></thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} onClick={() => setSel(a.id)} className="axt-tr">
                    <td style={{ padding: 0 }}><Band status={a.status} h={44} /></td>
                    <td>
                      <div style={{ font: '600 13px "IBM Plex Sans"', color: '#EAF0F3' }}>{a.name}</div>
                      <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#7A8792', marginTop: 2 }}>{a.code}</div>
                    </td>
                    <td style={{ color: '#B7C1CB' }}>{a.type}</td>
                    <td style={{ color: '#B7C1CB' }}>{a.client}</td>
                    <td>
                      <Pill status={a.status} />
                      <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#7A8792', marginTop: 4 }}>{daysLabel(a.next_expiry)}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <EncChip ok={a.nfc_written} label="NFC" /><EncChip ok={a.epc_assigned} label="EPC" />
                      </div>
                    </td>
                    <td><ChevronRight size={16} color="#5C6874" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sel && <AssetDrawer id={sel} onClose={() => setSel(null)} toast={toast} onChanged={() => { stats.data && null; }} />}
    </>
  );
}

function AssetDrawer({ id, onClose, toast }) {
  const [rev, setRev] = useState(0);
  const { loading, error, data } = useData(() => api(`/api/assets/${id}`), [id, rev]);
  const reload = () => setRev((r) => r + 1);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ cert_type: '', number: '', issued_date: '', expires_date: '', inspector: '' });

  async function writeNfc(tagId) {
    const uid = window.prompt('UID del chip NFC (ej. 04:1A:2B:3C:4D:5E:6F)');
    if (!uid) return;
    try { await api(`/api/tags/${tagId}/nfc`, { method: 'POST', body: JSON.stringify({ nfc_uid: uid }) }); toast('NFC escrito'); reload(); }
    catch (e) { toast(e.message); }
  }
  async function assignEpc(tagId) {
    const epc = window.prompt('EPC (UHF)');
    if (!epc) return;
    try { await api(`/api/tags/${tagId}/epc`, { method: 'POST', body: JSON.stringify({ epc }) }); toast('EPC asociado'); reload(); }
    catch (e) { toast(e.message); }
  }
  async function saveCert() {
    if (!form.cert_type || !form.number || !form.issued_date || !form.expires_date) { toast('Completá tipo, número y fechas'); return; }
    try {
      await api(`/api/assets/${id}/certificates`, { method: 'POST', body: JSON.stringify(form) });
      toast('Certificado agregado'); setAdding(false);
      setForm({ cert_type: '', number: '', issued_date: '', expires_date: '', inspector: '' });
      reload();
    } catch (e) { toast(e.message); }
  }

  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="axt-drawer">
        {loading ? <Spinner /> : error ? <div style={{ padding: 20 }}><ErrorNote error={error} /></div> : (
          <>
            <div className="axt-drawer-head">
              <Band status={data.certificates.length ? worst(data.certificates) : 'sin_cert'} h={48} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: '#6A7681' }}>{data.type} · {data.client}</div>
                <h2 style={{ font: '700 20px "Space Grotesk", sans-serif', color: '#EAF0F3', margin: '3px 0 8px' }}>{data.name}</h2>
                <span style={{ font: '600 12px "IBM Plex Mono", monospace', color: '#9AA6B1', background: '#171419', border: '1px solid #2A2732', borderRadius: 6, padding: '3px 8px' }}>{data.code}</span>
              </div>
              <button onClick={onClose} className="axt-x"><X size={18} /></button>
            </div>

            <div className="axt-drawer-body">
              <div className="axt-sec">Codificación del tag</div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}>
                <div className="axt-enc-row">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Radio size={15} color="#D9B44A" /><span style={{ font: '600 13px "IBM Plex Sans"', color: '#EAF0F3' }}>NFC (HF)</span></div>
                    <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: data.tag?.nfc_written_at ? '#9AA6B1' : '#7A8792', marginTop: 6 }}>{data.tag?.nfc_uid || 'sin escribir'}</div>
                  </div>
                  {data.tag?.nfc_written_at
                    ? <span className="ok-badge"><CheckCircle2 size={13} /> URL escrita</span>
                    : <button className="axt-btn primary small" onClick={() => writeNfc(data.tag.id)}><Plus size={13} /> Escribir NFC</button>}
                </div>
                <div className="axt-enc-row">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Tag size={15} color="#D9B44A" /><span style={{ font: '600 13px "IBM Plex Sans"', color: '#EAF0F3' }}>UHF (EPC Gen2)</span></div>
                    <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: data.tag?.epc_assigned_at ? '#9AA6B1' : '#7A8792', marginTop: 6 }}>{data.tag?.epc || 'sin asociar'}</div>
                  </div>
                  {data.tag?.epc_assigned_at
                    ? <span className="ok-badge"><CheckCircle2 size={13} /> EPC asociado</span>
                    : <button className="axt-btn primary small" onClick={() => assignEpc(data.tag.id)}><Plus size={13} /> Asociar EPC</button>}
                </div>
              </div>

              {data.tag?.token && <NfcWriteBlock token={data.tag.token} />}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="axt-sec" style={{ margin: 0 }}>Certificados</div>
                <button className="axt-btn small" onClick={() => setAdding((v) => !v)}><Plus size={13} /> {adding ? 'Cancelar' : 'Agregar'}</button>
              </div>

              {adding && (
                <div className="axt-card" style={{ padding: 14, marginBottom: 14, display: 'grid', gap: 10 }}>
                  <label className="fld"><span>Tipo</span><input value={form.cert_type} onChange={(e) => setForm({ ...form, cert_type: e.target.value })} placeholder="Prueba hidrostática" /></label>
                  <label className="fld"><span>Número</span><input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="PH-0001" /></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label className="fld"><span>Emitido</span><input type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} /></label>
                    <label className="fld"><span>Vence</span><input type="date" value={form.expires_date} onChange={(e) => setForm({ ...form, expires_date: e.target.value })} /></label>
                  </div>
                  <label className="fld"><span>Inspector</span><input value={form.inspector} onChange={(e) => setForm({ ...form, inspector: e.target.value })} placeholder="Bureau Veritas" /></label>
                  <button className="axt-btn primary" onClick={saveCert}><CheckCircle2 size={15} /> Guardar certificado</button>
                </div>
              )}

              <div>
                {data.certificates.map((c, i) => <CertRow key={c.id || i} c={c} last={i === data.certificates.length - 1} />)}
                {data.certificates.length === 0 && <div style={{ font: '500 13px "IBM Plex Sans"', color: '#7A8792', padding: '10px 0' }}>Sin certificados cargados.</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function worst(certs) {
  if (certs.some((c) => c.status === 'overdue')) return 'overdue';
  if (certs.some((c) => c.status === 'due')) return 'due';
  return 'certified';
}

// Bloque para grabar el tag NFC (ISO 15693): URL exacta + QR
function NfcWriteBlock({ token }) {
  const url = `${window.location.origin}/?tag=${token}`;
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#0A0A0C', light: '#FFFFFF' } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [url]);

  const copy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ background: '#1B1609', border: '1px solid #4A3E1E', borderRadius: 12, padding: 16, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <QrCode size={16} color="#D9B44A" />
        <span style={{ font: '600 13px "IBM Plex Sans"', color: '#EAF0F3' }}>Grabar en el tag NFC</span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {qr && <img src={qr} alt="QR" width={104} height={104} style={{ borderRadius: 8, background: '#fff', padding: 4, flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ font: '500 10px "IBM Plex Mono", monospace', color: '#6A7681', letterSpacing: '.5px', marginBottom: 5 }}>URL DEL ACTIVO</div>
          <div style={{ font: '500 11.5px "IBM Plex Mono", monospace', color: '#B7C1CB', background: '#0A0A0C', border: '1px solid #2A2732', borderRadius: 8, padding: '9px 11px', wordBreak: 'break-all', marginBottom: 8 }}>{url}</div>
          <button className="axt-btn small" onClick={copy}>
            {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar URL</>}
          </button>
        </div>
      </div>

      <div style={{ font: '400 11.5px "IBM Plex Sans"', color: '#7A8792', marginTop: 12, lineHeight: 1.5 }}>
        Grabá esta URL en el tag con la app <b style={{ color: '#9AA6B1' }}>NFC Tools</b> (registro tipo "URL"). El QR abre la misma página — sirve para probar la vista del cliente desde el teléfono.
      </div>
    </div>
  );
}
