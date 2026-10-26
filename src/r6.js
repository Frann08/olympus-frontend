/* Pistola Chainway R6 por Bluetooth (Web Bluetooth: Chrome en Android o en la computadora).

   La R6 no tiene modo teclado. Habla por el "UART de Nordic" (servicio 6e400001…): se escribe en
   6e400002 y las respuestas llegan como avisos en 6e400003. Cada mensaje es una trama:

     A5 5A | largo (2 bytes, trama entera) | comando | datos… | XOR (de largo a datos) | 0D 0A

   La respuesta a un comando viene con comando + 1. Todo esto sale de la librería DeviceAPI de
   Chainway (DeviceAPI_ver20251103), que es la que usa su app de prueba demo_uhf_ble. */

export const NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // acá se escribe
const TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // de acá llegan las respuestas
const INFO = 0x180a; // "Device Information": dice qué chip Bluetooth tiene
const INFO_HW = 0x2a27;

export const CMD = {
  VERSION: 0x02, // versión del módulo UHF
  POTENCIA_PONER: 0x10,
  POTENCIA_VER: 0x12,
  LEER_EMPEZAR: 0x82, // lectura continua
  LEER_PARAR: 0x8c,
  PLACA: 0xc8, // versión de la placa (para saber cómo vienen los tags)
  PEDIR_TAGS: 0xe0, // pedir lo que leyó (respuesta 0xE1)
  TAGS_AVISO: 0xe3, // algunas versiones mandan los tags solas
  BATERIA: 0xe4,
  GATILLO: 0xe6, // aviso del gatillo: datos[0] = 4 → se soltó; otro → se apretó
};
const TAG_SUELTO = 0x83; // un tag por trama (también es la respuesta a LEER_EMPEZAR)

export function trama(cmd, datos = []) {
  const n = datos.length + 8;
  const b = new Uint8Array(n);
  b[0] = 0xa5; b[1] = 0x5a; b[2] = (n >> 8) & 255; b[3] = n & 255; b[4] = cmd;
  b.set(datos, 5);
  let x = 0;
  for (let i = 2; i < n - 3; i++) x ^= b[i];
  b[n - 3] = x; b[n - 2] = 0x0d; b[n - 1] = 0x0a;
  return b;
}

export const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();

// Arma las tramas con lo que va llegando: por Bluetooth una trama puede venir partida en varios avisos
// (de a 20 bytes) o varias tramas juntas en un aviso.
export class Armador {
  constructor() { this.buf = new Uint8Array(0); }
  meter(bytes) {
    const junto = new Uint8Array(this.buf.length + bytes.length);
    junto.set(this.buf); junto.set(bytes, this.buf.length);
    const b = junto;
    const salida = [];
    let i = 0;
    while (i < b.length) {
      if (b[i] !== 0xa5) { i++; continue; }
      if (i + 1 >= b.length) break; // falta saber si sigue 5A
      if (b[i + 1] !== 0x5a) { i++; continue; }
      if (i + 4 > b.length) break; // falta el largo
      const n = (b[i + 2] << 8) | b[i + 3];
      if (n < 8 || n > 4096) { i++; continue; }
      if (i + n > b.length) break; // falta el resto de la trama
      let x = 0;
      for (let k = i + 2; k < i + n - 3; k++) x ^= b[k];
      if (b[i + n - 2] === 0x0d && b[i + n - 1] === 0x0a && b[i + n - 3] === x) {
        salida.push({ cmd: b[i + 4], datos: b.slice(i + 5, i + n - 3) });
        i += n;
      } else i++;
    }
    this.buf = b.slice(i);
    if (this.buf.length > 8192) this.buf = new Uint8Array(0); // basura: empezar de nuevo
    return salida;
  }
}

// El EPC (y la intensidad de señal) de un registro de tag. Con "PC" (lo normal): 2 bytes de PC,
// el EPC (su largo sale del PC), después TID/USER si se pidieron, 2 bytes de RSSI y, si el largo
// que queda es impar, 1 byte de antena. Las placas 2.7 a 2.13 mandan el EPC solo (sin RSSI).
function leerRegistro(rec, conPc) {
  if (conPc && rec.length >= 6) {
    const largo = (rec[0] >> 3) * 2;
    if (largo >= 4 && 2 + largo <= rec.length) {
      const resto = rec.length - 2 - largo;
      let rssi = null;
      if (resto >= 2) {
        const k = rec.length - (resto % 2 ? 3 : 2);
        const f = (65535 - ((rec[k] << 8) | rec[k + 1])) / 10;
        if (f > 0 && f < 200) rssi = -Math.round(f * 10) / 10; // dBm: más cerca de 0 = más fuerte
      }
      return { epc: hex(rec.subarray(2, 2 + largo)), rssi };
    }
  }
  return rec.length >= 4 && rec.length <= 64 ? { epc: hex(rec), rssi: null } : null;
}

// Tags de una trama. null si la trama no es de tags. lecturas: [{ epc, rssi }]
export function tagsDe(cmd, d, conPc = true) {
  const salida = (indice, lecturas) => ({ indice, lecturas, epcs: lecturas.map((x) => x.epc) });
  if (cmd === TAG_SUELTO) {
    if (d.length < 6) return salida(null, []); // respuesta a "empezar" (1 byte)
    const r = leerRegistro(d, true);
    return salida(null, r ? [r] : []);
  }
  if (cmd !== CMD.PEDIR_TAGS + 1 && cmd !== CMD.TAGS_AVISO) return null;
  const o = cmd === CMD.TAGS_AVISO ? 1 : 0;
  if (d.length < o + 2) return salida(null, []);
  const indice = (d[o] << 8) | d[o + 1];
  const lecturas = [];
  if (d.length >= 5) {
    const cant = d[o + 2];
    let p = o + 3;
    for (let k = 0; k < cant && p < d.length; k++) {
      const l = d[p];
      if (p + 1 + l > d.length) break;
      const r = leerRegistro(d.subarray(p + 1, p + 1 + l), conPc);
      if (r) lecturas.push(r);
      p += 1 + l;
    }
  }
  return salida(indice, lecturas);
}

// Junta lecturas repetidas de un mismo tag: [{ epc, rssi (la mejor), veces }], la más fuerte primero
export function juntarLecturas(lecturas) {
  const m = new Map();
  for (const { epc, rssi } of lecturas) {
    const x = m.get(epc) || { epc, rssi: null, veces: 0 };
    x.veces++;
    if (rssi != null && (x.rssi == null || rssi > x.rssi)) x.rssi = rssi;
    m.set(epc, x);
  }
  return [...m.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
}

// De lo leído, cuál es "el" tag: si hay uno solo, ese; si hay varios, el más fuerte solo si le saca
// al segundo `margen` dB o más (el que está pegado al celular contra otros que quedaron cerca).
export const MARGEN_DB = 10;
export function elegirTag(juntas, margen = MARGEN_DB) {
  if (!juntas || !juntas.length) return { epc: null, motivo: 'ninguno', n: 0 };
  if (juntas.length === 1) return { epc: juntas[0].epc, n: 1 };
  const [a, b] = juntas;
  if (a.rssi != null && b.rssi != null && a.rssi - b.rssi >= margen) return { epc: a.epc, n: juntas.length };
  return { epc: null, motivo: 'varios', n: juntas.length };
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_LECTURA_MS = 60000; // si se pierde el aviso de "soltó el gatillo", se corta solo

class LectorR6 {
  constructor() {
    this.foto = { estado: 'sin', nombre: null, bateria: null, potencia: null, error: null, recordada: null };
    this.oyentes = new Set();
    this.capturas = []; // pantallas que reciben las lecturas; la última abierta es la que manda
    this.armador = new Armador();
    this.esperas = [];
    this.cola = Promise.resolve();
    this.device = null;
    this.rx = null;
    this.n52 = true;
    this.conPc = true;
    this.indice = 1;
    this.porGatillo = false;
    this.recibiendo = false; // entre "empezar" y el fin de "parar" se aceptan tags
    this.manual = false; // la desconexión la pidió el usuario
    this._buscarRecordada();
  }

  // ---- estado para la pantalla ----
  poner(cambios) { this.foto = { ...this.foto, ...cambios }; this.oyentes.forEach((f) => f()); }
  suscribir = (f) => { this.oyentes.add(f); return () => this.oyentes.delete(f); };
  ver = () => this.foto;
  get leyendo() { return this.foto.estado === 'leyendo'; }
  get conectada() { return this.foto.estado === 'lista' || this.foto.estado === 'leyendo'; }

  // ---- pantallas que usan las lecturas ----
  registrar(captura) {
    this.capturas.push(captura);
    return () => {
      this.capturas = this.capturas.filter((c) => c !== captura);
      if (!this.capturas.length && this.leyendo) this.parar();
    };
  }
  get captura() { return this.capturas[this.capturas.length - 1] || null; }

  // ---- conexión ----
  async _buscarRecordada() {
    try {
      const id = localStorage.getItem('ot_r6');
      if (!id || typeof navigator === 'undefined' || !navigator.bluetooth || !navigator.bluetooth.getDevices) return;
      const d = (await navigator.bluetooth.getDevices()).find((x) => x.id === id);
      if (d) { this.recordada = d; this.poner({ recordada: d.name || 'la pistola' }); }
    } catch { /* sin permisos guardados */ }
  }

  async conectar({ otra = false } = {}) {
    if (this.foto.estado === 'conectando' || this.conectada) return;
    let device = !otra && this.recordada;
    try {
      if (!device) {
        this.poner({ estado: 'buscando', error: null });
        device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [NUS, INFO] });
      }
    } catch (e) {
      this.poner({ estado: 'sin', error: e && e.name === 'NotFoundError' ? null : 'No se pudo abrir la búsqueda de Bluetooth: ' + (e.message || e) });
      return;
    }
    this.manual = false;
    await this._abrir(device);
  }

  async _abrir(device) {
    this.poner({ estado: 'conectando', nombre: device.name || 'Pistola', error: null });
    if (this.device !== device) {
      if (this.device) this.device.removeEventListener('gattserverdisconnected', this._seCorto);
      this.device = device;
      device.addEventListener('gattserverdisconnected', this._seCorto);
    }
    try {
      const server = await device.gatt.connect();
      const svc = await server.getPrimaryService(NUS).catch(() => { throw new Error('Ese equipo no es una pistola Chainway (no tiene el servicio de datos). Elegí la R6 de la lista.'); });
      this.rx = await svc.getCharacteristic(RX);
      const tx = await svc.getCharacteristic(TX);
      tx.removeEventListener('characteristicvaluechanged', this._aviso);
      tx.addEventListener('characteristicvaluechanged', this._aviso);
      await tx.startNotifications();
      this.armador = new Armador();
      // qué chip Bluetooth tiene: cambia la forma de pedir los tags
      try {
        const info = await server.getPrimaryService(INFO);
        const hw = new TextDecoder().decode(await (await info.getCharacteristic(INFO_HW)).readValue()).replace(/\0/g, '').trim();
        this.n52 = !hw || hw.includes('nRF52');
      } catch { this.n52 = true; }
      // versión de la placa: las 2.7 a 2.13 mandan el EPC sin PC
      const placa = await this.pedir(CMD.PLACA, [], 1500).catch(() => null);
      this.conPc = !(placa && placa.length >= 2 && placa[0] === 2 && placa[1] >= 7 && placa[1] <= 13);
      try { localStorage.setItem('ot_r6', device.id); } catch { /* sin almacenamiento */ }
      this.recordada = device;
      this.poner({ estado: 'lista', recordada: device.name || 'la pistola' });
      await this.actualizar();
    } catch (e) {
      try { device.gatt.disconnect(); } catch { /* ya estaba cortada */ }
      this.poner({ estado: 'sin', error: e.message && e.message.startsWith('Ese equipo') ? e.message : 'No se pudo conectar con la pistola. Fijate que esté prendida y cerca, y probá de nuevo.' });
    }
  }

  // batería y potencia
  async actualizar() {
    if (!this.conectada || this.leyendo) return;
    const b = await this.pedir(CMD.BATERIA, [1], 1500).catch(() => null);
    const p = await this.pedir(CMD.POTENCIA_VER, [], 1500).catch(() => null);
    this.poner({
      bateria: b && b.length >= 2 && b[0] === 1 ? b[1] : this.foto.bateria,
      potencia: p && p.length >= 4 && p[0] === 0 ? Math.round(((p[2] << 8) | p[3]) / 100) : this.foto.potencia,
    });
  }

  async ponerPotencia(dbm) {
    if (!this.conectada) return false;
    if (this.leyendo) await this.parar();
    const v = Math.round(dbm) * 100;
    const r = await this.pedir(CMD.POTENCIA_PONER, [2, 1, (v >> 8) & 255, v & 255, (v >> 8) & 255, v & 255], 1500).catch(() => null);
    const ok = !!(r && r[0] === 1);
    if (ok) this.poner({ potencia: Math.round(dbm) });
    return ok;
  }

  desconectar() {
    this.manual = true;
    this.estadoLectura(false);
    try { this.device && this.device.gatt.disconnect(); } catch { /* ya estaba cortada */ }
    this.poner({ estado: 'sin', error: null });
  }

  _seCorto = async () => {
    if (!this.conectada) return; // se cortó mientras conectaba: eso lo maneja _abrir
    const leia = this.leyendo;
    this.estadoLectura(false);
    if (leia) { this.recibiendo = false; this.captura && this.captura.fin && this.captura.fin(); }
    if (this.manual || !this.device) { this.poner({ estado: 'sin' }); return; }
    // se cortó sola (se alejó, se apagó): probar reconectar un par de veces
    for (let k = 0; k < 3 && !this.manual; k++) {
      this.poner({ estado: 'conectando', error: 'Se cortó la conexión. Reconectando…' });
      await dormir(1200 * (k + 1));
      if (this.manual) return;
      try { await this._abrir(this.device); if (this.conectada) { this.poner({ error: null }); return; } } catch { /* sigue probando */ }
    }
    if (!this.manual) this.poner({ estado: 'sin', error: 'Se cortó la conexión con la pistola. Tocá "Conectar" de nuevo.' });
  };

  // ---- envío y respuesta ----
  enviar(bytes) {
    const rx = this.rx;
    const tarea = this.cola.then(async () => {
      if (!rx) throw new Error('Pistola desconectada');
      const sinResp = rx.properties && rx.properties.writeWithoutResponse && rx.writeValueWithoutResponse;
      for (let i = 0; i < bytes.length; i += 20) {
        const parte = bytes.slice(i, i + 20);
        if (sinResp) await rx.writeValueWithoutResponse(parte);
        else if (rx.writeValueWithResponse) await rx.writeValueWithResponse(parte);
        else await rx.writeValue(parte);
      }
    });
    this.cola = tarea.catch(() => {});
    return tarea;
  }

  esperar(cmd, ms, filtro = null) {
    let w;
    const p = new Promise((resolve, reject) => {
      w = { cmd, filtro, resolve, t: setTimeout(() => { this.esperas = this.esperas.filter((x) => x !== w); reject(new Error('sin respuesta')); }, ms) };
      this.esperas.push(w);
    });
    return p;
  }

  async pedir(cmd, datos, ms = 1500) {
    const r = this.esperar(cmd + 1, ms);
    await this.enviar(trama(cmd, datos));
    return r;
  }

  _aviso = (ev) => {
    const v = ev.target.value;
    const bytes = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    for (const f of this.armador.meter(bytes)) this._trama(f);
  };

  _trama({ cmd, datos }) {
    if (cmd === CMD.GATILLO) { this._gatillo(datos.length ? datos[0] !== 4 : true); return; }
    const t = tagsDe(cmd, datos, this.conPc);
    if (t && t.lecturas.length) this._tags(t.lecturas);
    for (const w of [...this.esperas]) {
      if (w.cmd !== cmd || (w.filtro && !w.filtro(datos, t))) continue;
      clearTimeout(w.t);
      this.esperas = this.esperas.filter((x) => x !== w);
      w.resolve(datos);
      break;
    }
  }

  _tags(lecturas) {
    if (!this.recibiendo) return; // tags viejos de otra lectura
    const c = this.captura;
    if (c && c.tag) lecturas.forEach((x) => c.tag(x.epc, x.rssi));
  }

  _gatillo(abajo) {
    if (abajo) {
      if (!this.leyendo && this.conectada && this.captura) { this.porGatillo = true; this.empezar(); }
    } else if (this.leyendo && this.porGatillo) this.parar();
  }

  // ---- lectura ----
  estadoLectura(si) {
    clearTimeout(this.corte);
    if (si) {
      this.poner({ estado: 'leyendo' });
      this.corte = setTimeout(() => this.parar(), MAX_LECTURA_MS);
    } else if (this.foto.estado === 'leyendo') this.poner({ estado: 'lista' });
  }

  async empezar({ manual = false } = {}) {
    if (!this.conectada || this.leyendo) return;
    if (manual) this.porGatillo = false;
    this.vuelta = (this.vuelta || 0) + 1;
    this.estadoLectura(true);
    this.recibiendo = true;
    this.captura && this.captura.inicio && this.captura.inicio();
    try {
      await this.enviar(trama(CMD.LEER_EMPEZAR, [0, 0]));
    } catch { this.estadoLectura(false); this.recibiendo = false; return; }
    this.indice = 1;
    this._sondear();
  }

  // Mientras lee, se le piden los tags juntados (como hace la librería de Chainway)
  async _sondear() {
    let intentos = 0;
    await dormir(100);
    while (this.leyendo) {
      try {
        if (this.n52) {
          const idx = this.indice;
          const r = this.esperar(CMD.PEDIR_TAGS + 1, 300, (d, t) => t && t.indice === idx);
          await this.enviar(trama(CMD.PEDIR_TAGS, [(idx >> 8) & 255, idx & 255]));
          intentos++;
          const ok = await r.then(() => true, () => false);
          if (ok || intentos >= 3) { this.indice = this.indice >= 10000 ? 1 : this.indice + 1; intentos = 0; }
        } else {
          const r = this.esperar(CMD.PEDIR_TAGS + 1, 400);
          await this.enviar(trama(CMD.PEDIR_TAGS, []));
          await r.catch(() => {});
        }
      } catch { /* una vuelta sin respuesta: se sigue */ }
      await dormir(10);
    }
  }

  async parar({ refrescar = true } = {}) {
    if (!this.leyendo) return;
    const vuelta = this.vuelta;
    this.estadoLectura(false);
    for (let k = 0; k < 3; k++) {
      const r = await this.pedir(CMD.LEER_PARAR, [], 400).then(() => true, () => false);
      if (r || !this.conectada) break;
    }
    await dormir(150); // lo último que estaba en camino
    if (this.vuelta !== vuelta) return; // ya arrancó otra lectura
    this.recibiendo = false;
    this.captura && this.captura.fin && this.captura.fin();
    if (refrescar) this.actualizar();
  }

  alternar() { return this.leyendo ? this.parar() : this.empezar({ manual: true }); }

  // Lee un momento sin gatillo y devuelve lo leído juntado ([{ epc, rssi, veces }], el más fuerte primero).
  // null si la pistola no está conectada.
  async rafaga(ms = 1200) {
    if (!this.conectada) return null;
    if (this.leyendo) await this.parar({ refrescar: false });
    const leidas = [];
    const quitar = this.registrar({ tag: (epc, rssi) => leidas.push({ epc, rssi }) });
    try {
      await this.empezar({ manual: true });
      await dormir(ms);
      await this.parar({ refrescar: false });
    } finally { quitar(); }
    return juntarLecturas(leidas);
  }
}

export const hayBluetooth = () => typeof navigator !== 'undefined' && !!navigator.bluetooth;
export const lectorR6 = new LectorR6();
