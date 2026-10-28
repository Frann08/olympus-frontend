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
   Con el escáner R6 conectado, en el mismo paso lee el UHF del tag y asocia su EPC a la pieza.
   Una pieza pasa a la siguiente solo con el NFC y el UHF hechos: si el UHF no se lee solo, la
   pantalla se queda en esa pieza hasta resolverlo (reintentar, gatillo) o hasta que el usuario
   elija seguir sin UHF. Grabar solo NFC (sin escáner) hay que elegirlo a propósito.
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
const POTENCIAS_UHF = [POTENCIA_GRABAR, 22, 30]; // si no lee nada, se sube de a poco
const RAFAGA_MS = 1200;

// Los Xerafy DataBand2 llevan en el EPC parte del número de chip del NFC (al revés):
// UID C1:68:5B:12:01:78:16:E0 → EPC …7801125B68C1…. Con eso se sabe cuál de los tags leídos es
// el que se acaba de grabar, aunque el escáner lea varios.
export function epcDelUid(lecturas, uid) {
  const b = String(uid || '').toUpperCase().split(':').filter(Boolean);
  if (b.length < 6) return null;
  const al = b.slice().reverse().join(''), de = b.join('');
  const claves = [al.slice(-12), de.slice(0, 12)];
  const hit = (lecturas || []).filter((x) => claves.some((c) => String(x.epc).toUpperCase().includes(c)));
  return hit.length === 1 ? hit[0].epc : null;
}
const elegirPara = (juntas, uid) => {
  const porUid = epcDelUid(juntas, uid);
  return porUid ? { epc: porUid, n: juntas.length, porUid: true } : elegirTag(juntas);
};

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
  const [soloNfc, setSoloNfc] = useState(false); // eligió grabar sin escáner (el UHF queda para después)

  const lector = useRef(null); // { ndef, ctrl }
  const ocupado = useRef(false);
  const usados = useRef(new Map()); // uid → Nº de serie grabado en esta serie
  const ultimoOk = useRef({ uid: null, t: 0 });
  const permitir = useRef(null); // uid o token que el usuario aceptó reusar
  const wake = useRef(null);
  const est = useRef();
  est.current = { cola, actual, colocar, soloNfc };
  const r6 = useR6();
  const conR6 = r6.estado === 'lista' || r6.estado === 'leyendo';
  const faltaUhf = useRef(null); // { k, code, reusado, uid }: la pieza actual, grabada, esperando su UHF
  const potenciaAntes = useRef(null);
  const gatillo = useRef([]);

  const hechos = cola.filter((x) => x.local !== 'pendiente').length;
  const nColocados = cola.filter((x) => x.local !== 'pendiente' && x.colocado).length;
  const it = cola[actual];
  const quedan = cola.length - hechos;

  // Apagar todo al cerrar (y devolverle al escáner la potencia que tenía)
  useEffect(() => () => {
    parar();
    if (potenciaAntes.current != null && lectorR6.conectada && POTENCIAS_UHF.includes(lectorR6.ver().potencia)) lectorR6.ponerPotencia(potenciaAntes.current);
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

  async function empezar(sinEscaner = soloNfc) {
    if (!puedeGrabar()) {
      setAviso({ tipo: 'error', texto: 'Este teléfono o navegador no puede grabar desde Olympus. Usá Chrome en un Android con NFC.' });
      return;
    }
    // cada pieza se graba en NFC y UHF: sin el escáner conectado, hay que elegir a propósito seguir solo con NFC
    if (!lectorR6.conectada && !sinEscaner) {
      setAviso({ tipo: 'alerta', sinEscaner: true, texto: hayBluetooth()
        ? 'El escáner RFID no está conectado. Conectalo abajo (Escáner RFID) para grabar cada pieza en NFC y UHF en el mismo paso.'
        : 'Este teléfono no puede conectarse al escáner RFID (hace falta Chrome en Android con Bluetooth). Solo se puede grabar el NFC.' });
      return;
    }
    if (sinEscaner && !soloNfc) setSoloNfc(true);
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

  // pasar a la pieza pendiente que sigue (o terminar)
  function avanzar(desde) {
    faltaUhf.current = null;
    const xs = est.current.cola;
    const sig = siguientePendiente(xs, desde);
    if (sig >= 0) setActual(sig);
    else { parar(); setFase('fin'); }
    return sig;
  }

  // Lee el UHF del tag recién grabado. Empieza con poca potencia (solo el tag apoyado) y, si no
  // lee nada, la sube de a poco. Si entre lo leído está el EPC que corresponde al NFC grabado,
  // ese es. Devuelve { epc } o { epc: null, motivo, n }; null sin escáner.
  async function leerUhf(uid) {
    if (!lectorR6.conectada) return null;
    const pot = lectorR6.ver().potencia;
    if (potenciaAntes.current == null && pot != null && !POTENCIAS_UHF.includes(pot)) potenciaAntes.current = pot;
    let res = { epc: null, motivo: 'ninguno', n: 0 };
    for (const p of POTENCIAS_UHF) {
      if (!lectorR6.conectada) break;
      if (lectorR6.ver().potencia !== p) await lectorR6.ponerPotencia(p);
      const juntas = await lectorR6.rafaga(RAFAGA_MS).catch(() => null);
      if (!juntas) continue;
      res = elegirPara(juntas, uid);
      if (res.epc || res.motivo === 'varios') break; // con más potencia leería todavía más tags
    }
    if (lectorR6.conectada && lectorR6.ver().potencia !== POTENCIA_GRABAR) await lectorR6.ponerPotencia(POTENCIA_GRABAR);
    return res;
  }

  // Volver a leer el UHF de la pieza que lo está esperando (el tag tiene que estar cerca del escáner)
  async function reintentarUhf() {
    const f = faltaUhf.current;
    if (!f || ocupado.current) return;
    if (!lectorR6.conectada) { setAviso({ ...avisoFalta(f, 'El escáner no está conectado. Conectalo abajo y tocá Reintentar UHF.') }); return; }
    ocupado.current = true;
    setFase('uhf');
    try {
      const u = await leerUhf(f.uid);
      if (u && u.epc) await cerrarUhf(f, u.epc);
      else { vibrar([90, 60, 90]); setAviso(avisoFalta(f, `${problemaUhf(u || {}, f.code)} Acercá el escáner al tag y tocá Reintentar UHF, o apretá el gatillo apuntándole.`)); }
    } finally {
      ocupado.current = false;
      setFase((x) => (x === 'uhf' ? (lector.current ? 'esperando' : 'listo') : x));
    }
  }

  // Asociar el EPC a la pieza que esperaba su UHF y, si salió bien, seguir con la próxima
  async function cerrarUhf(f, epc) {
    const a = await asociarUhf(f.k, epc, f.reusado);
    if (a.ok) {
      vibrar(140);
      const sig = avanzar(f.k);
      setAviso({ tipo: 'ok', texto: `✓ ${f.code}: UHF asociado${a.antes ? ` (era de ${a.antes})` : ''}.${sig >= 0 ? ' Acercá el próximo tag.' : ''}` });
    } else if (a.conflicto) {
      vibrar([90, 60, 90]);
      setAviso({ ...avisoFalta(f, `${a.conflicto}. Si es un tag recuperado, pasalo a ${f.code}.`), pasarUhf: { k: f.k, epc, code: f.code } });
    } else setAviso(avisoFalta(f, 'No se pudo asociar el UHF: ' + a.error));
    return a.ok;
  }

  // aviso de "a esta pieza le falta el UHF", con los botones para resolverlo
  const avisoFalta = (f, texto) => ({ tipo: 'alerta', falta: true, texto });

  function seguirSinUhf() {
    const f = faltaUhf.current;
    if (!f) return;
    if (!window.confirm(`¿Seguir sin el UHF de ${f.code}?\nEl NFC ya quedó grabado. La pieza va a figurar "Sin UHF" en la lista y se lo podés asociar después desde ahí.`)) return;
    const sig = avanzar(f.k);
    setAviso({ tipo: 'alerta', texto: `${f.code} quedó sin UHF.${sig >= 0 ? ' Seguí con el próximo tag.' : ''}` });
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
    const u = elegirPara(juntas, f.uid);
    if (!u.epc) {
      vibrar([90, 60, 90]);
      setAviso(avisoFalta(f, u.motivo === 'varios'
        ? `Se leyeron ${u.n} tags a la vez. Apuntá solo al tag de ${f.code}, más de cerca, y apretá el gatillo de nuevo.`
        : `No se leyó ningún tag. Acercá el escáner al tag de ${f.code} y apretá el gatillo de nuevo.`));
      return;
    }
    await cerrarUhf(f, u.epc);
  }

  async function pasarUhf({ k, epc, code }) {
    const f = faltaUhf.current && faltaUhf.current.k === k ? faltaUhf.current : { k, code, reusado: true };
    const a = await asociarUhf(k, epc, true);
    if (a.ok) { vibrar(140); const sig = avanzar(k); setAviso({ tipo: 'ok', texto: `✓ ${code}: UHF asociado${a.antes ? ` (era de ${a.antes})` : ''}.${sig >= 0 ? ' Acercá el próximo tag.' : ''}` }); }
    else setAviso(avisoFalta(f, 'No se pudo asociar el UHF: ' + (a.error || a.conflicto)));
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
      faltaUhf.current = null;

      // con el escáner: el UHF del mismo tag, mientras sigue apoyado
      let u = null;
      const sinEscaner = est.current.soloNfc;
      if (lectorR6.conectada) {
        setFase('uhf');
        u = await leerUhf(uid);
      } else if (!sinEscaner) u = { epc: null, motivo: 'desconectado' };
      vibrar(140);

      let guardado = true;
      let liberadas = [];
      try { const r = await guardar(pieza, col ? 'colocado' : 'grabado', uid, token); liberadas = (r && r.liberadas) || []; } catch { guardado = false; }
      const nueva = xs.map((x, k) => (k === i ? { ...x, local: guardado ? 'grabado' : 'sin_guardar', uid, antes: token, colocado: col, uhf: u ? 'leyendo' : null } : x));
      setCola(nueva);
      est.current.cola = nueva;
      const libre = liberadas.length ? ` ${liberadas.join(', ')} quedó sin tag (volvió a pendiente).` : '';
      const hecho = `✓ ${pieza.code} grabado${col ? ' y colocado' : ''}`;
      const f = { k: i, code: pieza.code, reusado, uid };

      if (!guardado) {
        setAviso({ tipo: 'error', texto: `${pieza.code}: el tag quedó grabado pero no se pudo guardar en Olympus (sin conexión). Tocá "Reintentar" en la lista.` });
        avanzar(i);
        return;
      }
      if (!u) { // eligió grabar solo NFC
        setCola((xs2) => xs2.map((x, k) => (k === i ? { ...x, uhf: 'falta' } : x)));
        const sig = avanzar(i);
        setAviso({ tipo: 'ok', texto: `${hecho} (solo NFC).${libre}${sig >= 0 ? ' Sacá el tag y acercá el siguiente.' : ''}` });
        return;
      }
      if (u.epc) {
        const a = await asociarUhf(i, u.epc, reusado);
        if (a.ok) {
          const sig = avanzar(i);
          setAviso({ tipo: 'ok', texto: `${hecho} con UHF${a.antes ? ` (era de ${a.antes})` : ''}.${libre}${sig >= 0 ? ' Sacá el tag y acercá el siguiente.' : ''}` });
          return;
        }
        // el UHF no se pudo asociar: la pieza se queda esperando
        faltaUhf.current = f;
        vibrar([90, 60, 90]);
        if (a.conflicto) setAviso({ ...avisoFalta(f, `${hecho} en NFC. ${a.conflicto}. Si es un tag recuperado, pasalo a ${pieza.code}.${libre}`), pasarUhf: { k: i, epc: u.epc, code: pieza.code } });
        else setAviso(avisoFalta(f, `${hecho} en NFC. No se pudo asociar el UHF (${a.error}).${libre}`));
        return;
      }
      // no se leyó el UHF: la pieza se queda esperando hasta resolverlo
      setCola((xs2) => xs2.map((x, k) => (k === i ? { ...x, uhf: 'falta' } : x)));
      faltaUhf.current = f;
      vibrar([90, 60, 90]);
      setAviso(avisoFalta(f, u.motivo === 'desconectado'
        ? `${hecho} en NFC, pero el escáner se desconectó. Conectalo abajo y tocá Reintentar UHF.${libre}`
        : `${hecho} en NFC. ${problemaUhf(u, pieza.code)} Acercá el escáner al tag y tocá Reintentar UHF, o apretá el gatillo apuntándole.${libre}`));
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
    if (faltaUhf.current) return;
    const sig = siguientePendiente(cola, actual);
    if (sig >= 0 && sig !== actual) { setActual(sig); setAviso(null); permitir.current = null; }
  }

  const escuchando = fase === 'esperando' || fase === 'revisando' || fase === 'grabando' || fase === 'uhf';
  const esperaUhf = !!(faltaUhf.current && it && faltaUhf.current.k === actual);
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
                {sinUhf === 1 ? 'A 1 pieza le falta' : `A ${sinUhf} piezas les falta`} el UHF: en la lista del informe, tocá <b>Sin UHF</b> en {sinUhf === 1 ? 'esa pieza' : 'cada una'}.
              </div>
            )}
            <button className="axt-btn primary" style={{ width: '100%', marginTop: 14 }} onClick={cerrar}>Cerrar</button>
          </div>
        ) : it ? (
          <div className={'ser-actual' + (escuchando ? ' on' : '')}>
            <div className="ser-ahora">{esperaUhf ? 'Falta el UHF' : 'Ahora'}</div>
            <div className="ser-serial">{it.code}</div>
            <div className="ser-desc">{it.name}</div>
            <div className="ser-estado" aria-live="polite">
              {fase === 'listo' && <span>Tocá <b>Empezar</b> y acercá un tag al teléfono.</span>}
              {fase === 'esperando' && esperaUhf && <><AlertTriangle size={16} /><span>El NFC ya está grabado. Falta asociar el UHF para pasar a la siguiente.</span></>}
              {fase === 'esperando' && !esperaUhf && <><span className="ser-onda"><Radio size={18} /></span><span>Acercá un tag nuevo a la espalda del teléfono{conR6 ? '. El escáner lee el UHF en el mismo paso.' : soloNfc ? ' (solo NFC).' : ''}</span></>}
              {fase === 'revisando' && <><Loader2 size={16} className="spin" /><span>Revisando el tag…</span></>}
              {fase === 'grabando' && <><Loader2 size={16} className="spin" /><span>Grabando… no muevas el teléfono</span></>}
              {fase === 'uhf' && <><Loader2 size={16} className="spin" /><span>Leyendo el UHF con el escáner… dejá el tag apoyado</span></>}
            </div>
            <div className="ser-botones">
              {escuchando
                ? <button className="axt-btn" onClick={pausar}><Pause size={14} /> Pausar</button>
                : <button className="axt-btn primary" onClick={() => empezar()}><Play size={14} /> Empezar</button>}
              {quedan > 1 && !esperaUhf && <button className="axt-btn" onClick={saltear}><SkipForward size={14} /> Saltear</button>}
            </div>
          </div>
        ) : null}

        {aviso && (
          <div className={'ser-aviso ' + aviso.tipo} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
            {aviso.tipo !== 'ok' && <AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} />}
            <div style={{ minWidth: 0 }}>
              <div>{aviso.texto}</div>
              {(aviso.pasarUhf || (aviso.falta && faltaUhf.current)) && (
                <div className="cor-botones" style={{ marginTop: 8 }}>
                  {aviso.pasarUhf && <button className="axt-btn small" onClick={() => pasarUhf(aviso.pasarUhf)}>Es un tag recuperado: pasarlo a {aviso.pasarUhf.code}</button>}
                  {aviso.falta && faltaUhf.current && <>
                    <button className="axt-btn small primary" onClick={reintentarUhf} disabled={fase === 'uhf'}><RotateCcw size={12} /> Reintentar UHF</button>
                    <button className="axt-btn small" onClick={seguirSinUhf}>Seguir sin UHF</button>
                  </>}
                </div>
              )}
              {aviso.sinEscaner && (
                <div className="cor-botones" style={{ marginTop: 8 }}>
                  <button className="axt-btn small" onClick={() => { setAviso(null); empezar(true); }}>Grabar solo NFC (el UHF queda para después)</button>
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
            <div className="ser-pistola-tit">Escáner RFID <em>{soloNfc ? '(grabando solo NFC: conectalo para sumar el UHF)' : '(asocia el UHF en el mismo paso)'}</em></div>
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
              <button type="button" className="ser-item-btn" disabled={x.local !== 'pendiente' || fase === 'fin' || esperaUhf}
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
