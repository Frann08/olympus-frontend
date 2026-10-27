import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Radio, Loader2, SkipForward, RotateCcw, AlertTriangle, Pause, Play } from 'lucide-react';
import { api, PUBLIC_URL } from './api.js';
import { lectorR6, hayBluetooth, elegirTag, juntarLecturas } from './r6.js';
import { BarraR6, useR6, epcLindo } from './Pistola.jsx';

/* Grabado en serie (Precintos)
   Se arma la cola con las piezas pendientes del informe. La pantalla muestra la que sigue;
   al acercar un tag:
     1) se lee su número de chip (UID) y el link que ya tenga;
     2) si ese tag ya se grabó en esta serie, o es de otra pieza grabada/colocada, se frena y avisa;
     3) si está libre, se graba el link de la pieza, vibra, queda tildada y pasa a la siguiente.
   Si el escáner R6 está conectado, en el mismo paso lee el UHF del tag (que sigue apoyado en el
   teléfono) y asocia su EPC a la pieza. Si no lo puede leer solo, se resuelve con el gatillo.
   Necesita Chrome en Android (Web NFC). */

export const puedeGrabar = () => typeof window !== 'undefined' && 'NDEFReader' in window;
const tagUrl = (token) => `${PUBLIC_URL}/?tag=${token}`;
const normUid = (s) => {
  const hex = String(s || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  return hex.length >= 8 && hex.length % 2 === 0 ? hex.match(/../g).join(':') : null;
};
// el token de Olympus que tenga grabado el tag (si tiene)
function tokenDe(message) {
  for (const rec of (message && message.records) || []) {
    try {
      const txt = new TextDecoder().decode(rec.data);
      const m = txt && txt.match(/[?&]tag=([A-Za-z0-9]+)/);
      if (m) return m[1];
    } catch { /* registro que no es texto */ }
  }
  return null;
}
const vibrar = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch { /* sin vibración */ } };
const NOMBRE_EST = { grabado: 'grabado', colocado: 'colocado' };
const POTENCIA_GRABAR = 15; // dBm: alcanza para el tag apoyado en el teléfono y no para los de alrededor
const RAFAGA_MS = 1200;

function mensajeError(e, al) {
  const n = e && e.name;
  if (n === 'NotAllowedError') return al === 'leer'
    ? 'Olympus no tiene permiso para usar el NFC. Cuando Chrome pregunte, tocá Permitir (o habilitalo en los permisos del sitio).'
    : 'No se pudo grabar: el tag puede estar bloqueado contra escritura.';
  if (n === 'NotSupportedError') return 'Este teléfono no tiene NFC o está apagado. Prendé el NFC en Ajustes y volvé a tocar Empezar.';
  if (n === 'NotReadableError') return 'El NFC está ocupado. Cerrá NFC Tools u otra app que lo use y volvé a tocar Empezar.';
  if (al === 'leer') return 'No se pudo prender la lectura de tags: ' + ((e && e.message) || 'error desconocido');
  return 'No se pudo grabar. Dejá el teléfono quieto sobre el tag y volvé a acercarlo. Si sigue fallando, probá con otro tag.';
}

export default function GrabarSerie({ cola: colaIni, todos, titulo, guardar, onClose }) {
  // estado local de cada pieza: pendiente | grabado | sin_guardar (grabado en el tag, falta guardarlo en Olympus)
  const [cola, setCola] = useState(() => colaIni.map((it) => ({ ...it, local: 'pendiente', uid: null, uhf: null })));
  const [actual, setActual] = useState(0);
  const [fase, setFase] = useState('listo'); // listo | esperando | revisando | grabando | fin
  const [aviso, setAviso] = useState(() => (puedeGrabar() ? null : {
    tipo: 'error',
    texto: 'Este teléfono o navegador no puede grabar desde Olympus. Usá Chrome en un Android con NFC prendido. Si no, grabá uno por uno con NFC Tools.',
  })); // { tipo: ok | error | alerta, texto, reusar }
  const [colocar, setColocar] = useState(false);

  const lector = useRef(null); // { ndef, ctrl }
  const ocupado = useRef(false);
  const usados = useRef(new Map()); // uid → Nº de serie grabado en esta serie
  const ultimoOk = useRef({ uid: null, t: 0 });
  const permitir = useRef(null); // uid o token que el usuario aceptó reusar
  const wake = useRef(null);
  const est = useRef();
  est.current = { cola, actual, colocar };
  const r6 = useR6();
  const conR6 = r6.estado === 'lista' || r6.estado === 'leyendo';
  const faltaUhf = useRef(null); // { k, code, reusado }: pieza grabada a la que le falta asociar el UHF
  const potenciaAntes = useRef(null);
  const gatillo = useRef([]);

  const hechos = cola.filter((x) => x.local !== 'pendiente').length;
  const nColocados = cola.filter((x) => x.local !== 'pendiente' && x.colocado).length;
  const it = cola[actual];
  const quedan = cola.length - hechos;

  // Apagar todo al cerrar (y devolverle al escáner la potencia que tenía)
  useEffect(() => () => {
    parar();
    if (potenciaAntes.current != null && lectorR6.conectada && lectorR6.ver().potencia === POTENCIA_GRABAR) lectorR6.ponerPotencia(potenciaAntes.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Lo que se lee con el gatillo va para la pieza que quedó sin UHF
  useEffect(() => lectorR6.registrar({
    corteMs: 1500, // un gatillazo lee un momento y para solo
    inicio: () => { gatillo.current = []; },
    tag: (epc, rssi) => { gatillo.current.push({ epc, rssi }); },
    fin: () => { trasGatillo(juntarLecturas(gatillo.current)); },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  function parar() {
    if (lector.current) { try { lector.current.ctrl.abort(); } catch { /* ya estaba parado */ } }
    lector.current = null;
    if (wake.current) { wake.current.release().catch(() => {}); wake.current = null; }
  }
  function cerrar() { parar(); onClose(); }

  async function empezar() {
    if (!puedeGrabar()) {
      setAviso({ tipo: 'error', texto: 'Este teléfono o navegador no puede grabar desde Olympus. Usá Chrome en un Android con NFC.' });
      return;
    }
    const ctrl = new AbortController();
    try {
      const ndef = new window.NDEFReader();
      await ndef.scan({ signal: ctrl.signal });
      ndef.onreading = (ev) => { manejar(ev); };
      ndef.onreadingerror = () => { if (!ocupado.current) setAviso({ tipo: 'error', texto: 'No se pudo leer el tag. Dejá el teléfono quieto sobre el tag unos segundos.' }); };
      lector.current = { ndef, ctrl };
      setFase('esperando');
      setAviso(null);
      try { if (navigator.wakeLock) wake.current = await navigator.wakeLock.request('screen'); } catch { /* la pantalla se puede apagar sola */ }
    } catch (e) {
      ctrl.abort();
      setAviso({ tipo: 'error', texto: mensajeError(e, 'leer') });
    }
  }
  function pausar() { parar(); setFase('listo'); }

  const siguientePendiente = (xs, desde) => {
    for (let k = 1; k <= xs.length; k++) {
      const j = (desde + k) % xs.length;
      if (xs[j].local === 'pendiente') return j;
    }
    return -1;
  };

  // ¿Ese tag ya es de otra pieza grabada o colocada? Devuelve { code, estado } o null.
  async function duenioDe(uid, token, pieza) {
    if (token && token === pieza.token) return null; // ya tiene el link de esta misma pieza
    const local = token && (todos || []).find((x) => x.token === token && x.tag_id !== pieza.tag_id);
    if (local && local.estado !== 'pendiente') return { code: local.code, estado: local.estado };
    const qs = new URLSearchParams();
    if (uid) qs.set('uid', uid);
    if (token) qs.set('token', token);
    if (![...qs.keys()].length) return null;
    const r = await api('/api/precintos/tags/chequear?' + qs.toString());
    const otro = (r.tags || []).find((t) => String(t.tag_id) !== String(pieza.tag_id) && t.active && t.estado !== 'pendiente');
    return otro ? { code: otro.code, estado: otro.estado, cliente: otro.cliente } : null;
  }

  // Lee el UHF del tag apoyado con el escáner. Devuelve { epc } o { epc: null, motivo, n }; null sin escáner.
  async function leerUhf() {
    if (!lectorR6.conectada) return null;
    const pot = lectorR6.ver().potencia;
    if (pot != null && pot > POTENCIA_GRABAR && potenciaAntes.current == null) {
      if (await lectorR6.ponerPotencia(POTENCIA_GRABAR)) potenciaAntes.current = pot;
    }
    const juntas = await lectorR6.rafaga(RAFAGA_MS).catch(() => null);
    return juntas ? elegirTag(juntas) : null;
  }

  async function asociarUhf(k, epc, reasignar = false) {
    const x = est.current.cola[k];
    try {
      const r = await api(`/api/precintos/tags/${x.tag_id}/epc`, { method: 'POST', body: JSON.stringify({ epc, reasignar }) });
      // si el UHF era de otra pieza de esta misma serie, esa queda sin UHF
      setCola((xs) => xs.map((y, j) => (j === k ? { ...y, uhf: 'ok', epc: r.epc } : r.antes && y.code === r.antes ? { ...y, uhf: 'falta', epc: null } : y)));
      return { ok: true, antes: r.antes };
    } catch (e) {
      setCola((xs) => xs.map((y, j) => (j === k ? { ...y, uhf: 'falta' } : y)));
      if (e.status === 409 && !reasignar) return { ok: false, conflicto: e.message.charAt(0).toUpperCase() + e.message.slice(1) };
      return { ok: false, error: e.message };
    }
  }

  const problemaUhf = (u, code) => (u.motivo === 'varios'
    ? `El escáner leyó ${u.n} tags a la vez y no se sabe cuál es el de ${code}.`
    : 'El escáner no leyó el UHF de este tag.');

  // Después de un gatillazo: asociar lo leído a la pieza que quedó sin UHF
  async function trasGatillo(juntas) {
    const f = faltaUhf.current;
    if (!f) {
      if (juntas.length) setAviso({ tipo: 'alerta', texto: 'Ninguna pieza está esperando el UHF. Para grabar, acercá el tag al teléfono: el UHF se lee solo.' });
      return;
    }
    const u = elegirTag(juntas);
    if (!u.epc) {
      vibrar([90, 60, 90]);
      setAviso({ tipo: 'alerta', despues: true, texto: u.motivo === 'varios'
        ? `Se leyeron ${u.n} tags a la vez. Apuntá solo al tag de ${f.code}, más de cerca, y apretá el gatillo de nuevo.`
        : `No se leyó ningún tag. Acercá el escáner al tag de ${f.code} y apretá el gatillo de nuevo.` });
      return;
    }
    const a = await asociarUhf(f.k, u.epc, f.reusado);
    if (a.ok) {
      faltaUhf.current = null;
      vibrar(140);
      setAviso({ tipo: 'ok', texto: `✓ ${f.code}: UHF asociado${a.antes ? ` (era de ${a.antes})` : ''}.` });
    } else if (a.conflicto) {
      vibrar([90, 60, 90]);
      setAviso({ tipo: 'alerta', despues: true, texto: `${a.conflicto}. Si es un tag recuperado, pasalo a ${f.code}.`, pasarUhf: { k: f.k, epc: u.epc, code: f.code } });
    } else setAviso({ tipo: 'error', despues: true, texto: 'No se pudo asociar el UHF: ' + a.error });
  }

  async function pasarUhf({ k, epc, code }) {
    const a = await asociarUhf(k, epc, true);
    if (a.ok) { faltaUhf.current = null; setAviso({ tipo: 'ok', texto: `✓ ${code}: UHF asociado${a.antes ? ` (era de ${a.antes})` : ''}.` }); }
    else setAviso({ tipo: 'error', despues: true, texto: 'No se pudo asociar el UHF: ' + (a.error || a.conflicto) });
  }

  async function manejar(ev) {
    if (ocupado.current) return;
    const { cola: xs, actual: i, colocar: col } = est.current;
    const pieza = xs[i];
    if (!pieza || pieza.local !== 'pendiente') return;
    const uid = normUid(ev.serialNumber);
    const token = tokenDe(ev.message);
    // el tag que se acaba de grabar sigue apoyado: no es un error
    if (uid && ultimoOk.current.uid === uid && Date.now() - ultimoOk.current.t < 4000) return;

    const yaEnSerie = (uid && usados.current.get(uid)) || (token && (xs.find((x) => x.local !== 'pendiente' && x.token === token) || {}).code);
    if (yaEnSerie) {
      vibrar([90, 60, 90]);
      setAviso({ tipo: 'alerta', texto: `Este tag ya lo grabaste para ${yaEnSerie}. Sacalo y acercá un tag nuevo.` });
      return;
    }

    ocupado.current = true;
    try {
      const clave = uid || token;
      if (!clave || permitir.current !== clave) {
        setFase('revisando');
        let otro;
        try { otro = await duenioDe(uid, token, pieza); }
        catch { setAviso({ tipo: 'error', texto: 'Sin conexión: no se pudo revisar el tag. Revisá la señal y volvé a acercarlo.' }); return; }
        if (otro) {
          vibrar([90, 60, 90]);
          setAviso({
            tipo: 'alerta',
            texto: `Este tag es de ${otro.code} (${NOMBRE_EST[otro.estado] || otro.estado}). Usá otro tag.`,
            reusar: clave ? { clave, code: otro.code } : null,
          });
          return;
        }
      }

      setFase('grabando');
      try {
        await lector.current.ndef.write({ records: [{ recordType: 'url', data: tagUrl(pieza.token) }] });
      } catch (e) {
        vibrar([90, 60, 90]);
        setAviso({ tipo: 'error', texto: mensajeError(e, 'grabar') });
        return;
      }
      ultimoOk.current = { uid, t: Date.now() };
      if (uid) usados.current.set(uid, pieza.code);
      const reusado = permitir.current != null;
      permitir.current = null;
      faltaUhf.current = null; // si quedaba otra sin UHF, sigue en la lista para después

      // con el escáner: el UHF del mismo tag, mientras sigue apoyado
      let u = null;
      if (lectorR6.conectada) {
        setFase('uhf');
        u = await leerUhf();
      }
      vibrar(140);

      let guardado = true;
      let liberadas = [];
      try { const r = await guardar(pieza, col ? 'colocado' : 'grabado', uid, token); liberadas = (r && r.liberadas) || []; } catch { guardado = false; }
      const nueva = xs.map((x, k) => (k === i ? { ...x, local: guardado ? 'grabado' : 'sin_guardar', uid, antes: token, colocado: col, uhf: u ? 'leyendo' : null } : x));
      setCola(nueva);
      const sig = siguientePendiente(nueva, i);
      const libre = liberadas.length ? ` ${liberadas.join(', ')} quedó sin tag (volvió a pendiente).` : '';
      const seguir = sig >= 0 ? ' Sacá el tag y acercá el siguiente.' : '';
      const hecho = `✓ ${pieza.code} grabado${col ? ' y colocado' : ''}`;

      let avisoUhf = null; // si el UHF no se pudo asociar solo
      let conUhf = '';
      if (u && u.epc) {
        const a = await asociarUhf(i, u.epc, reusado);
        if (a.ok) conUhf = ` con UHF${a.antes ? ` (era de ${a.antes})` : ''}`;
        else if (a.conflicto) {
          faltaUhf.current = { k: i, code: pieza.code, reusado };
          avisoUhf = { texto: `${a.conflicto}. Si es un tag recuperado, pasalo a ${pieza.code}.`, pasarUhf: { k: i, epc: u.epc, code: pieza.code } };
        } else {
          faltaUhf.current = { k: i, code: pieza.code, reusado };
          avisoUhf = { texto: `No se pudo asociar el UHF (${a.error}). Apuntá el escáner al tag de ${pieza.code} y apretá el gatillo.` };
        }
      } else if (u) {
        setCola((xs2) => xs2.map((x, k) => (k === i ? { ...x, uhf: 'falta' } : x)));
        faltaUhf.current = { k: i, code: pieza.code, reusado };
        avisoUhf = { texto: `${problemaUhf(u, pieza.code)} Apuntá el escáner al tag de ${pieza.code} y apretá el gatillo.` };
      }

      if (!guardado) setAviso({ tipo: 'error', texto: `${pieza.code}: el tag quedó grabado pero no se pudo guardar en Olympus (sin conexión). Tocá "Reintentar" en la lista.` });
      else if (avisoUhf) { vibrar([90, 60, 90]); setAviso({ tipo: 'alerta', despues: true, texto: `${hecho} (NFC). ${avisoUhf.texto}${libre}`, pasarUhf: avisoUhf.pasarUhf }); }
      else setAviso({ tipo: 'ok', texto: `${hecho}${conUhf}.${libre}${seguir}` });
      if (sig >= 0) setActual(sig);
      else { parar(); setFase('fin'); }
    } finally {
      ocupado.current = false;
      setFase((f) => (f === 'revisando' || f === 'grabando' || f === 'uhf' ? 'esperando' : f));
    }
  }

  async function reintentar(k) {
    const x = cola[k];
    try {
      await guardar(x, x.colocado ? 'colocado' : 'grabado', x.uid, x.antes);
      setCola((xs) => xs.map((y, j) => (j === k ? { ...y, local: 'grabado' } : y)));
      setAviso({ tipo: 'ok', texto: `✓ ${x.code} guardado.` });
    } catch (e) { setAviso({ tipo: 'error', texto: 'Todavía no se pudo guardar: ' + e.message }); }
  }

  function saltear() {
    const sig = siguientePendiente(cola, actual);
    if (sig >= 0 && sig !== actual) { setActual(sig); setAviso(null); permitir.current = null; }
  }

  const escuchando = fase === 'esperando' || fase === 'revisando' || fase === 'grabando' || fase === 'uhf';
  const conUhf = cola.filter((x) => x.uhf === 'ok').length;
  const sinUhf = cola.filter((x) => x.local !== 'pendiente' && x.uhf === 'falta').length;

  return (
    <>
      <div className="axt-overlay" onClick={cerrar} />
      <aside className="pr-panel ser" role="dialog" aria-label="Grabar en serie">
        <div className="ser-top">
          <div style={{ minWidth: 0 }}>
            <div className="pr-eyebrow">Grabar en serie</div>
            <div className="ser-titulo">{titulo}</div>
          </div>
          <button className="axt-x sm" onClick={cerrar} aria-label="Cerrar"><X size={15} /></button>
        </div>

        <div className="ser-prog">
          <div className="pr-bar"><i style={{ width: (cola.length ? (hechos / cola.length) * 100 : 0) + '%' }} /></div>
          <span><b>{hechos}</b> de {cola.length} grabados</span>
        </div>

        {fase === 'fin' ? (
          <div className="ser-actual fin">
            <div className="ser-ok-big"><Check size={30} /></div>
            <div className="ser-serial">Listo</div>
            <div className="pr-muted" style={{ textAlign: 'center' }}>
              {hechos} de {cola.length} tags grabados{nColocados ? ` (${nColocados === hechos ? 'todos' : nColocados} marcados como colocados)` : ''}.
              {conUhf > 0 && <> {conUhf === hechos ? 'Todos' : conUhf} con el UHF asociado.</>}
            </div>
            {sinUhf > 0 && (
              <div className="pr-muted" style={{ textAlign: 'center', marginTop: 6 }}>
                {sinUhf === 1 ? 'A 1 pieza le falta' : `A ${sinUhf} piezas les falta`} el UHF: {sinUhf === 1 ? 'asocialo' : 'asocialos'} con <b>Asociar EPC con escáner</b>.
              </div>
            )}
            <button className="axt-btn primary" style={{ width: '100%', marginTop: 14 }} onClick={cerrar}>Cerrar</button>
          </div>
        ) : it ? (
          <div className={'ser-actual' + (escuchando ? ' on' : '')}>
            <div className="ser-ahora">Ahora</div>
            <div className="ser-serial">{it.code}</div>
            <div className="ser-desc">{it.name}</div>
            <div className="ser-estado" aria-live="polite">
              {fase === 'listo' && <span>Tocá <b>Empezar</b> y acercá un tag al teléfono.</span>}
              {fase === 'esperando' && <><span className="ser-onda"><Radio size={18} /></span><span>Acercá un tag nuevo a la espalda del teléfono{conR6 ? '. El escáner lee el UHF en el mismo paso.' : ''}</span></>}
              {fase === 'revisando' && <><Loader2 size={16} className="spin" /><span>Revisando el tag…</span></>}
              {fase === 'grabando' && <><Loader2 size={16} className="spin" /><span>Grabando… no muevas el teléfono</span></>}
              {fase === 'uhf' && <><Loader2 size={16} className="spin" /><span>Leyendo el UHF con el escáner… dejá el tag apoyado</span></>}
            </div>
            <div className="ser-botones">
              {escuchando
                ? <button className="axt-btn" onClick={pausar}><Pause size={14} /> Pausar</button>
                : <button className="axt-btn primary" onClick={empezar}><Play size={14} /> Empezar</button>}
              {quedan > 1 && <button className="axt-btn" onClick={saltear}><SkipForward size={14} /> Saltear</button>}
            </div>
          </div>
        ) : null}

        {aviso && (
          <div className={'ser-aviso ' + aviso.tipo} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
            {aviso.tipo !== 'ok' && <AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} />}
            <div style={{ minWidth: 0 }}>
              <div>{aviso.texto}</div>
              {(aviso.pasarUhf || aviso.despues) && (
                <div className="cor-botones" style={{ marginTop: 8 }}>
                  {aviso.pasarUhf && <button className="axt-btn small" onClick={() => pasarUhf(aviso.pasarUhf)}>Es un tag recuperado: pasarlo a {aviso.pasarUhf.code}</button>}
                  {aviso.despues && faltaUhf.current && (
                    <button className="axt-btn small" onClick={() => { faltaUhf.current = null; setAviso({ tipo: 'ok', texto: 'Listo: ese UHF queda para después (Asociar EPC con escáner). Seguí con el siguiente tag.' }); }}>Después</button>
                  )}
                </div>
              )}
              {aviso.reusar && (
                <button className="axt-btn small" style={{ marginTop: 8 }}
                  onClick={() => { permitir.current = aviso.reusar.clave; setAviso({ tipo: 'ok', texto: `Listo: acercalo de nuevo y se graba para ${it ? it.code : 'esta pieza'}. ${aviso.reusar.code} va a quedar sin tag (vuelve a pendiente).` }); }}>
                  Es un tag recuperado: reusarlo
                </button>
              )}
            </div>
          </div>
        )}

        {hayBluetooth() && (fase !== 'fin' || faltaUhf.current) && (
          <div className="ser-pistola">
            <div className="ser-pistola-tit">Escáner RFID <em>(opcional: asocia el UHF al grabar)</em></div>
            <BarraR6 />
          </div>
        )}

        {fase !== 'fin' && (
          <label className="ser-colocar">
            <input type="checkbox" checked={colocar} onChange={(e) => setColocar(e.target.checked)} />
            <span>Los tags ya están puestos en las piezas <em>(se marcan como colocados)</em></span>
          </label>
        )}

        <ol className="ser-lista">
          {cola.map((x, k) => (
            <li key={x.tag_id} className={'ser-item ' + x.local + (k === actual && fase !== 'fin' && x.local === 'pendiente' ? ' actual' : '')}>
              <button type="button" className="ser-item-btn" disabled={x.local !== 'pendiente' || fase === 'fin'}
                onClick={() => { setActual(k); setAviso(null); permitir.current = null; }}
                aria-label={x.local === 'pendiente' ? `Grabar ahora ${x.code}` : `${x.code}: ${x.local === 'grabado' ? 'grabado' : 'falta guardar'}`}>
                <span className="ser-marca">
                  {x.local === 'grabado' ? <Check size={14} /> : x.local === 'sin_guardar' ? '!' : k + 1}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="ser-item-serial">{x.code}{x.uhf === 'ok' && <span className="ser-uhf ok">UHF ✓</span>}{x.uhf === 'falta' && x.local !== 'pendiente' && <span className="ser-uhf falta">sin UHF</span>}</span>
                  <span className="ser-item-desc">{x.uhf === 'ok' && x.epc ? epcLindo(x.epc) : x.name}</span>
                </span>
              </button>
              {x.local === 'sin_guardar' && (
                <button className="axt-btn small" onClick={() => reintentar(k)}><RotateCcw size={12} /> Reintentar</button>
              )}
            </li>
          ))}
        </ol>
      </aside>
    </>
  );
}
