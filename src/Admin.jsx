import React, { useState, useEffect, useRef } from 'react';
import { Boxes, Clock, Radio, Tag, ChevronRight, Search, X, CheckCircle2, Plus, Building2, Copy, Check, QrCode, Upload, FileDown, AlertTriangle, Trash2, Pencil } from 'lucide-react';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { api, PUBLIC_URL } from './api.js';
import { useData, Band, Pill, EncChip, StatTile, CertRow, Spinner, ErrorNote, daysLabel, useEscape, sinTildes, useTanda, MostrarMas } from './ui.jsx';

export default function Admin({ toast, ir, inicial }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [empresa, setEmpresa] = useState(inicial && inicial.empresa ? String(inicial.empresa) : '');
  const [sel, setSel] = useState(null);
  const [rev, setRev] = useState(0);
  const tablaRef = useRef(null);

  const stats = useData(() => api('/api/stats'), [rev]);
  const clients = useData(() => api('/api/clients'), [rev]);
  const assets = useData(() => api('/api/assets'), [rev]);
  const [n, mas] = useTanda(q, filter, empresa);

  const s = sinTildes(q);
  const rows = (assets.data || []).filter((a) => {
    const mq = !s || [a.name, a.code, a.type, a.client].some((f) => sinTildes(f).includes(s));
    const me = !empresa || String(a.client_id) === String(empresa);
    const mf = filter === 'all' ? true
      : filter === 'unc' ? (!a.nfc_written || !a.epc_assigned)
      : a.status !== 'certified';
    return mq && me && mf;
  });

  // Por vencer por cliente: solo las empresas que tienen algo por vencer, las más urgentes primero
  const conVencer = (clients.data || []).filter((c) => c.por_vencer > 0).sort((x, y) => y.por_vencer - x.por_vencer);
  const verEmpresa = (id) => {
    setEmpresa(String(id)); setFilter('exp'); setQ('');
    setTimeout(() => tablaRef.current && tablaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  return (
    <>
      <div className="axt-kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 0 }}>
        {stats.loading && !stats.data ? <div className="axt-card axt-tile"><Spinner label="…" /></div> : stats.error ? null : (
          <>
            <StatTile i={0} label="Activos" value={stats.data.total} sub={`${(clients.data || []).length} empresas`} color="var(--t-D9B44A)" icon={Boxes} />
            <StatTile i={1} label="Certificados por vencer" value={stats.data.por_vencer} sub="vencidos + próximos" color="var(--t-EDA53C)" icon={Clock} />
            <StatTile i={2} label="Tags sin NFC" value={stats.data.sin_nfc} sub="URL sin escribir" color={stats.data.sin_nfc ? 'var(--t-E5605C)' : 'var(--t-4FC98B)'} icon={Radio} />
            <StatTile i={3} label="Tags sin EPC" value={stats.data.sin_epc} sub="UHF sin asociar" color={stats.data.sin_epc ? 'var(--t-E5605C)' : 'var(--t-4FC98B)'} icon={Tag} />
          </>
        )}
      </div>

      <div className="gs-imp">
        <ImportPanel toast={toast} onImported={() => setRev((r) => r + 1)} />
      </div>

      {clients.data && (
        <div className="axt-card" style={{ padding: 22, marginTop: 16 }}>
          <div className="gs-pvh">
            <div className="axt-card-title" style={{ margin: 0 }}>Por vencer por empresa</div>
            {ir && <button className="axt-btn small" onClick={() => ir('empresas')}><Building2 size={13} /> Ver todas las empresas</button>}
          </div>
          {!conVencer.length ? (
            <div style={{ font: '400 12.5px "IBM Plex Sans"', color: 'var(--t-7A8792)', paddingTop: 12 }}>Ninguna empresa tiene inspecciones vencidas ni por vencer.</div>
          ) : (
            <>
              {conVencer.slice(0, 6).map((cl) => (
                <button key={cl.id} className="gs-pvrow" onClick={() => verEmpresa(cl.id)} title={'Ver lo que vence de ' + cl.name}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span className="gs-pvico"><Building2 size={15} color="var(--t-9AA6B1)" /></span>
                    <span style={{ font: '600 13px "IBM Plex Sans"', color: 'var(--t-DCE3E9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.name}</span>
                    <span style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-7A8792)', whiteSpace: 'nowrap' }}>{cl.assets} activos</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="axt-count" style={{ color: 'var(--t-EDA53C)', borderColor: 'var(--b-3A2C15)', background: 'var(--s-211A10)' }}>{cl.por_vencer}</span>
                    <ChevronRight size={15} color="var(--t-5C6874)" />
                  </span>
                </button>
              ))}
              {conVencer.length > 6 && ir && (
                <div style={{ font: '400 12px "IBM Plex Sans"', color: 'var(--t-7A8792)', paddingTop: 12 }}>
                  y {conVencer.length - 6} empresas más. <button className="gs-link" onClick={() => ir('empresas', { filtro: 'vencer' })}>Verlas en Empresas</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div ref={tablaRef} className="axt-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16, scrollMarginTop: 16 }}>
        <div className="axt-toolbar">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[['all', 'Todos'], ['exp', 'Por vencer'], ['unc', 'Sin codificar']].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={'axt-chip' + (filter === k ? ' active' : '')}>{l}</button>
            ))}
          </div>
          <div className="gs-filtros">
            <select className="cor-select gs-sel" value={empresa} onChange={(e) => setEmpresa(e.target.value)} aria-label="Filtrar por empresa">
              <option value="">Todas las empresas</option>
              {(clients.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="axt-search sm gs-buscar">
              <Search size={15} color="var(--t-7A8792)" />
              <input className="axt-input" placeholder="Buscar activo o serie…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar activo o serie" />
              {q && <button className="gs-limpiar" onClick={() => setQ('')} aria-label="Borrar búsqueda"><X size={14} /></button>}
            </div>
          </div>
        </div>

        {assets.loading && !assets.data ? <Spinner /> : assets.error ? <div style={{ padding: 18 }}><ErrorNote error={assets.error} /></div> : !rows.length ? (
          <div className="gs-vacio">{(assets.data || []).length ? 'Ningún activo coincide con la búsqueda o el filtro.' : 'Todavía no hay activos. Importalos desde el Excel de arriba.'}</div>
        ) : (
          <div className="axt-scroll-x">
            <table className="axt-table tabla-cel">
              <thead><tr>
                <th style={{ width: 6 }}></th><th>Activo</th><th>Tipo</th><th>Cliente</th>
                <th>Certificación</th><th>Codificación</th><th></th>
              </tr></thead>
              <tbody>
                {rows.slice(0, n).map((a) => (
                  <tr key={a.id} onClick={() => setSel(a.id)} className="axt-tr">
                    <td style={{ padding: 0 }}><Band status={a.status} h={44} /></td>
                    <td>
                      <div style={{ font: '600 13px "IBM Plex Sans"', color: 'var(--t-EAF0F3)' }}>{a.name}</div>
                      <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-7A8792)', marginTop: 2 }}>{a.code}</div>
                    </td>
                    <td style={{ color: 'var(--t-B7C1CB)' }}>{a.type}</td>
                    <td style={{ color: 'var(--t-B7C1CB)' }}>{a.client}</td>
                    <td>
                      <Pill status={a.status} />
                      <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-7A8792)', marginTop: 4 }}>{daysLabel(a.next_expiry)}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <EncChip ok={a.nfc_written} label="NFC" /><EncChip ok={a.epc_assigned} label="EPC" />
                      </div>
                    </td>
                    <td><ChevronRight size={16} color="var(--t-5C6874)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <MostrarMas total={rows.length} visibles={Math.min(n, rows.length)} onMas={mas} />
      </div>

      {sel && <AssetDrawer id={sel} onClose={() => setSel(null)} toast={toast} onChanged={() => setRev((r) => r + 1)} />}
    </>
  );
}

function AssetDrawer({ id, onClose, toast, onChanged }) {
  useEscape(onClose);
  const [rev, setRev] = useState(0);
  const { loading, error, data } = useData(() => api(`/api/assets/${id}`), [id, rev]);
  // al cambiar algo en la ficha también se actualiza la lista y los totales de atrás
  const reload = () => { setRev((r) => r + 1); onChanged && onChanged(); };
  const [guardando, setGuardando] = useState(false);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ cert_type: '', number: '', issued_date: '', expires_date: '', inspector: '' });
  const [editPieza, setEditPieza] = useState(false);
  const [editCert, setEditCert] = useState(null); // id de la inspección que se está corrigiendo

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
    if (guardando) return;
    if (!form.cert_type || !form.number || !form.issued_date || !form.expires_date) { toast('Completá tipo, número y fechas'); return; }
    setGuardando(true);
    try {
      await api(`/api/assets/${id}/certificates`, { method: 'POST', body: JSON.stringify(form) });
      toast('Certificado agregado'); setAdding(false);
      setForm({ cert_type: '', number: '', issued_date: '', expires_date: '', inspector: '' });
      reload();
    } catch (e) { toast(e.message); }
    finally { setGuardando(false); }
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
                <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: 'var(--t-6A7681)' }}>{data.type} · {data.client}</div>
                <h2 style={{ font: '700 20px "Oswald", sans-serif', color: 'var(--t-EAF0F3)', margin: '3px 0 8px' }}>{data.name}</h2>
                <span style={{ font: '600 12px "IBM Plex Mono", monospace', color: 'var(--t-9AA6B1)', background: 'var(--s-171419)', border: '1px solid var(--b-2A2732)', borderRadius: 6, padding: '3px 8px' }}>{data.code}</span>
              </div>
              <button onClick={() => setEditPieza((v) => !v)} className="axt-x" title="Corregir datos de la pieza" aria-label="Corregir datos de la pieza"><Pencil size={16} /></button>
              <button onClick={onClose} className="axt-x" aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className="axt-drawer-body">
              {editPieza && (
                <EditarPieza data={data} toast={toast} onCancel={() => setEditPieza(false)}
                  onSaved={() => { setEditPieza(false); reload(); }} />
              )}
              <div className="axt-sec">Codificación del tag</div>
              <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}>
                <div className="axt-enc-row">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Radio size={15} color="var(--t-D9B44A)" /><span style={{ font: '600 13px "IBM Plex Sans"', color: 'var(--t-EAF0F3)' }}>NFC (HF)</span></div>
                    <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: data.tag?.nfc_written_at ? 'var(--t-9AA6B1)' : 'var(--t-7A8792)', marginTop: 6 }}>{data.tag?.nfc_uid || 'sin escribir'}</div>
                  </div>
                  {data.tag?.nfc_written_at
                    ? <span className="ok-badge"><CheckCircle2 size={13} /> URL escrita</span>
                    : data.tag && <button className="axt-btn primary small" onClick={() => writeNfc(data.tag.id)}><Plus size={13} /> Escribir NFC</button>}
                </div>
                <div className="axt-enc-row">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Tag size={15} color="var(--t-D9B44A)" /><span style={{ font: '600 13px "IBM Plex Sans"', color: 'var(--t-EAF0F3)' }}>UHF (EPC Gen2)</span></div>
                    <div style={{ font: '400 11px "IBM Plex Mono", monospace', color: data.tag?.epc_assigned_at ? 'var(--t-9AA6B1)' : 'var(--t-7A8792)', marginTop: 6 }}>{data.tag?.epc || 'sin asociar'}</div>
                  </div>
                  {data.tag?.epc_assigned_at
                    ? <span className="ok-badge"><CheckCircle2 size={13} /> EPC asociado</span>
                    : data.tag && <button className="axt-btn primary small" onClick={() => assignEpc(data.tag.id)}><Plus size={13} /> Asociar EPC</button>}
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
                  <button className="axt-btn primary" onClick={saveCert} disabled={guardando}><CheckCircle2 size={15} /> {guardando ? 'Guardando…' : 'Guardar certificado'}</button>
                </div>
              )}

              <div>
                {data.certificates.map((c, i) => (
                  <div key={c.id || i}>
                    <CertRow c={c} last={i === data.certificates.length - 1 && editCert !== c.id} />
                    <div className="cor-acciones">
                      <button className="axt-btn small" onClick={() => setEditCert(editCert === c.id ? null : c.id)}><Pencil size={12} /> Corregir</button>
                    </div>
                    {editCert === c.id && (
                      <EditarInspeccion c={c} toast={toast} onCancel={() => setEditCert(null)}
                        onSaved={() => { setEditCert(null); reload(); }} />
                    )}
                  </div>
                ))}
                {data.certificates.length === 0 && <div style={{ font: '500 13px "IBM Plex Sans"', color: 'var(--t-7A8792)', padding: '10px 0' }}>Sin certificados cargados.</div>}
              </div>

              <Cambios assetId={id} rev={rev} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ============ Correcciones (solo Administración) ============
   Todo cambio queda registrado con quién, cuándo, qué había y el motivo.
   El tag no se toca: identifica a la pieza, no a sus datos. */
const inputCor = { width: '100%', minWidth: 0 };

function EditarPieza({ data, toast, onCancel, onSaved }) {
  const clientes = useData(() => api('/api/clients'), []);
  const [f, setF] = useState({ code: data.code || '', name: data.name || '', type: data.type || '', ibm: data.ibm || '', client_id: String(data.client_id || ''), motivo: '' });
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function guardar() {
    const body = {};
    for (const k of ['code', 'name', 'type', 'ibm', 'client_id']) {
      if (String(f[k]).trim() !== String((k === 'client_id' ? data.client_id : data[k]) ?? '')) body[k] = f[k];
    }
    if (!Object.keys(body).length) { toast('No cambiaste ningún dato'); return; }
    if (body.client_id) {
      const nuevo = (clientes.data || []).find((c) => String(c.id) === String(body.client_id));
      if (!window.confirm(`¿Pasar la pieza a ${nuevo ? nuevo.name : 'otra empresa'}?\nLa van a ver los usuarios de esa empresa y dejan de verla los de ${data.client}.`)) return;
    }
    body.motivo = f.motivo;
    setOcupado(true);
    try {
      await api(`/api/assets/${data.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast('Pieza corregida'); onSaved();
    } catch (e) { toast(e.message); }
    finally { setOcupado(false); }
  }

  return (
    <div className="cor-form">
      <div className="cor-titulo">Corregir datos de la pieza</div>
      <div className="cor-grid">
        <label className="fld"><span>Nº de serie</span><input style={inputCor} value={f.code} onChange={set('code')} /></label>
        <label className="fld"><span>IBM</span><input style={inputCor} value={f.ibm} onChange={set('ibm')} placeholder="ej: 195" /></label>
      </div>
      <label className="fld"><span>Descripción</span><input style={inputCor} value={f.name} onChange={set('name')} /></label>
      <div className="cor-grid">
        <label className="fld"><span>Tipo</span><input style={inputCor} value={f.type} onChange={set('type')} /></label>
        <label className="fld"><span>Empresa</span>
          <select className="axt-input cor-select" value={f.client_id} onChange={set('client_id')}>
            {(clientes.data || [{ id: data.client_id, name: data.client }]).map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <label className="fld"><span>Motivo (opcional)</span><input style={inputCor} value={f.motivo} onChange={set('motivo')} placeholder="ej: Informes Técnicos pasó mal la serie" /></label>
      <div className="cor-botones">
        <button className="axt-btn primary small" onClick={guardar} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar corrección'}</button>
        <button className="axt-btn small" onClick={onCancel}>Cancelar</button>
      </div>
      <div className="cor-nota">No hace falta el tag: al escanearlo se van a ver los datos corregidos.</div>
    </div>
  );
}

function EditarInspeccion({ c, toast, onCancel, onSaved }) {
  const [f, setF] = useState({
    number: c.number || '', resultado: c.resultado || '', presion: c.presion || '', precinto: c.precinto || '',
    issued_date: String(c.issued_date || '').slice(0, 10), expires_date: String(c.expires_date || '').slice(0, 10),
    pdf_url: c.pdf_url || '', motivo: '',
  });
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const original = { number: c.number, resultado: c.resultado, presion: c.presion, precinto: c.precinto, issued_date: String(c.issued_date || '').slice(0, 10), expires_date: String(c.expires_date || '').slice(0, 10), pdf_url: c.pdf_url };

  async function guardar() {
    const body = {};
    for (const k of Object.keys(original)) if (String(f[k]).trim() !== String(original[k] ?? '')) body[k] = f[k];
    if (!Object.keys(body).length) { toast('No cambiaste ningún dato'); return; }
    body.motivo = f.motivo;
    setOcupado(true);
    try {
      await api(`/api/certificates/${c.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      toast('Inspección corregida'); onSaved();
    } catch (e) { toast(e.message); }
    finally { setOcupado(false); }
  }
  async function borrar() {
    if (!window.confirm(`¿Borrar la inspección del informe ${c.number}?\nUsalo solo si se cargó por error. Queda registrado.`)) return;
    setOcupado(true);
    try {
      await api(`/api/certificates/${c.id}`, { method: 'DELETE', body: JSON.stringify({ motivo: f.motivo }) });
      toast('Inspección borrada'); onSaved();
    } catch (e) { toast(e.message); }
    finally { setOcupado(false); }
  }

  return (
    <div className="cor-form">
      <div className="cor-titulo">Corregir inspección · informe {c.number}</div>
      <div className="cor-grid">
        <label className="fld"><span>Nº de informe</span><input style={inputCor} value={f.number} onChange={set('number')} /></label>
        <label className="fld"><span>Resultado</span>
          <select className="axt-input cor-select" value={f.resultado} onChange={set('resultado')}>
            <option value="APTO">APTO</option>
            <option value="NO APTO">NO APTO</option>
            <option value="">(sin dato)</option>
            {f.resultado && !['APTO', 'NO APTO'].includes(f.resultado) && <option value={f.resultado}>{f.resultado}</option>}
          </select>
        </label>
      </div>
      <div className="cor-grid">
        <label className="fld"><span>Presión</span><input style={inputCor} value={f.presion} onChange={set('presion')} placeholder="ej: 15 KPSI" /></label>
        <label className="fld"><span>Vence</span><input style={inputCor} type="date" value={f.expires_date} onChange={set('expires_date')} /></label>
      </div>
      <div className="cor-grid">
        <label className="fld"><span>Emitido</span><input style={inputCor} type="date" value={f.issued_date} onChange={set('issued_date')} /></label>
        <label className="fld"><span>Link al informe (BM)</span><input style={inputCor} value={f.pdf_url} onChange={set('pdf_url')} placeholder="https://…" /></label>
      </div>
      <label className="fld"><span>Precinto</span><input style={inputCor} value={f.precinto} onChange={set('precinto')} /></label>
      <label className="fld"><span>Motivo (opcional)</span><input style={inputCor} value={f.motivo} onChange={set('motivo')} placeholder="ej: el informe correcto es el 401" /></label>
      <div className="cor-botones">
        <button className="axt-btn primary small" onClick={guardar} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar corrección'}</button>
        <button className="axt-btn small" onClick={onCancel}>Cancelar</button>
        <button className="axt-btn small cor-borrar" onClick={borrar} disabled={ocupado}><Trash2 size={12} /> Borrar inspección</button>
      </div>
    </div>
  );
}

function Cambios({ assetId, rev }) {
  const { data } = useData(() => api(`/api/assets/${assetId}/cambios`), [assetId, rev]);
  if (!data || !data.length) return null;
  const fecha = (s) => { try { return new Date(s).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return s; } };
  return (
    <div style={{ marginTop: 22 }}>
      <div className="axt-sec">Correcciones</div>
      {data.map((c) => (
        <div key={c.id} className="cor-item">
          <div className="cor-item-top"><b>{c.campo}</b><span>{fecha(c.created_at)}{c.usuario ? ' · ' + c.usuario : ''}</span></div>
          <div className="cor-item-val">{c.antes ?? '(vacío)'} <span>→</span> {c.despues ?? '(vacío)'}</div>
          {c.motivo && <div className="cor-item-mot">Motivo: {c.motivo}</div>}
        </div>
      ))}
    </div>
  );
}

function worst(certs) {
  if (certs.some((c) => c.status === 'no_apto')) return 'no_apto';
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
  const t = String(v).trim();
  const m = /^(\d{1,2})[/-](\d{4})$/.exec(t); // "6/2027" -> "06/2027"
  return m ? `${m[1].padStart(2, '0')}/${m[2]}` : t;
}
// Encabezado sin tildes, espacios ni signos: "N° de serie", "Nº Serie", "Nro. de serie" -> "ndeserie"...
const clave = (k) => String(k).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ALIAS = {
  cliente: ['cliente', 'empresa'],
  ibm: ['ibm'],
  informe: ['informe', 'ninforme', 'nroinforme', 'numeroinforme', 'informeno', 'informen', 'informenro', 'ndeinforme', 'nrodeinforme', 'numerodeinforme'],
  sector: ['sector'],
  item: ['item', 'items', 'nitem', 'nroitem'],
  descripcion: ['descripcion', 'detalle'],
  nro_serie: ['nroserie', 'nserie', 'ndeserie', 'nrodeserie', 'numerodeserie', 'numeroserie', 'serie', 'serial'],
  resultado: ['resultado'],
  presion: ['presion'],
  vencimiento: ['vencimiento', 'vence', 'fechadevencimiento'],
  precinto: ['precinto'],
  link_informe_bm: ['linkinformebm', 'link', 'linkinforme'],
};
const CAMPO = {};
for (const [campo, lista] of Object.entries(ALIAS)) for (const a of lista) CAMPO[a] = campo;
function normRow(raw, texto) {
  const o = {};
  for (const k in raw) {
    const campo = CAMPO[clave(k)];
    if (!campo || o[campo] != null) continue;
    // la fecha se toma tal cual (Date); el resto como se ve en la planilla (así "001" sigue siendo "001")
    o[campo] = campo === 'vencimiento' ? raw[k] : (texto && texto[k] != null ? texto[k] : raw[k]);
  }
  return {
    cliente: str(o.cliente),
    ibm: str(o.ibm),
    informe: str(o.informe),
    sector: str(o.sector),
    item: str(o.item),
    descripcion: str(o.descripcion),
    nro_serie: str(o.nro_serie),
    resultado: str(o.resultado),
    presion: str(o.presion),
    vencimiento: normVenc(o.vencimiento),
    precinto: str(o.precinto),
    link_informe_bm: str(o.link_informe_bm),
  };
}
const filaVacia = (r) => !Object.values(r).some((v) => v);
// Hoja a leer: la que se llame "Hoja 2" (o "Hoja2"), si no la primera que tenga columna de serie, si no la primera
function elegirHoja(wb) {
  const porNombre = wb.SheetNames.find((n) => /^hoja\s*2$/i.test(n.trim()));
  if (porNombre) return porNombre;
  const conSerie = wb.SheetNames.find((n) => {
    const fila = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, range: 0 })[0] || [];
    return fila.some((h) => CAMPO[clave(h)] === 'nro_serie');
  });
  return conSerie || wb.SheetNames[0];
}
function rowError(r) {
  if (!r.cliente || !r.nro_serie || !r.informe || !r.vencimiento) return 'faltan campos obligatorios';
  if (!/^\d{2}\/\d{4}$/.test(r.vencimiento)) return 'vencimiento debe ser MM/AAAA';
  const mm = +r.vencimiento.slice(0, 2);
  if (mm < 1 || mm > 12) return 'mes inválido';
  return null;
}

export function ImportPanel({ toast, onImported, title = 'Importar informe (Excel)' }) {
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // así se puede volver a elegir el mismo archivo después de corregirlo
    if (!file) return;
    setFileName(file.name); setResult(null); setRows(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array', cellDates: true });
        const hoja = elegirHoja(wb);
        const ws = wb.Sheets[hoja];
        const crudo = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const texto = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
        const parsed = crudo.map((r, i) => normRow(r, texto[i])).filter((r) => !filaVacia(r)).map((r) => ({ ...r, _err: rowError(r) }));
        if (!parsed.length) { toast('No se encontraron filas en la hoja "' + hoja + '"'); return; }
        if (wb.SheetNames.length > 1) toast('Se leyó la hoja "' + hoja + '"');
        setRows(parsed);
      } catch (err) { toast('No se pudo leer el Excel. Revisá que sea un .xlsx válido.'); }
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
      setRows(null); // lo importado no se puede volver a mandar por error
      toast(`Importado: ${r.piecesCreated} piezas, ${r.inspections} inspecciones` + (r.errors?.length ? ` · ${r.errors.length} con aviso` : ''));
      onImported && onImported(valid);
    } catch (e) { toast('Error al importar: ' + e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="axt-card" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Upload size={17} color="var(--t-D9B44A)" />
          <span style={{ font: '600 15px "Oswald", sans-serif', color: 'var(--t-EAF0F3)' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="axt-btn small" onClick={downloadTemplate}><FileDown size={14} /> Descargar plantilla</button>
          <label className="axt-btn small primary" style={{ cursor: 'pointer' }}>
            <Upload size={14} /> Elegir Excel
            <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFile} />
          </label>
        </div>
      </div>
      <div style={{ font: '400 12px "IBM Plex Sans"', color: 'var(--t-7A8792)', marginTop: 8 }}>
        Una fila por ítem del informe. Cada Nº de serie es una pieza; si ya existe, se le agrega la inspección al historial.
      </div>

      {rows && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ font: '500 12px "IBM Plex Mono", monospace', color: 'var(--t-9AA6B1)' }}>{fileName}</span>
            <span className="axt-count" style={{ color: 'var(--t-4FC98B)', borderColor: 'var(--b-1F3A2A)', background: 'var(--s-0F1B12)' }}>{valid.length} válidas</span>
            {invalid.length > 0 && <span className="axt-count" style={{ color: 'var(--t-E5605C)', borderColor: 'var(--b-3A1E1D)', background: 'var(--s-211011)' }}>{invalid.length} con error</span>}
          </div>

          <div className="axt-scroll-x" style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--b-2A2732)', borderRadius: 8 }}>
            <table className="axt-table" style={{ minWidth: 620 }}>
              <thead><tr><th>Nº serie</th><th>Descripción</th><th>Cliente</th><th>Informe</th><th>Resultado</th><th>Vence</th><th></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={r._err ? { background: 'var(--s-1E1214)' } : {}}>
                    <td style={{ font: '600 12px "IBM Plex Mono", monospace', color: 'var(--t-EAF0F3)' }}>{r.nro_serie || '—'}</td>
                    <td style={{ color: 'var(--t-B7C1CB)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.descripcion}</td>
                    <td style={{ color: 'var(--t-B7C1CB)' }}>{r.cliente}</td>
                    <td style={{ color: 'var(--t-9AA6B1)' }}>{r.informe}</td>
                    <td><span style={{ font: '600 11px "IBM Plex Sans"', color: r.resultado === 'NO APTO' ? 'var(--t-E5605C)' : r.resultado === 'APTO' ? 'var(--t-4FC98B)' : 'var(--t-8B98A5)' }}>{r.resultado || '—'}</span></td>
                    <td style={{ font: '500 12px "IBM Plex Mono", monospace', color: 'var(--t-B7C1CB)' }}>{r.vencimiento || '—'}</td>
                    <td>{r._err && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, font: '500 11px "IBM Plex Sans"', color: 'var(--t-E5605C)' }}><AlertTriangle size={12} /> {r._err}</span>}</td>
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
            {invalid.length > 0 && <span style={{ font: '400 12px "IBM Plex Sans"', color: 'var(--t-EDA53C)' }}>Las filas con error se omiten. Corregí el Excel y volvé a subirlo si querés incluirlas.</span>}
          </div>

        </div>
      )}
      {result && (
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--s-0F1B12)', border: '1px solid var(--b-1F3A2A)', borderRadius: 8, font: '500 13px "IBM Plex Sans"', color: 'var(--t-B7E0C4)' }}>
          ✓ {result.piecesCreated} piezas nuevas · {result.inspections} inspecciones nuevas · {result.updated} actualizadas · {result.clientsCreated} clientes nuevos
          {result.errors?.length > 0 && (
            <div style={{ color: 'var(--t-E5A3A1)', marginTop: 6 }}>
              {result.errors.length} {result.errors.length === 1 ? 'fila no se guardó' : 'filas no se guardaron'}:
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {result.errors.slice(0, 12).map((e) => <li key={e.row}>Fila {e.row}: {e.msg}</li>)}
                {result.errors.length > 12 && <li>… y {result.errors.length - 12} más</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Bloque para grabar el tag NFC (ISO 15693): URL exacta + QR
function NfcWriteBlock({ token }) {
  const url = `${PUBLIC_URL}/?tag=${token}`;
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
    <div style={{ background: 'var(--s-1B1609)', border: '1px solid var(--b-4A3E1E)', borderRadius: 12, padding: 16, marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <QrCode size={16} color="var(--t-D9B44A)" />
        <span style={{ font: '600 13px "IBM Plex Sans"', color: 'var(--t-EAF0F3)' }}>Grabar en el tag NFC</span>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {qr && <img src={qr} alt="QR" width={104} height={104} style={{ borderRadius: 8, background: 'var(--s-FFFFFF)', padding: 4, flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ font: '500 10px "IBM Plex Mono", monospace', color: 'var(--t-6A7681)', letterSpacing: '.5px', marginBottom: 5 }}>URL DEL ACTIVO</div>
          <div style={{ font: '500 11.5px "IBM Plex Mono", monospace', color: 'var(--t-B7C1CB)', background: 'var(--s-0A0A0C)', border: '1px solid var(--b-2A2732)', borderRadius: 8, padding: '9px 11px', wordBreak: 'break-all', marginBottom: 8 }}>{url}</div>
          <button className="axt-btn small" onClick={copy}>
            {copied ? <><Check size={13} /> Copiado</> : <><Copy size={13} /> Copiar URL</>}
          </button>
        </div>
      </div>

      <div style={{ font: '400 11.5px "IBM Plex Sans"', color: 'var(--t-7A8792)', marginTop: 12, lineHeight: 1.5 }}>
        Grabá esta URL en el tag con la app <b style={{ color: 'var(--t-9AA6B1)' }}>NFC Tools</b> (registro tipo "URL"). El QR abre la misma página — sirve para probar la vista del cliente desde el teléfono.
      </div>
    </div>
  );
}
