import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { Tag, Copy, Check, X, Undo2, Smartphone, Search, Pencil } from 'lucide-react';
import { api, PUBLIC_URL, getUser } from './api.js';
import { Spinner, ErrorNote } from './ui.jsx';
import { ImportPanel } from './Admin.jsx';
import GrabarSerie, { puedeGrabar } from './GrabarSerie.jsx';

// Estado físico del tag de cada pieza
const EST = {
  pendiente: { label: 'Pendiente', color: 'var(--t-A9A7A2)', bg: 'var(--s-17171A)', line: 'var(--b-26262B)', spine: 'var(--s-3A3A40)' },
  grabado: { label: 'Grabado', color: 'var(--t-E7C15A)', bg: 'var(--s-1C1707)', line: 'var(--b-8A7233)', spine: 'var(--s-E7C15A)' },
  colocado: { label: 'Colocado', color: 'var(--t-57C98A)', bg: 'var(--s-12241A)', line: 'var(--b-1E3A2A)', spine: 'var(--s-57C98A)' },
  na: { label: 'Sin precinto', color: 'var(--t-E5645C)', bg: 'var(--s-241211)', line: 'var(--b-3C1E1C)', spine: 'var(--s-E5645C)' },
};
const estadoDe = (it) => (it.apto ? it.estado : 'na');
const keyInf = (i) => `${i.client_id}|${i.ibm || ''}|${i.informe}`;
const tagUrl = (token) => `${PUBLIC_URL}/?tag=${token}`;

export default function Precintos({ toast }) {
  const [informes, setInformes] = useState(null);
  const [err, setErr] = useState(null);
  const [sel, setSel] = useState(null);
  const [items, setItems] = useState(null);
  const [itemsErr, setItemsErr] = useState(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [q, setQ] = useState('');
  const [fEst, setFEst] = useState('all');
  const [grabar, setGrabar] = useState(null);
  const [serie, setSerie] = useState(null); // { cola, titulo } · grabado seguido desde el teléfono

  const loadInformes = useCallback(async (pickKey) => {
    try {
      const r = await api('/api/precintos/informes');
      setInformes(r);
      setErr(null);
      setSel((cur) => pickKey || cur || (r[0] && keyInf(r[0])) || null);
      return r;
    } catch (e) { setErr(e.message); return []; }
  }, []);

  // Si se cambia de informe rápido, una respuesta vieja no pisa la del informe elegido
  const pedido = useRef(0);
  const loadItems = useCallback(async (inf, limpiar = false) => {
    const n = ++pedido.current;
    if (!inf) { setItems(null); return; }
    if (limpiar) setItems(null);
    setLoadingItems(true);
    try {
      const qs = `?client=${encodeURIComponent(inf.client_id)}&ibm=${encodeURIComponent(inf.ibm || '')}`;
      const r = await api('/api/precintos/informes/' + encodeURIComponent(inf.informe) + qs);
      if (n !== pedido.current) return;
      setItems(r); setItemsErr(null);
    } catch (e) { if (n === pedido.current) { setItems([]); setItemsErr(e.message); } }
    finally { if (n === pedido.current) setLoadingItems(false); }
  }, []);

  useEffect(() => { loadInformes(); }, [loadInformes]);

  useEffect(() => { setFEst('all'); loadItems(infSel, true); /* eslint-disable-next-line */ }, [sel]);

  // Guarda el estado del tag (y el número de chip y el link que tenía antes, si se grabó desde el
  // teléfono). Si el tag era de otra pieza, esa queda sin tag y se recarga la lista. Tira error si falla.
  async function guardarEstado(it, estado, uid, antesToken) {
    const body = { estado };
    if (uid) body.uid = uid;
    if (antesToken && antesToken !== it.token) body.antes_token = antesToken;
    if (infSel && infSel.informe) body.informe = infSel.informe; // queda en el registro de grabados (para facturar)
    const r = await api(`/api/precintos/tags/${it.tag_id}/estado`, { method: 'POST', body: JSON.stringify(body) });
    setItems((xs) => (xs || []).map((x) => (x.tag_id === it.tag_id ? { ...x, estado: r.estado } : x)));
    if (r.liberadas && r.liberadas.length) loadItems(infSel);
    loadInformes();
    return r;
  }
  async function setEstado(it, estado, msg) {
    try { await guardarEstado(it, estado); if (msg) toast(msg); }
    catch (e) { toast('No se pudo actualizar: ' + e.message); }
  }

  async function onImported(rows) {
    const row = rows && rows[0];
    const lista = await loadInformes();
    if (!row) return;
    const cli = String(row.cliente || '').trim().toLowerCase();
    const ibm = String(row.ibm || '').trim();
    const num = String(row.informe || '').trim();
    const match = (lista || []).find((i) =>
      String(i.informe) === num && String(i.ibm || '') === ibm && String(i.cliente || '').toLowerCase() === cli);
    if (match) { setSel(keyInf(match)); loadItems(match); }
  }

  const aptos = (items || []).filter((x) => x.apto);
  const col = aptos.filter((x) => x.estado === 'colocado').length;
  const gra = aptos.filter((x) => x.estado === 'grabado').length;
  const pen = aptos.length - col - gra;
  const pct = aptos.length ? Math.round((col / aptos.length) * 100) : 0;

  const qn = q.trim().toLowerCase();
  const listaInf = (informes || []).filter((i) => !qn || String(i.informe).toLowerCase().includes(qn) || (i.cliente || '').toLowerCase().includes(qn));
  const visibles = (items || []).filter((x) => fEst === 'all' || estadoDe(x) === fEst);
  const infSel = (informes || []).find((i) => keyInf(i) === sel) || null;
  const esAdmin = getUser()?.role === 'admin';
  const tituloInf = infSel ? `INF ${infSel.informe} · ${infSel.cliente}${infSel.ibm ? ` · IBM ${infSel.ibm}` : ''}` : '';
  const pendientes = aptos.filter((x) => x.estado === 'pendiente');
  const [corregir, setCorregir] = useState(false);

  return (
    <div>
      <ImportPanel toast={toast} onImported={onImported} title="1 · Cargar Hoja 2 del informe" />

      <div className="axt-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '18px 20px 6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Tag size={17} color="var(--t-E7C15A)" />
              <span style={{ font: '600 15px "Oswald", sans-serif', color: 'var(--t-F3F1EC)' }}>2 · Grabar y colocar tags</span>
            </div>
            <div className="pr-search">
              <Search size={14} color="var(--t-6E6C69)" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar informe o cliente" aria-label="Buscar informe o cliente" />
            </div>
          </div>

          {err ? <div style={{ marginTop: 12 }}><ErrorNote error={err} /></div>
            : !informes ? <Spinner label="Cargando informes…" />
            : informes.length === 0 ? (
              <div className="pr-empty">Todavía no hay informes cargados. Subí la Hoja 2 en el paso 1.</div>
            ) : (
              <div className="pr-infs" role="tablist" aria-label="Informes">
                {listaInf.map((i) => (
                  <button key={keyInf(i)} role="tab" aria-selected={keyInf(i) === sel} className={'pr-inf' + (keyInf(i) === sel ? ' on' : '')} onClick={() => setSel(keyInf(i))}>
                    <b>INF {i.informe}</b>
                    <span>{i.cliente}{i.ibm ? ` · IBM ${i.ibm}` : ''}</span>
                    <em>{i.colocados}/{i.aptos} colocados</em>
                  </button>
                ))}
                {listaInf.length === 0 && <span className="pr-muted">Ningún informe coincide con “{q}”.</span>}
              </div>
            )}
        </div>

        {sel && infSel && (
          <>
            <div className="pr-progress">
              <div>
                <div className="pr-big">{col}<em> / {aptos.length}</em></div>
                <div className="pr-muted">tags colocados del informe {infSel.informe}{infSel.ibm ? ` · IBM ${infSel.ibm}` : ''}</div>
                <div className="pr-prog-btns">
                  {pendientes.length > 0 && (puedeGrabar() ? (
                    <button className="axt-btn primary" onClick={() => setSerie({ cola: pendientes, titulo: tituloInf })}>
                      <Smartphone size={14} /> Grabar en serie ({pendientes.length})
                    </button>
                  ) : (
                    <span className="pr-muted pr-nota-serie">Para grabar varios seguidos, abrí Olympus en Chrome desde un Android.</span>
                  ))}
                  {esAdmin && (
                    <button className="axt-btn small" onClick={() => setCorregir((v) => !v)}>
                      <Pencil size={12} /> Corregir informe
                    </button>
                  )}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="pr-bar"><i style={{ width: pct + '%' }} /></div>
                <div className="pr-legend">
                  <span><i style={{ background: EST.colocado.spine }} />{col} colocados</span>
                  <span><i style={{ background: EST.grabado.spine }} />{gra} grabados</span>
                  <span><i style={{ background: 'var(--s-6E6C69)' }} />{pen} pendientes</span>
                </div>
              </div>
            </div>

            {esAdmin && corregir && (
              <CorregirInforme inf={infSel} toast={toast} onCancel={() => setCorregir(false)}
                onSaved={async (r) => {
                  setCorregir(false);
                  const nueva = `${r.client_id}|${r.ibm || ''}|${r.informe}`;
                  await loadInformes(nueva);
                  setSel(nueva);
                }} />
            )}

            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', padding: '0 20px 12px' }}>
              {[['all', 'Todos'], ['pendiente', 'Pendientes'], ['grabado', 'Grabados'], ['colocado', 'Colocados']].map(([v, l]) => (
                <button key={v} className={'fchip' + (fEst === v ? ' on' : '')} onClick={() => setFEst(v)}>{l}</button>
              ))}
            </div>

            {loadingItems && !items ? <Spinner label="Cargando ítems…" />
              : itemsErr ? <div style={{ padding: '0 20px 16px' }}><ErrorNote error={itemsErr} /></div>
              : (
                <div className="pr-ledger">
                  <div className="pr-row pr-head"><div /><div>Pieza</div><div className="pr-hide">Resultado</div><div className="pr-hide">Tag</div><div /></div>
                  {visibles.map((it) => <ItemRow key={it.tag_id + '-' + it.asset_id} it={it} onGrabar={() => setGrabar(it)} onEstado={setEstado} />)}
                  {visibles.length === 0 && <div className="pr-empty">No hay piezas con ese estado.</div>}
                </div>
              )}
          </>
        )}
      </div>

      {grabar && (
        <GrabarPanel
          it={grabar}
          onClose={() => setGrabar(null)}
          onDone={() => { const it = grabar; setGrabar(null); setEstado(it, 'grabado', 'Tag grabado · falta colocarlo'); }}
          onTelefono={() => { const it = grabar; setGrabar(null); setSerie({ cola: [it], titulo: tituloInf }); }}
        />
      )}

      {serie && (
        <GrabarSerie
          cola={serie.cola}
          todos={items}
          titulo={serie.titulo}
          guardar={guardarEstado}
          onClose={() => setSerie(null)}
        />
      )}
    </div>
  );
}

// Corregir el Nº de informe y/o el IBM de todas las piezas de un informe (solo Administración)
function CorregirInforme({ inf, toast, onCancel, onSaved }) {
  const [numero, setNumero] = useState(String(inf.informe));
  const [ibm, setIbm] = useState(inf.ibm || '');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function guardar() {
    const cambiaNum = numero.trim() !== String(inf.informe);
    const cambiaIbm = ibm.trim() !== (inf.ibm || '');
    if (!cambiaNum && !cambiaIbm) { toast('No cambiaste nada'); return; }
    if (!numero.trim()) { toast('Escribí el Nº de informe'); return; }
    const txt = [cambiaNum && `informe ${inf.informe} → ${numero.trim()}`, cambiaIbm && `IBM ${inf.ibm || '(vacío)'} → ${ibm.trim() || '(vacío)'}`].filter(Boolean).join(' y ');
    if (!window.confirm(`¿Corregir ${txt} en las ${inf.items} piezas de este informe?\nQueda registrado. El cliente lo va a ver corregido al escanear.`)) return;
    setOcupado(true);
    try {
      const r = await api('/api/precintos/informes/corregir', {
        method: 'POST',
        body: JSON.stringify({ client_id: inf.client_id, ibm: inf.ibm || null, numero: inf.informe, nuevo_numero: numero.trim(), nuevo_ibm: ibm.trim() || null, motivo }),
      });
      toast(`Informe corregido en ${r.piezas} ${r.piezas === 1 ? 'pieza' : 'piezas'}`);
      await onSaved(r);
    } catch (e) { toast(e.message); }
    finally { setOcupado(false); }
  }
  return (
    <div className="cor-form" style={{ margin: '0 20px 14px' }}>
      <div className="cor-titulo">Corregir informe {inf.informe} · {inf.cliente}</div>
      <div className="cor-grid">
        <label className="fld"><span>Nº de informe</span><input value={numero} onChange={(e) => setNumero(e.target.value)} /></label>
        <label className="fld"><span>IBM</span><input value={ibm} onChange={(e) => setIbm(e.target.value)} placeholder="ej: 195" /></label>
      </div>
      <label className="fld"><span>Motivo (opcional)</span><input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej: Informes Técnicos pasó el 400 y era el 401" /></label>
      <div className="cor-botones">
        <button className="axt-btn primary small" onClick={guardar} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar corrección'}</button>
        <button className="axt-btn small" onClick={onCancel}>Cancelar</button>
      </div>
      <div className="cor-nota">Cambia el dato en todas las piezas de este informe. Los tags no se tocan. Para corregir una sola pieza (serie, presión, descripción…), abrila desde Administración.</div>
    </div>
  );
}

function ItemRow({ it, onGrabar, onEstado }) {
  const e = estadoDe(it);
  const st = EST[e];
  let action;
  if (e === 'na') action = <span className="pr-muted">No aplica</span>;
  else if (e === 'pendiente') action = <button className="axt-btn small primary" onClick={onGrabar}>Grabar tag</button>;
  else if (e === 'grabado') action = (
    <span className="pr-actions">
      <button className="axt-x sm" title="Deshacer: volver a pendiente" aria-label="Deshacer grabado" onClick={() => onEstado(it, 'pendiente', 'Volvió a pendiente')}><Undo2 size={13} /></button>
      <button className="axt-btn small" onClick={() => onEstado(it, 'colocado', 'Marcado como colocado')}>Marcar colocado</button>
    </span>
  );
  else action = (
    <span className="pr-actions">
      <button className="axt-x sm" title="Deshacer: volver a grabado" aria-label="Deshacer colocado" onClick={() => onEstado(it, 'grabado', 'Volvió a grabado')}><Undo2 size={13} /></button>
      <span className="pr-ok">✓ Listo</span>
    </span>
  );

  return (
    <div className="pr-row">
      <div className="pr-spine" style={{ background: st.spine }} />
      <div className="pr-cell" style={{ minWidth: 0 }}>
        <div className="pr-serial">{it.code}</div>
        <div className="pr-desc">{it.name}</div>
        <div className="pr-mobile-st" style={{ color: st.color }}>{st.label}</div>
      </div>
      <div className="pr-cell pr-hide">
        <span className={'pr-badge ' + (it.apto ? 'ok' : 'bad')}>{it.resultado || '—'}</span>
      </div>
      <div className="pr-cell pr-hide">
        <span className="pr-pill" style={{ color: st.color, background: st.bg, borderColor: st.line }}>{st.label}</span>
      </div>
      <div className="pr-cell" style={{ textAlign: 'right' }}>{action}</div>
    </div>
  );
}

function GrabarPanel({ it, onClose, onDone, onTelefono }) {
  const url = tagUrl(it.token);
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);
  const canWrite = puedeGrabar();

  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 360, color: { dark: '#0A0A0C', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(null));
  }, [url]);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); } catch { /* sin permiso de portapapeles */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <aside className="pr-panel" role="dialog" aria-label={'Grabar tag de ' + it.code}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
          <div style={{ minWidth: 0 }}>
            <div className="pr-eyebrow">Grabar tag</div>
            <div className="pr-serial" style={{ fontSize: 20, margin: '6px 0 4px' }}>{it.code}</div>
            <div className="pr-desc">{it.name}</div>
            <div className="pr-muted" style={{ marginTop: 4 }}>{it.cliente}{it.ibm ? ` · IBM ${it.ibm}` : ''}</div>
          </div>
          <button className="axt-x sm" onClick={onClose} aria-label="Cerrar"><X size={15} /></button>
        </div>

        {qr && <img src={qr} alt={'QR del tag de ' + it.code} className="pr-qr" />}
        <div className="pr-url">{url}</div>
        <button className="axt-btn" style={{ width: '100%' }} onClick={copy}>
          {copied ? <><Check size={14} /> Copiada</> : <><Copy size={14} /> Copiar URL</>}
        </button>

        {canWrite && (
          <button className="axt-btn" style={{ width: '100%', marginTop: 8 }} onClick={onTelefono}>
            <Smartphone size={14} /> Grabar desde este teléfono
          </button>
        )}

        <ol className="pr-steps">
          <li>Abrí <b>NFC Tools</b> → Escribir → Agregar registro → <b>URL</b></li>
          <li>Pegá la URL copiada</li>
          <li>Tocá Escribir y acercá el <b>DATABAND2</b> al teléfono</li>
        </ol>

        <button className="axt-btn primary" style={{ width: '100%' }} onClick={onDone}>Ya lo grabé</button>
      </aside>
    </>
  );
}
