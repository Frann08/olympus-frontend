import React, { useState, useEffect } from 'react';
import { Boxes, Clock, Radio, Tag, ChevronRight, Search, X, CheckCircle2, Plus, Building2, Copy, Check, QrCode, Upload, FileDown, AlertTriangle, Users, UserPlus, Trash2, ChevronDown } from 'lucide-react';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { api } from './api.js';
import { useData, Band, Pill, EncChip, StatTile, CertRow, Spinner, ErrorNote, daysLabel } from './ui.jsx';

export default function Admin({ toast }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState(null);
  const [rev, setRev] = useState(0);

  const stats = useData(() => api('/api/stats'), [rev]);
  const clients = useData(() => api('/api/clients'), [rev]);
  const assets = useData(() => api('/api/assets'), [rev]);

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
      <AdminPanel toast={toast} onChanged={() => setRev((r) => r + 1)} />
      <ImportPanel toast={toast} onImported={() => setRev((r) => r + 1)} />

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
                <h2 style={{ font: '700 20px "Oswald", sans-serif', color: '#EAF0F3', margin: '3px 0 8px' }}>{data.name}</h2>
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

/* ============ Importación masiva por Excel ============ */
const TPL_HEADERS = ['cliente', 'ibm', 'informe', 'sector', 'item', 'descripcion', 'nro_serie', 'resultado', 'presion', 'vencimiento', 'precinto', 'link_informe_bm'];
const TPL_ROWS = [
  ['Halliburton', '195', '2182', 'TSS/MPD', 1, 'CODO 2" Fig 1502 MH (CURVO) 90°', '482337', 'APTO', '15 KPSI', '06/2027', '482337 - 15 KPSI - EXP 0627 - IBM 195 - 2182', ''],
  ['Halliburton', '195', '2182', 'TSS/MPD', 9, 'VÁLVULA TAPÓN 2" Fig 1502 x 1.75"', 'B4573438-04', 'NO APTO', '15 KPSI', '06/2027', 'N/A', ''],
  ['Halliburton', '195', '2182', 'TSS/MPD', 11, 'CONEXIÓN 2" FIG 1502 x 4" Fig 602 HH', 'BMBS10760', 'APTO', '5 KPSI', '06/2027', 'BMBS10760 - 5 KPSI - EXP 0627 - IBM 195 - 2182', ''],
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TPL_HEADERS, ...TPL_ROWS]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'informe');
  XLSX.writeFile(wb, 'plantilla-olympus-trace.xlsx');
}

const str = (v) => (v == null ? '' : String(v).trim());
function normVenc(v) {
  if (v == null) return '';
  if (v instanceof Date) return `${String(v.getMonth() + 1).padStart(2, '0')}/${v.getFullYear()}`;
  return String(v).trim();
}
function normRow(raw) {
  const o = {};
  for (const k in raw) o[String(k).trim().toLowerCase()] = raw[k];
  return {
    cliente: str(o.cliente),
    ibm: str(o.ibm),
    informe: str(o.informe),
    sector: str(o.sector),
    item: str(o.item),
    descripcion: str(o.descripcion || o['descripción']),
    nro_serie: str(o.nro_serie || o['nº de serie'] || o['nro serie'] || o['serie']),
    resultado: str(o.resultado),
    presion: str(o.presion || o['presión']),
    vencimiento: normVenc(o.vencimiento),
    precinto: str(o.precinto),
    link_informe_bm: str(o.link_informe_bm || o.link),
  };
}
function rowError(r) {
  if (!r.cliente || !r.nro_serie || !r.informe || !r.vencimiento) return 'faltan campos obligatorios';
  if (!/^\d{2}\/\d{4}$/.test(r.vencimiento)) return 'vencimiento debe ser MM/AAAA';
  const mm = +r.vencimiento.slice(0, 2);
  if (mm < 1 || mm > 12) return 'mes inválido';
  return null;
}

function ImportPanel({ toast, onImported }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const parsed = json.map(normRow).map((r) => ({ ...r, _err: rowError(r) }));
        setRows(parsed);
      } catch (err) { toast('No se pudo leer el Excel: ' + err.message); }
    };
    reader.readAsArrayBuffer(file);
  }

  const valid = (rows || []).filter((r) => !r._err);
  const invalid = (rows || []).filter((r) => r._err);

  async function doImport() {
    if (!valid.length) return;
    setBusy(true); setResult(null);
    try {
      const r = await api('/api/import', { method: 'POST', body: JSON.stringify({ rows: valid.map(({ _err, ...x }) => x) }) });
      setResult(r);
      toast(`Importado: ${r.piecesCreated} piezas, ${r.inspections} inspecciones`);
      onImported && onImported();
    } catch (e) { toast('Error al importar: ' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="axt-card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Upload size={17} color="#D9B44A" />
          <span style={{ font: '600 15px "Oswald", sans-serif', color: '#EAF0F3' }}>Importar informe (Excel)</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="axt-btn small" onClick={downloadTemplate}><FileDown size={14} /> Descargar plantilla</button>
          <label className="axt-btn small primary" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Elegir Excel
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFile} />
          </label>
        </div>
      </div>
      <div style={{ font: '400 12px "IBM Plex Sans"', color: '#7A8792', marginTop: 8 }}>
        Una fila por ítem del informe. Cada Nº de serie es una pieza; si ya existe, se le agrega la inspección al historial.
      </div>

      {rows && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ font: '500 12px "IBM Plex Mono", monospace', color: '#9AA6B1' }}>{fileName}</span>
            <span className="axt-count" style={{ color: '#4FC98B', borderColor: '#1F3A2A', background: '#0F1B12' }}>{valid.length} válidas</span>
            {invalid.length > 0 && <span className="axt-count" style={{ color: '#E5605C', borderColor: '#3A1E1D', background: '#211011' }}>{invalid.length} con error</span>}
          </div>

          <div className="axt-scroll-x" style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #2A2732', borderRadius: 8 }}>
            <table className="axt-table" style={{ minWidth: 620 }}>
              <thead><tr><th>Nº serie</th><th>Descripción</th><th>Cliente</th><th>Informe</th><th>Resultado</th><th>Vence</th><th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={r._err ? { background: '#1E1214' } : {}}>
                    <td style={{ font: '600 12px "IBM Plex Mono", monospace', color: '#EAF0F3' }}>{r.nro_serie || '—'}</td>
                    <td style={{ color: '#B7C1CB', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.descripcion}</td>
                    <td style={{ color: '#B7C1CB' }}>{r.cliente}</td>
                    <td style={{ color: '#9AA6B1' }}>{r.informe}</td>
                    <td><span style={{ font: '600 11px "IBM Plex Sans"', color: r.resultado === 'NO APTO' ? '#E5605C' : r.resultado === 'APTO' ? '#4FC98B' : '#8B98A5' }}>{r.resultado || '—'}</span></td>
                    <td style={{ font: '500 12px "IBM Plex Mono", monospace', color: '#B7C1CB' }}>{r.vencimiento || '—'}</td>
                    <td>{r._err && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '500 11px "IBM Plex Sans"', color: '#E5605C' }}><AlertTriangle size={12} /> {r._err}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="axt-btn primary" onClick={doImport} disabled={!valid.length || busy}>
              {busy ? 'Importando…' : `Importar ${valid.length} filas`}
            </button>
            <button className="axt-btn small" onClick={() => { setRows(null); setResult(null); setFileName(''); }}>Cancelar</button>
            {invalid.length > 0 && <span style={{ font: '400 12px "IBM Plex Sans"', color: '#EDA53C' }}>Las filas con error se omiten. Corregí el Excel y volvé a subirlo si querés incluirlas.</span>}
          </div>

          {result && (
            <div style={{ marginTop: 12, padding: '12px 14px', background: '#0F1B12', border: '1px solid #1F3A2A', borderRadius: 8, font: '500 13px "IBM Plex Sans"', color: '#B7E0C4' }}>
              ✓ {result.piecesCreated} piezas nuevas · {result.inspections} inspecciones nuevas · {result.updated} actualizadas · {result.clientsCreated} clientes nuevos
              {result.errors?.length > 0 && <div style={{ color: '#E5A3A1', marginTop: 4 }}>{result.errors.length} filas con problemas en el servidor.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
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

/* ============ Clientes y usuarios ============ */
function AdminPanel({ toast, onChanged }) {
  const [open, setOpen] = useState(true);
  const [rev, setRev] = useState(0);
  const clients = useData(() => api('/api/clients'), [rev]);
  const users = useData(() => api('/api/users'), [rev]);
  const reload = () => { setRev((r) => r + 1); onChanged && onChanged(); };

  const [cName, setCName] = useState('');
  const [uForm, setUForm] = useState({ email: '', password: '', role: 'cliente', client_id: '' });

  async function addClient() {
    if (!cName.trim()) { toast('Escribí el nombre'); return; }
    try { await api('/api/clients', { method: 'POST', body: JSON.stringify({ name: cName }) }); toast('Cliente creado'); setCName(''); reload(); }
    catch (e) { toast(e.message); }
  }
  async function delClient(id) {
    try { await api('/api/clients/' + id, { method: 'DELETE' }); toast('Cliente eliminado'); reload(); }
    catch (e) { toast(e.message); }
  }
  async function addUser() {
    if (!uForm.email || !uForm.password) { toast('Email y contraseña'); return; }
    if (uForm.role === 'cliente' && !uForm.client_id) { toast('Elegí la empresa'); return; }
    try {
      await api('/api/users', { method: 'POST', body: JSON.stringify(uForm) });
      toast('Usuario creado'); setUForm({ email: '', password: '', role: 'cliente', client_id: '' }); reload();
    } catch (e) { toast(e.message); }
  }
  async function delUser(id) {
    try { await api('/api/users/' + id, { method: 'DELETE' }); toast('Usuario eliminado'); reload(); }
    catch (e) { toast(e.message); }
  }

  const roleColor = (r) => r === 'admin' ? '#D9B44A' : r === 'traza' ? '#7FB0C8' : '#9AA6B1';

  return (
    <div className="axt-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Users size={17} color="#D9B44A" />
          <span style={{ font: '600 15px "Oswald", sans-serif', color: '#EAF0F3' }}>Clientes y usuarios</span>
        </span>
        <ChevronDown size={18} color="#7A8792" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          <div className="cli-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ background: '#171419', border: '1px solid #2A2732', borderRadius: 12, padding: 16 }}>
              <div className="axt-sec" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Building2 size={14} color="#9AA6B1" /> Empresas</div>
              {clients.loading ? <Spinner label="…" /> : (clients.data || []).map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #201C24' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ font: '600 13px "IBM Plex Sans"', color: '#EAF0F3' }}>{c.name}</div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
                      {(c.ibms || []).map((ib) => <span key={ib} style={{ font: '600 10px "IBM Plex Mono", monospace', color: '#D9B44A', background: '#2A2410', border: '1px solid #4A3E1E', borderRadius: 5, padding: '1px 6px' }}>IBM {ib}</span>)}
                      <span style={{ font: '400 10.5px "IBM Plex Mono", monospace', color: '#7A8792' }}>{c.assets} activos · {c.users} usuarios</span>
                    </div>
                  </div>
                  {c.assets === 0 && <button className="axt-x sm" title="Eliminar" onClick={() => delClient(c.id)}><Trash2 size={13} /></button>}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input className="axt-input" style={{ flex: 1, background: '#0F0E12', border: '1px solid #2A2732', borderRadius: 8, padding: '8px 11px' }} placeholder="Nombre de la empresa" value={cName} onChange={(e) => setCName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addClient()} />
                <button className="axt-btn small primary" onClick={addClient}><Plus size={13} /> Crear</button>
              </div>
              <div style={{ font: '400 10.5px "IBM Plex Sans"', color: '#6A7681', marginTop: 8 }}>Los IBM se cargan solos al importar activos de esa empresa.</div>
            </div>

            <div style={{ background: '#171419', border: '1px solid #2A2732', borderRadius: 12, padding: 16 }}>
              <div className="axt-sec" style={{ display: 'flex', alignItems: 'center', gap: 7 }}><UserPlus size={14} color="#9AA6B1" /> Accesos</div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                {users.loading ? <Spinner label="…" /> : (users.data || []).map((u) => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #201C24' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: '600 12.5px "IBM Plex Sans"', color: '#EAF0F3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                      <div style={{ font: '400 10.5px "IBM Plex Mono", monospace', marginTop: 3 }}>
                        <span style={{ color: roleColor(u.role) }}>{u.role}</span>{u.client ? <span style={{ color: '#7A8792' }}> · {u.client}</span> : ''}
                      </div>
                    </div>
                    {u.role !== 'admin' && <button className="axt-x sm" title="Eliminar" onClick={() => delUser(u.id)}><Trash2 size={13} /></button>}
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                <input className="axt-input" style={{ background: '#0F0E12', border: '1px solid #2A2732', borderRadius: 8, padding: '8px 11px' }} placeholder="email@empresa.com" value={uForm.email} onChange={(e) => setUForm({ ...uForm, email: e.target.value })} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="axt-input" style={{ flex: 1, background: '#0F0E12', border: '1px solid #2A2732', borderRadius: 8, padding: '8px 11px' }} placeholder="contraseña" value={uForm.password} onChange={(e) => setUForm({ ...uForm, password: e.target.value })} />
                  <select className="axt-input" style={{ background: '#0F0E12', border: '1px solid #2A2732', borderRadius: 8, padding: '8px 11px', color: '#EAF0F3' }} value={uForm.role} onChange={(e) => setUForm({ ...uForm, role: e.target.value })}>
                    <option value="cliente">Cliente</option>
                    <option value="traza">Trazabilidad</option>
                    <option value="admin">Programador</option>
                  </select>
                </div>
                {uForm.role === 'cliente' && (
                  <select className="axt-input" style={{ background: '#0F0E12', border: '1px solid #2A2732', borderRadius: 8, padding: '8px 11px', color: '#EAF0F3' }} value={uForm.client_id} onChange={(e) => setUForm({ ...uForm, client_id: e.target.value })}>
                    <option value="">— Elegí la empresa —</option>
                    {(clients.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <button className="axt-btn small primary" onClick={addUser}><UserPlus size={13} /> Crear acceso</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
