import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Plus, ChevronRight, ArrowLeft, Pencil, Trash2, ScanLine, ListChecks, ClipboardList, X, Loader2, Search, Check, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from './api.js';
import { Band, Pill, Spinner, ErrorNote, daysLabel, useEscape, sinTildes } from './ui.jsx';

/* Destinos del cliente: listas para agrupar piezas según a dónde van
   (yacimiento, pozo, lugar). Una pieza está en un destino a la vez; si se la
   agrega a otro, se mueve. Se arman con conexión. */

export const lugarDe = (d) => [d.yacimiento, d.pozo, d.lugar].filter(Boolean).join(' · ');
const puedeEscanear = () => typeof window !== 'undefined' && 'NDEFReader' in window;

// Texto corto de lo que pasó al agregar piezas
function resumen(r) {
  const partes = [];
  if (r.agregadas) partes.push(r.agregadas === 1 ? '1 pieza agregada' : `${r.agregadas} piezas agregadas`);
  if (r.movidas && r.movidas.length) partes.push(r.movidas.length === 1 ? `${r.movidas[0].code} estaba en ${r.movidas[0].desde}` : `${r.movidas.length} estaban en otro destino`);
  if (r.ya) partes.push(r.ya === 1 ? '1 ya estaba' : `${r.ya} ya estaban`);
  if (r.no_encontradas) partes.push(r.no_encontradas === 1 ? '1 no es de tus piezas' : `${r.no_encontradas} no son de tus piezas`);
  return partes.join(' · ') || 'Sin cambios';
}

export default function Destinos({ assets, online, toast, onCambio }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [abierto, setAbierto] = useState(null); // id del destino abierto
  const [nuevo, setNuevo] = useState(false);

  const cargar = () => {
    if (!online) return;
    api('/api/me/destinos').then((r) => { setLista(r); setError(null); }).catch((e) => setError(e.message));
  };
  useEffect(cargar, [online]);

  if (!online) return (
    <div className="axt-card ds-vacio">
      <MapPin size={22} color="var(--t-8A97A2)" />
      <div>Los destinos se arman con conexión a internet.</div>
      <div className="ds-sub">Sin señal, el destino de cada pieza se ve igual en <b>Mis activos</b>.</div>
    </div>
  );

  if (abierto) return (
    <DestinoDetalle id={abierto} assets={assets} toast={toast}
      onVolver={() => { setAbierto(null); cargar(); }}
      onCambio={() => { cargar(); onCambio && onCambio(); }} />
  );

  return (
    <div>
      <div className="axt-card ds-intro">
        <div className="ds-intro-t"><MapPin size={16} color="var(--t-E7C15A)" /> Destinos</div>
        <p>Armá listas para agrupar tus piezas según a dónde van: un yacimiento, un pozo, una base. Cada pieza puede estar en un destino a la vez.</p>
        {!nuevo && <button className="axt-btn primary" onClick={() => setNuevo(true)}><Plus size={15} /> Nuevo destino</button>}
        {nuevo && (
          <DestinoForm toast={toast} onCancel={() => setNuevo(false)}
            onGuardado={(d) => { setNuevo(false); cargar(); setAbierto(d.id); }} />
        )}
      </div>

      {error ? <ErrorNote error={error} /> : !lista ? <Spinner /> : !lista.length ? (
        <div className="axt-card ds-vacio">
          <div>Todavía no armaste ningún destino.</div>
          <div className="ds-sub">Por ejemplo: “Pozo LCa-123”, “Base Añelo” o “Locación Fortín de Piedra”.</div>
        </div>
      ) : (
        <div className="axt-card" style={{ padding: 0, overflow: 'hidden' }}>
          {lista.map((d) => (
            <button key={d.id} className="ds-row" onClick={() => setAbierto(d.id)}>
              <span className="ds-ico"><MapPin size={16} /></span>
              <span className="ds-row-txt">
                <span className="ds-nombre">{d.nombre}</span>
                {lugarDe(d) && <span className="ds-lugar">{lugarDe(d)}</span>}
              </span>
              <span className="ds-row-der">
                <span className="ds-cant">{d.piezas} {d.piezas === 1 ? 'pieza' : 'piezas'}</span>
                {d.alertas > 0 && <span className="ds-alerta">{d.alertas} a revisar</span>}
              </span>
              <ChevronRight size={16} color="var(--t-5C6874)" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DestinoForm({ inicial, toast, onCancel, onGuardado }) {
  const [f, setF] = useState({ nombre: '', yacimiento: '', pozo: '', lugar: '', ...(inicial || {}) });
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function guardar() {
    if (!f.nombre.trim()) { toast('Poné un nombre al destino'); return; }
    if (ocupado) return;
    setOcupado(true);
    try {
      const body = JSON.stringify({ nombre: f.nombre, yacimiento: f.yacimiento, pozo: f.pozo, lugar: f.lugar });
      const d = inicial
        ? await api('/api/me/destinos/' + inicial.id, { method: 'PATCH', body })
        : await api('/api/me/destinos', { method: 'POST', body });
      toast(inicial ? 'Destino actualizado' : 'Destino creado');
      onGuardado(d);
    } catch (e) { toast(e.message); }
    finally { setOcupado(false); }
  }
  return (
    <div className="ds-form">
      <label className="fld"><span>Nombre del destino</span>
        <input autoFocus value={f.nombre || ''} onChange={set('nombre')} placeholder="ej: Pozo LCa-123" onKeyDown={(e) => e.key === 'Enter' && guardar()} />
      </label>
      <div className="ds-form-grid">
        <label className="fld"><span>Yacimiento (opcional)</span><input value={f.yacimiento || ''} onChange={set('yacimiento')} placeholder="ej: Loma Campana" /></label>
        <label className="fld"><span>Pozo (opcional)</span><input value={f.pozo || ''} onChange={set('pozo')} placeholder="ej: LCa-123" /></label>
        <label className="fld"><span>Lugar (opcional)</span><input value={f.lugar || ''} onChange={set('lugar')} placeholder="ej: Base Añelo, locación" /></label>
      </div>
      <div className="cor-botones">
        <button className="axt-btn primary" onClick={guardar} disabled={ocupado}>{ocupado ? <Loader2 size={14} className="spin" /> : <Check size={14} />} {inicial ? 'Guardar cambios' : 'Crear destino'}</button>
        <button className="axt-btn" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function DestinoDetalle({ id, assets, toast, onVolver, onCambio }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [editar, setEditar] = useState(false);
  const [elegir, setElegir] = useState(false);
  const [desdeRelev, setDesdeRelev] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const lector = useRef(null);

  const cargar = () => api('/api/me/destinos/' + id).then((r) => { setD(r); setError(null); }).catch((e) => setError(e.message));
  useEffect(() => { cargar(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (lector.current) lector.current.abort(); }, []);

  async function agregar(body) {
    const r = await api(`/api/me/destinos/${id}/piezas`, { method: 'POST', body: JSON.stringify(body) });
    cargar(); onCambio();
    return r;
  }

  // Escanear: cada tag que se acerca se agrega enseguida
  const agregarRef = useRef(agregar);
  agregarRef.current = agregar;
  async function escanear() {
    if (lector.current) { lector.current.abort(); lector.current = null; setEscaneando(false); return; }
    if (!puedeEscanear()) { setElegir(true); return; }
    const ctrl = new AbortController();
    try {
      const reader = new window.NDEFReader();
      await reader.scan({ signal: ctrl.signal });
      lector.current = ctrl;
      setEscaneando(true);
      reader.onreading = async (ev) => {
        let token = null;
        for (const rec of ev.message.records) {
          try { const m = new TextDecoder().decode(rec.data).match(/[?&]tag=([A-Za-z0-9]+)/); if (m) token = m[1]; } catch { /* otro tipo de registro */ }
        }
        if (!token) { toast('Ese tag no es de Olympus'); return; }
        const a = assets.find((x) => x.token === token);
        try {
          const r = await agregarRef.current({ tokens: [token] });
          if (r.agregadas) toast(`Agregada ${a ? a.code : 'la pieza'}${r.movidas.length ? ` (estaba en ${r.movidas[0].desde})` : ''}`);
          else if (r.ya) toast(`${a ? a.code : 'Esa pieza'} ya está en este destino`);
          else toast('Ese tag no es de una pieza tuya');
        } catch (e) { toast('No se pudo agregar: ' + e.message); }
      };
      reader.onreadingerror = () => toast('No se pudo leer el tag, acercalo de nuevo');
    } catch (e) {
      ctrl.abort();
      toast(e && e.name === 'NotAllowedError' ? 'Permití el uso de NFC para escanear' : 'No se pudo activar el NFC: revisá que esté prendido');
    }
  }

  async function quitar(p) {
    try { await api(`/api/me/destinos/${id}/piezas/${p.id}`, { method: 'DELETE' }); toast(`${p.code} salió del destino`); cargar(); onCambio(); }
    catch (e) { toast(e.message); }
  }
  async function borrar() {
    const n = d.piezas.length;
    if (!window.confirm(`¿Borrar el destino "${d.nombre}"?` + (n ? `\nSus ${n === 1 ? 'pieza queda' : n + ' piezas quedan'} sin destino.` : ''))) return;
    try { await api('/api/me/destinos/' + id, { method: 'DELETE' }); toast('Destino borrado'); onCambio(); onVolver(); }
    catch (e) { toast(e.message); }
  }
  function exportar() {
    const rows = d.piezas.map((p) => ({
      'Nº de serie': p.code, 'Descripción': p.name || '', 'IBM': p.ibm || '',
      'Estado': p.status === 'no_apto' ? 'No apto' : p.status === 'overdue' ? 'Vencido' : p.status === 'due' ? 'Por vencer' : p.status === 'certified' ? 'Vigente' : 'Sin dato',
      'Vencimiento': p.next_expiry || '', 'En este destino desde': p.destino_desde ? new Date(p.destino_desde).toLocaleDateString('es-AR') : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'destino');
    XLSX.writeFile(wb, (d.nombre || 'destino').replace(/[^\w\-]+/g, '_') + '.xlsx');
  }

  if (error) return <div><button className="axt-btn small" onClick={onVolver}><ArrowLeft size={14} /> Destinos</button><div style={{ marginTop: 12 }}><ErrorNote error={error} /></div></div>;
  if (!d) return <Spinner />;

  return (
    <div>
      <button className="axt-btn small ds-volver" onClick={onVolver}><ArrowLeft size={14} /> Destinos</button>

      <div className="axt-card ds-cab">
        <div className="ds-cab-top">
          <span className="ds-ico grande"><MapPin size={20} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ds-cab-nombre">{d.nombre}</div>
            {lugarDe(d) && <div className="ds-lugar">{lugarDe(d)}</div>}
            <div className="ds-sub">{d.piezas.length} {d.piezas.length === 1 ? 'pieza' : 'piezas'}</div>
          </div>
          <button className={'axt-x sm' + (editar ? ' on' : '')} title="Editar destino" aria-label="Editar destino" onClick={() => setEditar((v) => !v)}><Pencil size={14} /></button>
          <button className="axt-x sm" title="Borrar destino" aria-label="Borrar destino" onClick={borrar}><Trash2 size={14} /></button>
        </div>
        {editar && <DestinoForm inicial={d} toast={toast} onCancel={() => setEditar(false)} onGuardado={() => { setEditar(false); cargar(); onCambio(); }} />}

        <div className="ds-acciones">
          {puedeEscanear() && (
            <button className={'axt-btn' + (escaneando ? '' : ' primary')} onClick={escanear}>
              {escaneando ? <><span className="ser-onda"><ScanLine size={15} /></span> Escaneando… tocá para terminar</> : <><ScanLine size={15} /> Escanear piezas</>}
            </button>
          )}
          <button className={'axt-btn' + (puedeEscanear() ? '' : ' primary')} onClick={() => setElegir(true)}><ListChecks size={15} /> Elegir de mis activos</button>
          <button className="axt-btn" onClick={() => setDesdeRelev(true)}><ClipboardList size={15} /> Desde un relevamiento</button>
        </div>
        {escaneando && <div className="ds-sub" style={{ marginTop: 8 }}>Acercá cada tag a la parte de atrás del celular: se agrega solo.</div>}
      </div>

      <div className="axt-card" style={{ padding: 0, overflow: 'hidden', marginTop: 14 }}>
        <div className="axt-toolbar">
          <span style={{ font: '700 15px "Oswald"', color: 'var(--t-F3F1EC)' }}>Piezas</span>
          {d.piezas.length > 0 && <button className="axt-btn small" onClick={exportar}><FileDown size={13} /> Excel</button>}
        </div>
        {!d.piezas.length ? (
          <div className="ds-vacio" style={{ border: 'none' }}>Todavía no hay piezas en este destino. Agregalas con los botones de arriba.</div>
        ) : d.piezas.map((p) => (
          <div key={p.id} className="ds-pieza">
            <Band status={p.status || 'sin_cert'} h={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="ds-pieza-code">{p.code}</div>
              <div className="ds-pieza-name">{p.name}{p.ibm ? ` · IBM ${p.ibm}` : ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Pill status={p.status || 'sin_cert'} />
              <div className="ds-pieza-dias">{p.status === 'no_apto' ? 'no habilitada' : daysLabel(p.next_expiry)}</div>
            </div>
            <button className="axt-x sm" title="Sacar del destino" aria-label={'Sacar ' + p.code + ' del destino'} onClick={() => quitar(p)}><X size={14} /></button>
          </div>
        ))}
      </div>

      {elegir && <ElegirPiezas destino={d} assets={assets} toast={toast} onClose={() => setElegir(false)} agregar={agregar} />}
      {desdeRelev && <DesdeRelevamiento destino={d} toast={toast} onClose={() => setDesdeRelev(false)} agregar={agregar} />}
    </div>
  );
}

// Elegir varias piezas de la lista (sirve también en iPhone y computadora)
function ElegirPiezas({ destino, assets, toast, onClose, agregar }) {
  useEscape(onClose);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const [ocupado, setOcupado] = useState(false);
  const yaEstan = new Set(destino.piezas.map((p) => String(p.id)));
  const s = sinTildes(q);
  const visibles = assets.filter((a) => !s || [a.code, a.name, a.destino].some((f) => sinTildes(f).includes(s)));
  const toggle = (id) => setSel((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function confirmar() {
    if (!sel.size || ocupado) return;
    setOcupado(true);
    try { const r = await agregar({ asset_ids: [...sel] }); toast(resumen(r)); onClose(); }
    catch (e) { toast('No se pudo agregar: ' + e.message); }
    finally { setOcupado(false); }
  }
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="phone ds-modal">
        <div className="phone-notch" />
        <div className="phone-bar"><ListChecks size={13} color="var(--t-E7C15A)" /> <span>AGREGAR A {destino.nombre.toUpperCase()}</span><button onClick={onClose} className="phone-x" aria-label="Cerrar"><X size={16} /></button></div>
        <div className="phone-screen">
          <div className="ds-buscar">
            <Search size={14} color="var(--t-6E6C69)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por serie o descripción" aria-label="Buscar pieza" />
          </div>
          {visibles.map((a) => {
            const esta = yaEstan.has(String(a.id));
            const on = esta || sel.has(String(a.id));
            return (
              <label key={a.id} className={'ds-opcion' + (on ? ' on' : '') + (esta ? ' fija' : '')}>
                <input type="checkbox" checked={on} disabled={esta} onChange={() => toggle(String(a.id))} />
                <Band status={a.status} h={30} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="ds-pieza-code">{a.code}</span>
                  <span className="ds-pieza-name">{a.name}</span>
                  {esta ? <span className="ds-en">ya está en este destino</span> : a.destino ? <span className="ds-en otro">ahora en: {a.destino}</span> : null}
                </span>
              </label>
            );
          })}
          {!visibles.length && <div className="ds-sub" style={{ padding: '16px 0', textAlign: 'center' }}>Ninguna pieza coincide.</div>}
        </div>
        <div className="ds-modal-pie">
          <button className="axt-btn primary" style={{ width: '100%' }} onClick={confirmar} disabled={!sel.size || ocupado}>
            {ocupado ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} {sel.size ? `Agregar ${sel.size} ${sel.size === 1 ? 'pieza' : 'piezas'}` : 'Elegí las piezas'}
          </button>
        </div>
      </div>
    </>
  );
}

// Pasar las piezas de un relevamiento guardado a este destino
function DesdeRelevamiento({ destino, toast, onClose, agregar }) {
  useEscape(onClose);
  const [listas, setListas] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  useEffect(() => { api('/api/me/relevamientos').then(setListas).catch(() => setListas([])); }, []);
  async function usar(h) {
    if (ocupado) return;
    setOcupado(h.id);
    try {
      const det = await api('/api/me/relevamientos/' + h.id);
      const tokens = [...new Set(det.items.map((i) => i.token).filter(Boolean))];
      if (!tokens.length) { toast('Esa lista no tiene piezas'); return; }
      const r = await agregar({ tokens });
      toast(resumen(r));
      onClose();
    } catch (e) { toast('No se pudo agregar: ' + e.message); }
    finally { setOcupado(null); }
  }
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="phone ds-modal">
        <div className="phone-notch" />
        <div className="phone-bar"><ClipboardList size={13} color="var(--t-E7C15A)" /> <span>DESDE UN RELEVAMIENTO</span><button onClick={onClose} className="phone-x" aria-label="Cerrar"><X size={16} /></button></div>
        <div className="phone-screen">
          <div className="ds-sub" style={{ marginBottom: 10 }}>Todas las piezas de la lista que elijas pasan a <b>{destino.nombre}</b>.</div>
          {!listas ? <Spinner /> : !listas.length ? (
            <div className="ds-sub" style={{ padding: '16px 0', textAlign: 'center' }}>No tenés relevamientos guardados.</div>
          ) : listas.map((h) => (
            <button key={h.id} className="ds-row" onClick={() => usar(h)} disabled={!!ocupado}>
              <span className="ds-row-txt">
                <span className="ds-nombre">{h.nombre || 'Sin nombre'}</span>
                <span className="ds-lugar">{h.items} {h.items === 1 ? 'pieza' : 'piezas'} · {new Date(h.created_at).toLocaleDateString('es-AR')}</span>
              </span>
              {ocupado === h.id ? <Loader2 size={15} className="spin" /> : <ChevronRight size={16} color="var(--t-5C6874)" />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// Elegir (o crear) un destino para mandar piezas: se usa desde el detalle de un relevamiento
export function MandarADestino({ tokens, toast, onClose, onListo }) {
  useEscape(onClose);
  const [lista, setLista] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const cargar = () => api('/api/me/destinos').then(setLista).catch((e) => { toast(e.message); setLista([]); });
  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function mandar(d) {
    if (ocupado) return;
    setOcupado(d.id);
    try {
      const r = await api(`/api/me/destinos/${d.id}/piezas`, { method: 'POST', body: JSON.stringify({ tokens }) });
      toast(`${d.nombre}: ${resumen(r)}`);
      onListo && onListo();
      onClose();
    } catch (e) { toast('No se pudo: ' + e.message); }
    finally { setOcupado(null); }
  }
  return (
    <>
      <div className="axt-overlay" onClick={onClose} style={{ zIndex: 42 }} />
      <div className="phone ds-modal" style={{ zIndex: 43 }}>
        <div className="phone-notch" />
        <div className="phone-bar"><MapPin size={13} color="var(--t-E7C15A)" /> <span>MANDAR A UN DESTINO</span><button onClick={onClose} className="phone-x" aria-label="Cerrar"><X size={16} /></button></div>
        <div className="phone-screen">
          <div className="ds-sub" style={{ marginBottom: 10 }}>{tokens.length} {tokens.length === 1 ? 'pieza' : 'piezas'}. Si alguna estaba en otro destino, se mueve.</div>
          {nuevo ? (
            <DestinoForm toast={toast} onCancel={() => setNuevo(false)} onGuardado={(d) => { setNuevo(false); mandar(d); }} />
          ) : (
            <button className="axt-btn" style={{ width: '100%', marginBottom: 10 }} onClick={() => setNuevo(true)}><Plus size={14} /> Nuevo destino</button>
          )}
          {!lista ? <Spinner /> : lista.map((d) => (
            <button key={d.id} className="ds-row" onClick={() => mandar(d)} disabled={!!ocupado}>
              <span className="ds-ico"><MapPin size={15} /></span>
              <span className="ds-row-txt">
                <span className="ds-nombre">{d.nombre}</span>
                <span className="ds-lugar">{[lugarDe(d), `${d.piezas} ${d.piezas === 1 ? 'pieza' : 'piezas'}`].filter(Boolean).join(' · ')}</span>
              </span>
              {ocupado === d.id ? <Loader2 size={15} className="spin" /> : <ChevronRight size={16} color="var(--t-5C6874)" />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
