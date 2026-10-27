import React, { useState, useEffect, useRef } from 'react';
import { X, FileDown, Loader2, Search, CalendarRange, CheckCircle2, AlertTriangle, Tag, Package, PlayCircle, Building2, MapPin, Hash } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from './api.js';
import { STATUS, Spinner, ErrorNote, tinte, useEscape } from './ui.jsx';
import { epcLindo } from './Pistola.jsx';

/* Registro de entradas (remitos) de Trazabilidad: todas las entradas guardadas, con filtros por
   empresa (la dueña de las piezas leídas), base, Nº de remito y fechas. Cada entrada se abre para
   ver sus piezas; las abiertas se pueden seguir cargando. Excel del filtro o de una entrada. */

const SIN_BASE = '__sin__';
const TANDA = 50;
const fmtFechaHora = (d) => (d ? new Date(d).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '');
// nombre de archivo sin tildes ni espacios: "Base Añelo" → "Base_Anelo"
const paraArchivo = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\-.]+/g, '_');
const nPiezas = (n) => `${n} ${n === 1 ? 'pieza' : 'piezas'}`;
const ESTADO_CERT = (s) => (s ? (STATUS[s] || STATUS.sin_cert).label : 'Sin pieza asociada');

function Estado({ status }) {
  return status === 'confirmed'
    ? <span className="ok-badge"><CheckCircle2 size={12} /> Confirmada</span>
    : <span className="ok-badge abierta">Abierta</span>;
}

function hojaExcel(entradas, piezas, nombre) {
  const resumen = entradas.map((e) => ({
    'Fecha': fmtFechaHora(e.created_at),
    'N.º de entrada': e.remito || `#${e.id}`,
    'Base': e.origen || '',
    'Empresas': (e.clientes || []).join(', '),
    'IBM': (e.ibms || []).join(', '),
    'Piezas': e.items,
    'Con alerta': e.alertas,
    'Sin pieza asociada': e.sin_pieza,
    'Estado': e.status === 'confirmed' ? 'Confirmada' : 'Abierta',
    'Confirmada el': fmtFechaHora(e.confirmed_at),
    'Cargó': e.usuario || '',
  }));
  const detalle = piezas.map((p) => ({
    'Fecha': fmtFechaHora(p.created_at),
    'N.º de entrada': p.remito || `#${p.entrada_id}`,
    'Base': p.origen || '',
    'Empresa': p.cliente || '',
    'IBM': p.ibm || '',
    'Nº de serie': p.code || '',
    'Descripción': p.name || 'Tag sin pieza asociada',
    'EPC': p.scanned_epc,
    'Certificado': ESTADO_CERT(p.status),
    'Leído': fmtFechaHora(p.scanned_at),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Entradas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Piezas');
  XLSX.writeFile(wb, nombre);
}

export function RegistroEntradas({ toast, onRetomar }) {
  const [f, setF] = useState({ cliente: '', ibm: '', base: '', q: '', desde: '', hasta: '' });
  const [qEscrito, setQEscrito] = useState('');
  const [fechas, setFechas] = useState(false);
  const [opc, setOpc] = useState(null); // { clientes, bases, sin_base }
  const [data, setData] = useState(null); // { total, piezas, entradas }
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [masCargando, setMasCargando] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [bajando, setBajando] = useState(false);
  const pedido = useRef(0);

  const qs = (extra = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...extra })) if (v !== '' && v != null) p.set(k, v);
    return p.toString();
  };

  useEffect(() => { api('/api/entradas/filtros').then(setOpc).catch(() => setOpc({ clientes: [], bases: [], sin_base: 0 })); }, []);
  // lo que se escribe en "remito" se busca un instante después de dejar de escribir
  useEffect(() => { const t = setTimeout(() => setF((x) => (x.q === qEscrito.trim() ? x : { ...x, q: qEscrito.trim() })), 350); return () => clearTimeout(t); }, [qEscrito]);
  useEffect(() => {
    const n = ++pedido.current;
    setCargando(true); setError(null);
    api('/api/entradas/registro?' + qs({ limit: TANDA }))
      .then((r) => { if (n === pedido.current) setData(r); })
      .catch((e) => { if (n === pedido.current) setError(e.message); })
      .finally(() => { if (n === pedido.current) setCargando(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f]);

  async function mas() {
    setMasCargando(true);
    try {
      const r = await api('/api/entradas/registro?' + qs({ limit: TANDA, offset: data.entradas.length }));
      setData((d) => ({ ...d, entradas: [...d.entradas, ...r.entradas] }));
    } catch (e) { toast('No se pudieron traer más: ' + e.message); }
    finally { setMasCargando(false); }
  }

  async function excel() {
    if (bajando) return;
    setBajando(true);
    try {
      const [todas, piezas] = await Promise.all([
        api('/api/entradas/registro?' + qs({ limit: 500 })),
        api('/api/entradas/registro/piezas?' + qs()),
      ]);
      const partes = [];
      const cli = opc && opc.clientes.find((c) => String(c.id) === String(f.cliente));
      if (cli) partes.push(cli.name);
      if (f.ibm) partes.push('IBM-' + f.ibm);
      if (f.base) partes.push(f.base === SIN_BASE ? 'sin-base' : f.base);
      if (f.desde || f.hasta) partes.push(`${f.desde || 'inicio'}_a_${f.hasta || 'hoy'}`);
      const nombre = 'entradas' + (partes.length ? '-' + partes.join('-') : '') + '.xlsx';
      hojaExcel(todas.entradas, piezas, paraArchivo(nombre));
      if (todas.total > todas.entradas.length) toast(`El Excel trae las ${todas.entradas.length} entradas más nuevas de ${todas.total}. Filtrá por fecha para el resto.`);
    } catch (e) { toast('No se pudo armar el Excel: ' + e.message); }
    finally { setBajando(false); }
  }

  // IBMs para elegir: los del cliente elegido, o todos (juntando las empresas que lo usan)
  const ibmsDe = (cli) => {
    const xs = (opc?.ibms || []).filter((i) => !cli || String(i.client_id) === String(cli));
    const m = new Map();
    for (const i of xs) { const y = m.get(i.ibm) || { ibm: i.ibm, nombres: [] }; y.nombres.push(i.cliente); m.set(i.ibm, y); }
    return [...m.values()].map((y) => ({ ibm: y.ibm, clientes: y.nombres.join(', ') })).sort((a, b) => String(a.ibm).localeCompare(String(b.ibm), 'es', { numeric: true }));
  };
  const hayFiltro = f.cliente || f.ibm || f.base || f.q || f.desde || f.hasta;
  const limpiar = () => { setF({ cliente: '', ibm: '', base: '', q: '', desde: '', hasta: '' }); setQEscrito(''); };
  const poner = (k, v) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="ent-reg">
      <div className="axt-card ent-filtros">
        <div className="ent-filtros-fila">
          <label className="fld">
            <span><Building2 size={11} /> Cliente</span>
            <select value={f.cliente} onChange={(e) => setF((x) => ({ ...x, cliente: e.target.value, ibm: x.ibm && ibmsDe(e.target.value).some((i) => i.ibm === x.ibm) ? x.ibm : '' }))} aria-label="Filtrar por cliente">
              <option value="">Todos</option>
              {(opc?.clientes || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="fld">
            <span><Hash size={11} /> IBM</span>
            <select value={f.ibm} onChange={(e) => poner('ibm', e.target.value)} aria-label="Filtrar por IBM" disabled={!ibmsDe(f.cliente).length}>
              <option value="">{ibmsDe(f.cliente).length ? 'Todos' : 'Sin IBM'}</option>
              {ibmsDe(f.cliente).map((i) => <option key={i.ibm} value={i.ibm}>IBM {i.ibm}{!f.cliente && i.clientes ? ` · ${i.clientes}` : ''}</option>)}
            </select>
          </label>
          <label className="fld">
            <span><MapPin size={11} /> Base</span>
            <select value={f.base} onChange={(e) => poner('base', e.target.value)} aria-label="Filtrar por base">
              <option value="">Todas</option>
              {(opc?.bases || []).map((b) => <option key={b.base} value={b.base}>{b.base}</option>)}
              {opc?.sin_base > 0 && <option value={SIN_BASE}>Sin base</option>}
            </select>
          </label>
        </div>
        <div className="ent-filtros-fila">
          <div className="ent-buscar">
            <Search size={14} color="var(--t-6E6C69)" />
            <input value={qEscrito} onChange={(e) => setQEscrito(e.target.value)} placeholder="Buscar N.º de entrada" aria-label="Buscar N.º de entrada" />
            {qEscrito && <button className="ent-buscar-x" onClick={() => setQEscrito('')} aria-label="Borrar búsqueda"><X size={13} /></button>}
          </div>
          <button className={'axt-btn small' + (fechas || f.desde || f.hasta ? ' on' : '')} onClick={() => setFechas((v) => !v)} aria-expanded={fechas}>
            <CalendarRange size={13} /> Fechas
          </button>
        </div>
        {fechas && (
          <div className="ent-filtros-fila">
            <label className="fld"><span>Desde</span><input type="date" value={f.desde} max={f.hasta || undefined} onChange={(e) => poner('desde', e.target.value)} /></label>
            <label className="fld"><span>Hasta</span><input type="date" value={f.hasta} min={f.desde || undefined} onChange={(e) => poner('hasta', e.target.value)} /></label>
          </div>
        )}
      </div>

      <div className="ent-resumen">
        <span>
          {data ? <><b>{data.total}</b> {data.total === 1 ? 'entrada' : 'entradas'} · <b>{data.piezas}</b> {data.piezas === 1 ? 'pieza' : 'piezas'}</> : ' '}
          {hayFiltro && <button className="ent-limpiar" onClick={limpiar}>Quitar filtros</button>}
        </span>
        {data && data.total > 0 && (
          <button className="axt-btn small" onClick={excel} disabled={bajando}>
            {bajando ? <Loader2 size={13} className="spin" /> : <FileDown size={13} />} Excel
          </button>
        )}
      </div>

      {error ? <ErrorNote error={error} /> : !data && cargando ? <Spinner label="Cargando entradas…" /> : data && (
        <div className={'axt-card ent-lista' + (cargando ? ' cargando' : '')}>
          {data.entradas.length === 0 ? (
            <div className="gs-vacio">{hayFiltro ? 'Ninguna entrada coincide con los filtros.' : 'Todavía no hay entradas guardadas.'}</div>
          ) : data.entradas.map((e) => (
            <button key={e.id} className="ent-fila" onClick={() => setAbierta(e.id)}>
              <span className="ent-fila-txt">
                <span className="ent-fila-top">
                  <b className="ent-remito">{e.remito || `Entrada #${e.id}`}</b>
                  <Estado status={e.status} />
                </span>
                <span className="ent-fila-meta">{fmtFechaHora(e.created_at)}{e.origen ? ` · ${e.origen}` : ''}{e.usuario ? ` · ${e.usuario}` : ''}</span>
                {(e.clientes.length > 0 || (e.ibms || []).length > 0) && (
                  <span className="gs-ibms">
                    {e.clientes.map((c) => <span key={c} className="gs-ibm">{c}</span>)}
                    {(e.ibms || []).map((i) => <span key={'i' + i} className="gs-ibm ibm">IBM {i}</span>)}
                  </span>
                )}
              </span>
              <span className="ent-fila-num">
                <b>{e.items}</b>
                <span>{e.items === 1 ? 'pieza' : 'piezas'}</span>
                {e.alertas > 0 && <em className="mal">{e.alertas} con alerta</em>}
                {e.sin_pieza > 0 && <em>{e.sin_pieza} sin pieza</em>}
              </span>
            </button>
          ))}
          {data.entradas.length < data.total && (
            <div className="gs-mas">
              <span>Mostrando {data.entradas.length} de {data.total}</span>
              <button className="axt-btn small" onClick={mas} disabled={masCargando}>{masCargando ? <Loader2 size={13} className="spin" /> : null} Mostrar más</button>
            </div>
          )}
        </div>
      )}

      {abierta && <DetalleEntrada id={abierta} toast={toast} onClose={() => setAbierta(null)} onRetomar={onRetomar} onDescartada={() => setF((x) => ({ ...x }))} />}
    </div>
  );
}

const ALERTA = { overdue: 'Cert vencido', due: 'Por vencer', no_apto: 'No apto', sin_cert: 'Sin certificados' };

export function DetalleEntrada({ id, toast, onClose, onRetomar, onDescartada }) {
  useEscape(onClose);
  const [e, setE] = useState(null);
  const [descartar, setDescartar] = useState(false);
  async function descartarla() {
    try {
      await api(`/api/entradas/${id}`, { method: 'DELETE' });
      toast && toast('Entrada descartada');
      onDescartada && onDescartada();
      onClose();
    } catch (x) { toast && toast('No se pudo descartar: ' + x.message); }
  }
  const [error, setError] = useState(null);
  useEffect(() => { api(`/api/entradas/${id}`).then(setE).catch((x) => setError(x.message)); }, [id]);

  function excel() {
    const fila = { ...e, items: e.items.length, alertas: e.items.filter((i) => i.status && i.status !== 'certified').length, sin_pieza: e.items.filter((i) => !i.asset_id).length, clientes: [...new Set(e.items.map((i) => i.client).filter(Boolean))] };
    const piezas = e.items.map((i) => ({ ...i, created_at: e.created_at, remito: e.remito, origen: e.origen, entrada_id: e.id, cliente: i.client }));
    hojaExcel([fila], piezas, paraArchivo(`entrada-${e.remito || e.id}.xlsx`));
  }

  const alertas = e ? e.items.filter((i) => i.status && i.status !== 'certified').length : 0;
  const sinPieza = e ? e.items.filter((i) => !i.asset_id).length : 0;
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <aside className="pr-panel ser ent-det" role="dialog" aria-label="Detalle de la entrada">
        <div className="ser-top">
          <div style={{ minWidth: 0 }}>
            <div className="pr-eyebrow">Entrada</div>
            <div className="ser-titulo">{e ? (e.remito || `Entrada #${e.id}`) : 'Cargando…'}</div>
          </div>
          <button className="axt-x sm" onClick={onClose} aria-label="Cerrar"><X size={15} /></button>
        </div>
        {error ? <ErrorNote error={error} /> : !e ? <Spinner /> : (
          <>
            <div className="ent-det-datos">
              <div><span>Fecha</span><b>{fmtFechaHora(e.created_at)}</b></div>
              <div><span>Base</span><b>{e.origen || '—'}</b></div>
              <div><span>Cargó</span><b>{e.usuario || '—'}</b></div>
              <div><span>Estado</span><b><Estado status={e.status} /></b></div>
            </div>
            <div className="ent-det-cuentas">
              <span><b>{nPiezas(e.items.length)}</b></span>
              {alertas > 0 && <span className="mal">{alertas} con alerta</span>}
              {sinPieza > 0 && <span>{sinPieza} sin pieza asociada</span>}
            </div>
            <div className="cor-botones">
              {e.status === 'open' && onRetomar && (
                <button className="axt-btn primary small" onClick={() => { onRetomar(e); onClose(); }}><PlayCircle size={14} /> Seguir cargando</button>
              )}
              {e.items.length > 0 && <button className="axt-btn small" onClick={excel}><FileDown size={13} /> Excel de esta entrada</button>}
              {e.status === 'open' && !descartar && <button className="axt-btn small" onClick={() => setDescartar(true)}>Descartar</button>}
            </div>
            {descartar && (
              <div className="ent-descartar">
                <span>¿Descartar esta entrada abierta y todo lo leído?</span>
                <button className="axt-btn small" onClick={descartarla}>Sí, descartar</button>
                <button className="axt-btn small" onClick={() => setDescartar(false)}>No</button>
              </div>
            )}
            {e.items.length === 0 ? (
              <div className="gs-vacio"><Package size={22} /><div>Esta entrada no tiene tags leídos.</div></div>
            ) : (
              <ol className="ent-det-lista">
                {e.items.map((it) => {
                  const st = it.status && it.status !== 'certified' ? (STATUS[it.status] || STATUS.sin_cert) : null;
                  return (
                    <li key={it.id} className="ent-item">
                      <span className="ent-det-ico"><Tag size={14} color="var(--t-D9B44A)" /></span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="ent-det-pieza">{it.code ? `${it.code} · ${it.name}` : 'Tag sin pieza asociada'}</span>
                        <span className="ent-det-sub">{[it.client, it.ibm ? `IBM ${it.ibm}` : null].filter(Boolean).join(' · ')}{it.client ? ' · ' : ''}{epcLindo(it.scanned_epc)}</span>
                      </span>
                      {st && (
                        <span className="axt-flag" style={{ color: st.color, borderColor: tinte(st.color, 33.3), background: tinte(st.color, 8.6) }}>
                          <AlertTriangle size={12} /> {ALERTA[it.status] || st.label}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </aside>
    </>
  );
}
