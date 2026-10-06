import React, { useState } from 'react';
import { Tag, ChevronLeft, ChevronRight, ChevronDown, FileDown, CalendarRange, Recycle, Building2, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from './api.js';
import { useData, Spinner, ErrorNote, StatTile } from './ui.jsx';
import { Encabezado } from './AdminGestion.jsx';

/* Tags grabados (solo Administración): cuántos tags se grabaron para cada empresa en un
   período, para saber qué facturarle a cada una. Cuenta cada vez que un tag pasa a grabado;
   si se deshace, no cuenta. Los tags recuperados que se vuelven a grabar cuentan y se muestran aparte. */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const dos = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${dos(m + 1)}-${dos(d)}`;
const rangoMes = (y, m) => ({ desde: iso(y, m, 1), hasta: iso(y, m, new Date(y, m + 1, 0).getDate()) });
const fmtFecha = (s) => { const [y, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}/${y}`; };
// hoy en Argentina, para el mes por defecto
const hoyAR = () => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m] = p.split('-').map(Number);
  return { y, m: m - 1 };
};

export default function Grabados({ toast }) {
  const hoy = hoyAR();
  const [mes, setMes] = useState(hoy); // { y, m } o null si se eligieron fechas a mano
  const [libre, setLibre] = useState(null); // { desde, hasta }
  const [elegir, setElegir] = useState(false);
  const [f, setF] = useState(() => rangoMes(hoy.y, hoy.m));
  const [abierta, setAbierta] = useState(null);
  const [bajando, setBajando] = useState(null);

  const periodo = libre || rangoMes(mes.y, mes.m);
  const titulo = libre ? `${fmtFecha(libre.desde)} al ${fmtFecha(libre.hasta)}` : `${MESES[mes.m]} ${mes.y}`;
  const qs = `?desde=${periodo.desde}&hasta=${periodo.hasta}`;
  const r = useData(() => api('/api/grabados/resumen' + qs), [qs]);
  const esEsteMes = !libre && mes.y === hoy.y && mes.m === hoy.m;

  const mover = (d) => {
    const base = libre ? hoy : mes;
    const n = new Date(base.y, base.m + d, 1);
    setLibre(null); setAbierta(null);
    setMes({ y: n.getFullYear(), m: n.getMonth() });
  };
  function aplicarFechas() {
    if (!f.desde || !f.hasta || f.desde > f.hasta) { toast('Revisá las fechas: "desde" tiene que ser antes que "hasta"'); return; }
    setLibre({ desde: f.desde, hasta: f.hasta }); setAbierta(null); setElegir(false);
  }

  async function excel(empresa) {
    if (bajando) return;
    setBajando(empresa ? empresa.client_id || empresa.cliente : 'todo');
    try {
      const det = await api('/api/grabados' + qs + (empresa && empresa.client_id ? `&client_id=${empresa.client_id}` : ''));
      const emps = empresa ? [empresa] : r.data.empresas;
      const resumen = [];
      for (const e of emps) for (const x of e.ibms) {
        resumen.push({ 'Empresa': e.cliente, 'IBM': x.ibm || '', 'Tags grabados': x.total, 'De ellos, recuperados': x.reusados, 'Informes': x.informes });
      }
      resumen.push({ 'Empresa': 'TOTAL', 'IBM': '', 'Tags grabados': emps.reduce((s, e) => s + e.total, 0), 'De ellos, recuperados': emps.reduce((s, e) => s + e.reusados, 0), 'Informes': '' });
      const detalle = det.map((d) => ({
        'Fecha': new Date(d.created_at).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        'Empresa': d.cliente, 'IBM': d.ibm || '', 'Informe': d.informe || '', 'Nº de serie': d.code || '', 'Descripción': d.descripcion || '',
        'Grabó': d.usuario || '', 'Tag recuperado': d.reusado ? 'Sí' : 'No',
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalle), 'Detalle');
      const per = libre ? `${periodo.desde}_a_${periodo.hasta}` : `${mes.y}-${dos(mes.m + 1)}`;
      const quien = empresa ? '-' + String(empresa.cliente).replace(/[^\w\-]+/g, '_') : '';
      XLSX.writeFile(wb, `tags-grabados-${per}${quien}.xlsx`);
    } catch (e) { toast('No se pudo bajar el Excel: ' + e.message); }
    finally { setBajando(null); }
  }

  const d = r.data;
  return (
    <>
      <Encabezado icon={Tag} titulo="Tags grabados" sub="Cuántos tags se grabaron para cada empresa, para facturar." >
        {d && d.total > 0 && (
          <button className="axt-btn small primary" onClick={() => excel(null)} disabled={!!bajando}>
            {bajando === 'todo' ? <Loader2 size={13} className="spin" /> : <FileDown size={13} />} Excel del período
          </button>
        )}
      </Encabezado>

      <div className="axt-card gb-periodo">
        <div className="gb-nav">
          <button className="axt-x" onClick={() => mover(-1)} aria-label="Mes anterior" title="Mes anterior"><ChevronLeft size={17} /></button>
          <div className="gb-titulo">{titulo}</div>
          <button className="axt-x" onClick={() => mover(1)} disabled={esEsteMes} aria-label="Mes siguiente" title="Mes siguiente"><ChevronRight size={17} /></button>
        </div>
        <div className="gb-nav-der">
          {!esEsteMes && <button className="axt-btn small" onClick={() => { setLibre(null); setMes(hoy); setAbierta(null); }}>Este mes</button>}
          <button className={'axt-btn small' + (elegir ? ' on' : '')} onClick={() => setElegir((v) => !v)} aria-expanded={elegir}><CalendarRange size={13} /> Elegir fechas</button>
        </div>
        {elegir && (
          <div className="gb-fechas">
            <label className="fld"><span>Desde</span><input type="date" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></label>
            <label className="fld"><span>Hasta</span><input type="date" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></label>
            <button className="axt-btn primary" onClick={aplicarFechas}>Ver</button>
          </div>
        )}
      </div>

      {r.loading && !d ? <Spinner /> : r.error ? <ErrorNote error={r.error} /> : d && (
        <>
          <div className="axt-kpis gb-kpis">
            <StatTile i={0} label="Tags grabados" value={d.total} sub={titulo} color="var(--t-D9B44A)" icon={Tag} />
            <StatTile i={1} label="Empresas" value={d.empresas.length} sub="con tags grabados" color="var(--t-7FB0C8)" icon={Building2} />
            <StatTile i={2} label="Tags recuperados" value={d.reusados} sub="reusados (incluidos en el total)" color="var(--t-4FC98B)" icon={Recycle} />
          </div>

          <div className="axt-card" style={{ padding: 0, overflow: 'hidden', marginTop: 16 }}>
            {!d.empresas.length ? (
              <div className="gs-vacio">No se grabaron tags en este período.</div>
            ) : d.empresas.map((e) => {
              const k = String(e.client_id || e.cliente);
              const open = abierta === k;
              return (
                <div key={k} className={'gb-emp' + (open ? ' open' : '')}>
                  <button className="gb-emp-fila" onClick={() => setAbierta(open ? null : k)} aria-expanded={open}>
                    <span className="gb-emp-txt">
                      <span className="gb-emp-nombre">{e.cliente}</span>
                      <span className="gs-ibms">
                        {e.ibms.slice(0, 5).map((x) => <span key={x.ibm || '-'} className="gs-ibm">{x.ibm ? `IBM ${x.ibm}` : 'Sin IBM'} · {x.total}</span>)}
                        {e.ibms.length > 5 && <span className="gs-mute">+{e.ibms.length - 5}</span>}
                      </span>
                    </span>
                    <span className="gb-emp-num">
                      <b>{e.total}</b>
                      <span>{e.total === 1 ? 'tag' : 'tags'}{e.reusados ? ` · ${e.reusados} recup.` : ''}</span>
                    </span>
                    <ChevronDown size={17} color="var(--t-7A8792)" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.15s', flex: 'none' }} />
                  </button>
                  {open && (
                    <div className="gb-det">
                      <table className="gb-tabla">
                        <thead><tr><th>IBM</th><th>Tags</th><th>Recuperados</th><th>Informes</th></tr></thead>
                        <tbody>
                          {e.ibms.map((x) => (
                            <tr key={x.ibm || '-'}><td>{x.ibm ? `IBM ${x.ibm}` : 'Sin IBM'}</td><td><b>{x.total}</b></td><td>{x.reusados}</td><td>{x.informes}</td></tr>
                          ))}
                        </tbody>
                      </table>
                      <button className="axt-btn small" onClick={() => excel(e)} disabled={!!bajando}>
                        {bajando === (e.client_id || e.cliente) ? <Loader2 size={13} className="spin" /> : <FileDown size={13} />} Excel de {e.cliente}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="gs-nota">
            Cuenta cada tag grabado en Precintos (o en la ficha de la pieza), en la fecha en que se grabó y con la empresa e IBM que tenía la pieza en ese momento.
            Si un grabado se deshace (vuelve a pendiente), no cuenta. Marcarlo como colocado no suma de nuevo.
            Los tags recuperados que se vuelven a grabar cuentan y además se muestran aparte.
          </div>
        </>
      )}
    </>
  );
}
