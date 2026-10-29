import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { ScanLine, Search, X, Check, Loader2, SkipForward, AlertTriangle, Link2, Bluetooth, BluetoothConnected, BatteryMedium, BatteryLow, BatteryFull, Square } from 'lucide-react';
import { api } from './api.js';
import { useEscape } from './ui.jsx';
import { lectorR6, hayBluetooth } from './r6.js';

/* Lectura de tags UHF con escáner. Dos formas:
   - Chainway R6 por Bluetooth (r6.js): se conecta desde acá y se lee con su gatillo.
   - Escáneres en modo teclado (Zebra con DataWedge u otra): cada tag llega "tipeado" (EPC en
     hexadecimal) seguido de Enter en un campo que no abre el teclado del celular (inputmode none).
   En los dos casos se junta lo que llega en un gatillazo y se manda de una vez. */

export const normEpc = (v) => {
  const h = String(v ?? '').toUpperCase().replace(/[^0-9A-F]/g, '');
  return h.length >= 8 && h.length <= 128 && h.length % 2 === 0 ? h : null;
};
// "E28068B0000002041AC37B21" → "E280 68B0 0000 0204 1AC3 7B21" (para mostrar)
export const epcLindo = (e) => String(e || '').replace(/(.{4})(?=.)/g, '$1 ');

// Separa lo que llegó en EPCs (por espacios, comas o renglones)
function partir(texto) {
  return String(texto || '').split(/[\s,;]+/).map(normEpc).filter(Boolean);
}

export const useR6 = () => useSyncExternalStore(lectorR6.suscribir, lectorR6.ver);
const r6Conectada = (r6) => r6.estado === 'lista' || r6.estado === 'leyendo';
const nTags = (n) => `${n} ${n === 1 ? 'tag' : 'tags'}`;

// espera: cuánto esperar después del último tag antes de mandar la tanda (modo teclado: el escáner tipea cada EPC en ~1 s)
// parcial: con la R6, mientras lee se van mandando los tags nuevos (si no, todo junto al parar).
// Sin parcial (buscar un solo tag), un gatillazo lee un momento y para solo.
export function CapturaPistola({ onLeidos, activo = true, texto = 'Apretá el gatillo del escáner', ayuda, espera = 350, parcial = true, potenciaFija = false }) {
  const ref = useRef(null);
  const tanda = useRef([]);
  const timer = useRef(null);
  const [foco, setFoco] = useState(false);
  const [ultimo, setUltimo] = useState(null); // { n, t } o { n: 0, t } si no leyó nada
  const cb = useRef(onLeidos);
  cb.current = onLeidos;
  const r6 = useR6();
  const conR6 = r6Conectada(r6);
  const vistos = useRef(new Set());
  const [enCurso, setEnCurso] = useState(0);
  const parcialT = useRef(null);

  const enviar = () => {
    clearTimeout(timer.current);
    const xs = [...new Set(tanda.current)];
    tanda.current = [];
    if (xs.length) { setUltimo({ n: xs.length, t: Date.now() }); cb.current(xs); }
  };
  // lo que quedó escrito en el campo pasa a la tanda; la tanda sale un instante después del último tag
  const juntar = () => {
    const el = ref.current;
    if (!el || !el.value) return;
    tanda.current.push(...partir(el.value));
    el.value = '';
    clearTimeout(timer.current);
    timer.current = setTimeout(enviar, espera);
  };

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(parcialT.current); }, []);
  // tomar el foco al aparecer, salvo que el usuario esté escribiendo en otro campo
  useEffect(() => {
    if (!activo) return;
    const a = document.activeElement;
    if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) ref.current && ref.current.focus({ preventScroll: true });
  }, [activo]);

  // lecturas de la R6 (la pantalla abierta más reciente es la que las recibe)
  const parcialRef = useRef(parcial);
  parcialRef.current = parcial;
  useEffect(() => {
    if (!activo) return undefined;
    return lectorR6.registrar({
      corteMs: parcialRef.current ? 0 : 1500,
      inicio: () => { vistos.current = new Set(); tanda.current = []; setEnCurso(0); },
      tag: (epc) => {
        const e = normEpc(epc);
        if (!e || vistos.current.has(e)) return;
        vistos.current.add(e);
        tanda.current.push(e);
        setEnCurso(vistos.current.size);
        if (parcialRef.current && !parcialT.current) parcialT.current = setTimeout(() => { parcialT.current = null; enviar(); }, 1200);
      },
      fin: () => {
        clearTimeout(parcialT.current); parcialT.current = null;
        if (!vistos.current.size) setUltimo({ n: 0, t: Date.now() });
        enviar();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  if (!activo) return null;
  const leyendo = r6.estado === 'leyendo';
  const reciente = ultimo && Date.now() - ultimo.t < 4000;
  const conBt = hayBluetooth();
  let titulo, sub;
  if (leyendo) {
    titulo = 'Leyendo…';
    sub = !parcial ? (enCurso ? `${nTags(enCurso)} hasta ahora` : 'Apuntá al tag')
      : enCurso ? `${nTags(enCurso)} hasta ahora · gatillo otra vez para parar` : 'Apretá el gatillo otra vez para parar';
  }
  else if (conR6) { titulo = texto; sub = reciente ? (ultimo.n ? `Leídos: ${nTags(ultimo.n)}` : (potenciaFija ? 'No se leyó ningún tag. Acercá el escáner al tag.' : 'No se leyó ningún tag. Acercate más o subí la potencia.')) : (ayuda || 'Escáner conectado, listo para leer'); }
  else if (conBt && !(reciente && ultimo.n)) { titulo = 'Conectá el escáner R6 con el botón de abajo'; sub = foco ? 'Si usás un escáner en modo teclado, ya podés apretar el gatillo' : 'Si usás un escáner en modo teclado, tocá acá antes de apretar el gatillo'; }
  else if (foco) { titulo = texto; sub = reciente && ultimo.n ? `Leídos: ${nTags(ultimo.n)}` : (ayuda || 'Lista para leer'); }
  else { titulo = 'Tocá acá antes de apretar el gatillo'; sub = reciente && ultimo.n ? `Leídos: ${nTags(ultimo.n)}` : 'El escáner escribe acá lo que lee'; }

  return (
    <div className="pis-wrap">
      <label className={'pis-captura' + (foco || conR6 ? ' lista' : '') + (leyendo ? ' leyendo' : '')}>
        <span className="pis-ico"><ScanLine size={18} /></span>
        <span className="pis-txt" aria-live="polite">
          <b>{titulo}</b>
          <span>{sub}</span>
        </span>
        <input
          ref={ref}
          className="pis-input"
          inputMode="none"
          autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
          aria-label="Lecturas del escáner"
          onFocus={() => setFoco(true)}
          onBlur={() => { setFoco(false); juntar(); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); juntar(); } }}
          onInput={(e) => {
            // algunos equipos mandan el Enter como salto de línea, o todo junto sin Enter
            if (/[\r\n]/.test(e.target.value)) { juntar(); return; }
            clearTimeout(timer.current);
            timer.current = setTimeout(() => { juntar(); enviar(); }, Math.max(700, espera));
          }}
        />
      </label>
      {conBt && <BarraR6 fija={potenciaFija} />}
    </div>
  );
}

const POTENCIAS = [[5, 'Mínima'], [10, 'Baja'], [15, 'Media baja'], [20, 'Media'], [25, 'Alta'], [30, 'Máxima']];

// Al grabar o asociar un tag, el escáner lee siempre con la potencia mínima: así toma solo el tag
// que está pegado y no uno que esté a un metro. Mientras la pantalla está abierta la potencia queda
// fija; al cerrarla vuelve la que tenía.
export const POTENCIA_MINIMA = 5;
export function usePotenciaMinima() {
  const r6 = useR6();
  const antes = useRef(null);
  const conectada = r6Conectada(r6);
  useEffect(() => {
    if (!conectada || r6.potencia == null || r6.potencia === POTENCIA_MINIMA) return undefined;
    if (antes.current == null) antes.current = r6.potencia;
    let vivo = true;
    (async () => {
      // si el escáner no acepta el cambio (estaba ocupado), se reintenta: no tiene que quedar leyendo fuerte
      for (let k = 0; k < 3 && vivo; k++) {
        if (await lectorR6.ponerPotencia(POTENCIA_MINIMA)) return;
        await new Promise((r) => setTimeout(r, 400));
      }
    })();
    return () => { vivo = false; };
  }, [conectada, r6.potencia]);
  useEffect(() => () => {
    if (antes.current != null && lectorR6.conectada && lectorR6.ver().potencia === POTENCIA_MINIMA) lectorR6.ponerPotencia(antes.current);
  }, []);
}

// Conectar la R6 por Bluetooth, ver batería, cambiar potencia, leer sin gatillo
// fija: la potencia la maneja la pantalla (grabar / asociar) y no se puede cambiar
export function BarraR6({ fija = false }) {
  const r6 = useR6();
  const [cambiando, setCambiando] = useState(false);
  const [aviso, setAviso] = useState(null);
  if (!hayBluetooth()) return null;
  const buscando = r6.estado === 'buscando' || r6.estado === 'conectando';

  if (!r6Conectada(r6)) {
    return (
      <div className="r6-barra">
        {buscando ? (
          <span className="r6-estado"><Loader2 size={15} className="spin" /> {r6.estado === 'buscando' ? 'Elegí el escáner en la lista…' : (r6.error || 'Conectando con el escáner…')}</span>
        ) : (
          <div className="r6-fila">
            <button className="axt-btn primary r6-conectar" onClick={() => lectorR6.conectar()}>
              <Bluetooth size={15} /> {r6.recordada ? `Conectar ${r6.recordada}` : 'Conectar escáner R6'}
            </button>
            {r6.recordada && <button className="axt-btn small" onClick={() => lectorR6.conectar({ otra: true })}>Otra</button>}
          </div>
        )}
        {r6.error && !buscando && <div className="r6-error" role="alert"><AlertTriangle size={13} style={{ flex: 'none', marginTop: 1 }} /> {r6.error}</div>}
      </div>
    );
  }

  const leyendo = r6.estado === 'leyendo';
  const Bat = r6.bateria == null ? null : r6.bateria <= 20 ? BatteryLow : r6.bateria >= 80 ? BatteryFull : BatteryMedium;
  const opciones = r6.potencia != null && !POTENCIAS.some(([v]) => v === r6.potencia) ? [...POTENCIAS, [r6.potencia, 'Actual']].sort((a, b) => a[0] - b[0]) : POTENCIAS;
  async function potencia(v) {
    setCambiando(true); setAviso(null);
    const ok = await lectorR6.ponerPotencia(v);
    setCambiando(false);
    if (!ok) setAviso('El escáner no aceptó el cambio de potencia. Probá de nuevo.');
  }
  return (
    <div className="r6-barra on">
      <div className="r6-fila">
        <span className="r6-estado">
          <BluetoothConnected size={15} color="var(--t-4FC98B)" />
          <b>{r6.nombre}</b>
          {Bat && <span className={'r6-bat' + (r6.bateria <= 20 ? ' baja' : '')} title="Batería del escáner"><Bat size={15} /> {r6.bateria} %</span>}
        </span>
        <button className="axt-x sm" onClick={() => lectorR6.desconectar()} aria-label="Desconectar el escáner" title="Desconectar el escáner"><X size={14} /></button>
      </div>
      <div className="r6-fila">
        <label className="r6-pot">
          <span>Potencia</span>
          <select value={r6.potencia ?? ''} onChange={(e) => potencia(Number(e.target.value))} disabled={fija || cambiando || leyendo} aria-label="Potencia de lectura"
            title={fija ? 'Para grabar y asociar, la potencia queda en la mínima' : undefined}>
            {r6.potencia == null && <option value="">—</option>}
            {opciones.map(([v, n]) => <option key={v} value={v}>{n} ({v} dBm)</option>)}
          </select>
          {cambiando && <Loader2 size={13} className="spin" />}
          {fija && <em className="r6-fija">fija para grabar</em>}
        </label>
        <button className={'axt-btn small' + (leyendo ? ' on' : '')} onClick={() => lectorR6.alternar()} title="Leer sin usar el gatillo">
          {leyendo ? <><Square size={12} /> Parar</> : <><ScanLine size={13} /> Leer</>}
        </button>
      </div>
      {aviso && <div className="r6-error" role="alert"><AlertTriangle size={13} style={{ flex: 'none', marginTop: 1 }} /> {aviso}</div>}
      {r6.bateria != null && r6.bateria <= 20 && <div className="r6-error"><BatteryLow size={13} style={{ flex: 'none', marginTop: 1 }} /> Batería baja: cargá el escáner pronto.</div>}
    </div>
  );
}

// Elegir la pieza a la que pertenece un tag leído que no estaba asociado
export function AsociarPieza({ epc, toast, onClose, onListo }) {
  useEscape(onClose);
  const [q, setQ] = useState('');
  const [res, setRes] = useState([]);
  const [busy, setBusy] = useState(null);
  const [conflicto, setConflicto] = useState(null); // { pieza, otro }
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setRes([]); return; }
    let live = true;
    const t = setTimeout(() => api('/api/precintos/piezas?q=' + encodeURIComponent(s)).then((r) => live && setRes(r)).catch(() => live && setRes([])), 250);
    return () => { live = false; clearTimeout(t); };
  }, [q]);
  async function asociar(p, reasignar = false) {
    if (!p.tag_id) { toast('Esa pieza todavía no tiene tag en Olympus'); return; }
    setBusy(p.asset_id);
    try {
      await api(`/api/precintos/tags/${p.tag_id}/epc`, { method: 'POST', body: JSON.stringify({ epc, reasignar }) });
      toast(`Tag asociado a ${p.code}`);
      onListo && onListo();
      onClose();
    } catch (e) {
      if (e.status === 409 && !reasignar) setConflicto({ pieza: p, mensaje: e.message });
      else toast(e.message);
    } finally { setBusy(null); }
  }
  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <div className="phone ds-modal">
        <div className="phone-notch" />
        <div className="phone-bar"><Link2 size={13} color="var(--t-E7C15A)" /> <span>ASOCIAR TAG A UNA PIEZA</span><button onClick={onClose} className="phone-x" aria-label="Cerrar"><X size={16} /></button></div>
        <div className="phone-screen">
          <div className="pis-epc">EPC <b>{epcLindo(epc)}</b></div>
          {conflicto ? (
            <div className="ser-aviso alerta" role="alert">
              <AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} />
              <div>
                <div>{conflicto.mensaje}. ¿Es un tag recuperado que ahora va en <b>{conflicto.pieza.code}</b>?</div>
                <div className="cor-botones" style={{ marginTop: 8 }}>
                  <button className="axt-btn small primary" onClick={() => asociar(conflicto.pieza, true)} disabled={!!busy}>Sí, pasarlo a {conflicto.pieza.code}</button>
                  <button className="axt-btn small" onClick={() => setConflicto(null)}>No</button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="ds-buscar">
                <Search size={14} color="var(--t-6E6C69)" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nº de serie o descripción" aria-label="Buscar pieza" />
              </div>
              {q.trim().length < 2 && <div className="ds-sub">Escribí al menos 2 letras del Nº de serie de la pieza que tiene este tag.</div>}
              {res.map((p) => (
                <button key={p.asset_id} className="ds-row" onClick={() => asociar(p)} disabled={!!busy}>
                  <span className="ds-row-txt">
                    <span className="ds-nombre">{p.code}</span>
                    <span className="ds-lugar">{p.name} · {p.cliente}{p.ibm ? ` · IBM ${p.ibm}` : ''}{p.epc ? ' · ya tiene EPC' : ''}</span>
                  </span>
                  {busy === p.asset_id ? <Loader2 size={15} className="spin" /> : <Check size={15} color="var(--t-E7C15A)" />}
                </button>
              ))}
              {q.trim().length >= 2 && !res.length && <div className="ds-sub" style={{ padding: '12px 0' }}>No se encontró ninguna pieza.</div>}
            </>
          )}
        </div>
      </div>
    </>
  );
}

const vibrar = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* sin vibración */ } };

// Asociar el EPC de cada pieza de un informe, una tras otra, con el escáner
export function AsociarSerie({ cola: colaIni, titulo, onClose, onCambio }) {
  const [cola, setCola] = useState(() => colaIni.map((x) => ({ ...x, hecho: false })));
  const [actual, setActual] = useState(0);
  const [aviso, setAviso] = useState(null); // { tipo, texto, reasignar }
  const [busy, setBusy] = useState(false);
  const est = useRef(); est.current = { cola, actual, busy };
  const ultimoOk = useRef(0); // después de asociar, unos segundos se ignoran lecturas (el mismo tag sigue cerca)
  useEscape(onClose);
  usePotenciaMinima();

  const hechos = cola.filter((x) => x.hecho).length;
  const it = cola[actual];
  const fin = hechos === cola.length;
  const siguiente = (xs, desde) => { for (let k = 1; k <= xs.length; k++) { const j = (desde + k) % xs.length; if (!xs[j].hecho) return j; } return -1; };

  async function guardar(epc, reasignar = false) {
    const { cola: xs, actual: i } = est.current;
    const pieza = xs[i];
    setBusy(true);
    try {
      const r = await api(`/api/precintos/tags/${pieza.tag_id}/epc`, { method: 'POST', body: JSON.stringify({ epc, reasignar }) });
      vibrar(140);
      ultimoOk.current = Date.now();
      const nueva = xs.map((x, k) => (k === i ? { ...x, hecho: true, epc: r.epc } : x));
      setCola(nueva);
      const sig = siguiente(nueva, i);
      setAviso({ tipo: 'ok', texto: `✓ ${pieza.code}: tag asociado${r.antes ? ` (era de ${r.antes})` : ''}.${sig >= 0 ? ' Pasá al siguiente.' : ''}` });
      if (sig >= 0) setActual(sig);
      onCambio && onCambio();
    } catch (e) {
      vibrar([90, 60, 90]);
      if (e.status === 409 && !reasignar) setAviso({ tipo: 'alerta', texto: `${e.message}. Usá otro tag, o si es un tag recuperado, pasalo a ${pieza.code}.`, reasignar: epc });
      else setAviso({ tipo: 'error', texto: e.message });
    } finally { setBusy(false); }
  }

  function leidos(epcs) {
    if (est.current.busy || fin) return;
    if (Date.now() - ultimoOk.current < 2500) return;
    if (epcs.length > 1) {
      vibrar([90, 60, 90]);
      setAviso({ tipo: 'alerta', texto: `Se leyeron ${epcs.length} tags a la vez. Alejá las otras piezas y apuntá solo al tag de esta pieza, bien de cerca.` });
      return;
    }
    guardar(epcs[0]);
  }

  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <aside className="pr-panel ser" role="dialog" aria-label="Asociar EPC con el escáner">
        <div className="ser-top">
          <div style={{ minWidth: 0 }}>
            <div className="pr-eyebrow">Asociar EPC con el escáner</div>
            <div className="ser-titulo">{titulo}</div>
          </div>
          <button className="axt-x sm" onClick={onClose} aria-label="Cerrar"><X size={15} /></button>
        </div>
        <div className="ser-prog">
          <div className="pr-bar"><i style={{ width: (cola.length ? (hechos / cola.length) * 100 : 0) + '%' }} /></div>
          <span><b>{hechos}</b> de {cola.length} asociados</span>
        </div>

        {fin ? (
          <div className="ser-actual fin">
            <div className="ser-ok-big"><Check size={30} /></div>
            <div className="ser-serial">Listo</div>
            <div className="pr-muted" style={{ textAlign: 'center' }}>Todas las piezas tienen su EPC.</div>
            <button className="axt-btn primary" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>Cerrar</button>
          </div>
        ) : it && (
          <div className="ser-actual on">
            <div className="ser-ahora">Ahora</div>
            <div className="ser-serial">{it.code}</div>
            <div className="ser-desc">{it.name}</div>
            <div style={{ marginTop: 12 }}>
              <CapturaPistola onLeidos={leidos} espera={1800} parcial={false} potenciaFija texto="Apuntá al tag de esta pieza y apretá el gatillo"
                ayuda={busy ? 'Guardando…' : 'Solo ese tag: alejá las otras piezas'} />
            </div>
            {cola.length - hechos > 1 && (
              <div className="ser-botones">
                <button className="axt-btn" onClick={() => { const s = siguiente(cola, actual); if (s >= 0) { setActual(s); setAviso(null); } }}><SkipForward size={14} /> Saltear</button>
              </div>
            )}
          </div>
        )}

        {aviso && (
          <div className={'ser-aviso ' + aviso.tipo} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
            {aviso.tipo !== 'ok' && <AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} />}
            <div style={{ minWidth: 0 }}>
              <div>{aviso.texto}</div>
              {aviso.reasignar && (
                <button className="axt-btn small" style={{ marginTop: 8 }} onClick={() => guardar(aviso.reasignar, true)} disabled={busy}>Es un tag recuperado: pasarlo a {it ? it.code : 'esta pieza'}</button>
              )}
            </div>
          </div>
        )}

        <ol className="ser-lista">
          {cola.map((x, k) => (
            <li key={x.tag_id} className={'ser-item ' + (x.hecho ? 'grabado' : 'pendiente') + (k === actual && !x.hecho ? ' actual' : '')}>
              <button type="button" className="ser-item-btn" disabled={x.hecho} onClick={() => { setActual(k); setAviso(null); }}>
                <span className="ser-marca">{x.hecho ? <Check size={14} /> : k + 1}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="ser-item-serial">{x.code}</span>
                  <span className="ser-item-desc">{x.hecho ? epcLindo(x.epc) : x.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </aside>
    </>
  );
}
