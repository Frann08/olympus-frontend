import React, { useState, useEffect, useRef } from 'react';
import { X, Radio, Loader2, Radar, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { api } from './api.js';
import { useEscape } from './ui.jsx';
import { lectorR6, hayBluetooth, juntarLecturas } from './r6.js';
import { BarraR6, useR6, epcLindo, usePotenciaMinima } from './Pistola.jsx';
import { puedeGrabar } from './GrabarSerie.jsx';

/* Revisar tag (Precintos): qué tiene grabado un tag y a qué pieza corresponde.
   - NFC (Chrome en Android): número de chip, contenido grabado y si es un link de Olympus.
   - UHF (con el escáner R6): los EPC que lee, con la potencia mínima.
   Con eso se busca en Olympus a qué pieza está asignado (por chip, por link o por EPC) y se
   explica qué pasa: libre, asignado, cruzado o ilegible. */

const normUid = (s) => {
  const hex = String(s || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  return hex.length >= 8 && hex.length % 2 === 0 ? hex.match(/../g).join(':') : null;
};
const EST_NOMBRE = { pendiente: 'Pendiente', grabado: 'Grabado', colocado: 'Colocado' };
const mesAnio = (d) => (/^\d{4}-\d{2}/.test(String(d || '')) ? `${String(d).slice(5, 7)}/${String(d).slice(0, 4)}` : null);

// Contenido de cada registro NDEF, como texto legible
function registros(message) {
  return ((message && message.records) || []).map((rec) => {
    let texto = '';
    try {
      if (rec.recordType === 'empty') texto = '';
      else if (rec.data) texto = new TextDecoder(rec.encoding || 'utf-8').decode(rec.data);
    } catch { texto = '(no se puede mostrar)'; }
    const tipo = rec.recordType === 'url' || rec.recordType === 'absolute-url' ? 'Link'
      : rec.recordType === 'text' ? 'Texto'
      : rec.recordType === 'empty' ? 'Vacío'
      : rec.mediaType || rec.recordType || 'Otro';
    return { tipo, texto };
  });
}
const tokenDe = (regs) => {
  for (const r of regs) { const m = r.texto && r.texto.match(/[?&]tag=([A-Za-z0-9]+)/); if (m) return m[1]; }
  return null;
};

async function buscar(params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  if (![...qs.keys()].length) return [];
  const r = await api('/api/precintos/tags/revisar?' + qs.toString());
  return r.tags || [];
}

function Pieza({ t }) {
  const por = [t.por_uid && 'número de chip', t.por_link && 'link grabado', t.por_epc && 'EPC del UHF'].filter(Boolean);
  const vence = mesAnio(t.vence);
  return (
    <div className="rv-pieza">
      <div className="rv-pieza-top">
        <b>{t.code}</b>
        <span className={'rv-est ' + t.estado}>{EST_NOMBRE[t.estado] || t.estado}</span>
        {!t.active && <span className="rv-est baja">dado de baja</span>}
      </div>
      <div className="rv-pieza-desc">{t.name}</div>
      <div className="rv-pieza-meta">
        {t.cliente}{t.ibm ? ` · IBM ${t.ibm}` : ''}{t.informe ? ` · INF ${t.informe}` : ''}
        {t.resultado ? ` · ${t.resultado}` : ''}{t.presion ? ` · ${t.presion}` : ''}{vence ? ` · vence ${vence}` : ''}
      </div>
      <div className="rv-pieza-meta">UHF: {t.epc ? epcLindo(t.epc) : <em>sin UHF asociado</em>}</div>
      {por.length > 0 && <div className="rv-pieza-por">Coincide por {por.join(' y ')}</div>}
    </div>
  );
}

// Explicación en una línea de lo que se encontró en el NFC
function diagnosticoNfc(n) {
  const porUid = n.piezas.filter((t) => t.por_uid);
  const porLink = n.piezas.filter((t) => t.por_link);
  const linkOlympus = !!n.token;
  if (porUid.length && porLink.length && !porUid.some((a) => porLink.some((b) => b.tag_id === a.tag_id)))
    return { tipo: 'error', texto: `Cruzado: el chip está registrado en ${porUid[0].code}, pero el link grabado es de ${porLink[0].code}. Conviene volver a grabarlo para la pieza correcta.` };
  const p = porUid[0] || porLink[0];
  if (p) {
    const usado = p.estado !== 'pendiente' && p.active;
    return { tipo: usado ? 'alerta' : 'ok', texto: usado
      ? `Este tag es de ${p.code} (${(EST_NOMBRE[p.estado] || p.estado).toLowerCase()}). Por eso Grabar en serie no lo deja usar en otra pieza. Si es un tag recuperado, ahí tocá "Es un tag recuperado: reusarlo".`
      : `Este tag tiene el link de ${p.code}, que todavía figura pendiente.` };
  }
  if (linkOlympus) return { tipo: 'alerta', texto: 'Tiene un link de Olympus, pero no corresponde a ninguna pieza (puede ser de una pieza borrada o de otra instalación). Se puede volver a grabar.' };
  if (!n.regs.length) return { tipo: 'ok', texto: 'Tag vacío: no tiene nada grabado y no está asignado a ninguna pieza. Se puede grabar.' };
  return { tipo: 'ok', texto: 'Tiene datos, pero no de Olympus, y no está asignado a ninguna pieza. Se puede grabar (lo que tiene se reemplaza).' };
}

export default function RevisarTag({ onClose }) {
  useEscape(onClose);
  usePotenciaMinima(); // el UHF se lee solo de cerca
  const r6 = useR6();
  const conR6 = r6.estado === 'lista' || r6.estado === 'leyendo';
  const [nfcFase, setNfcFase] = useState('listo'); // listo | esperando
  const [nfc, setNfc] = useState(null); // { uid, regs, token, piezas, error }
  const [nfcError, setNfcError] = useState(null);
  const [nadaTras, setNadaTras] = useState(false); // pasó un rato sin detectar nada
  const [uhf, setUhf] = useState(null); // { leyendo } | { lecturas: [{ epc, rssi, piezas }] }
  const lector = useRef(null);
  const timer = useRef(null);
  const juntas = useRef([]);

  useEffect(() => () => { pararNfc(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // el gatillo del escáner también lee el UHF
  useEffect(() => lectorR6.registrar({
    corteMs: 1500,
    inicio: () => { juntas.current = []; setUhf({ leyendo: true }); },
    tag: (epc, rssi) => { juntas.current.push({ epc, rssi }); },
    fin: () => { mostrarUhf(juntarLecturas(juntas.current)); },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  function pararNfc() {
    clearTimeout(timer.current);
    if (lector.current) { try { lector.current.abort(); } catch { /* ya estaba parado */ } }
    lector.current = null;
  }

  async function leerNfc() {
    setNfcError(null); setNadaTras(false);
    const ctrl = new AbortController();
    try {
      const ndef = new window.NDEFReader();
      await ndef.scan({ signal: ctrl.signal });
      lector.current = ctrl;
      setNfcFase('esperando');
      timer.current = setTimeout(() => setNadaTras(true), 12000);
      ndef.onreading = async (ev) => {
        clearTimeout(timer.current); setNadaTras(false); setNfcError(null);
        const uid = normUid(ev.serialNumber);
        const regs = registros(ev.message);
        const token = tokenDe(regs);
        const base = { uid, regs, token, piezas: null };
        setNfc(base);
        try { setNfc({ ...base, piezas: await buscar({ uid, token }) }); }
        catch (e) { setNfc({ ...base, piezas: [], error: e.message }); }
      };
      ndef.onreadingerror = () => {
        clearTimeout(timer.current); setNadaTras(false);
        setNfcError('Se detectó un tag, pero no se pudo leer su contenido. Puede estar bloqueado con contraseña (modo privado), dañado, o no tener formato NFC. Probá de nuevo dejándolo quieto unos segundos; si sigue igual, revisalo con NFC Tools.');
      };
    } catch (e) {
      ctrl.abort();
      setNfcError(e && e.name === 'NotAllowedError'
        ? 'Olympus no tiene permiso para usar el NFC. Cuando Chrome pregunte, tocá Permitir.'
        : e && e.name === 'NotSupportedError'
          ? 'Este teléfono no tiene NFC o está apagado. Prendé el NFC en Ajustes.'
          : 'No se pudo prender la lectura NFC: ' + ((e && e.message) || 'error desconocido'));
    }
  }

  async function mostrarUhf(lecturas) {
    const top = lecturas.slice(0, 5);
    setUhf({ lecturas: top.map((x) => ({ ...x, piezas: null })), total: lecturas.length });
    const conPiezas = await Promise.all(top.map(async (x) => ({ ...x, piezas: await buscar({ epc: x.epc }).catch(() => []) })));
    setUhf({ lecturas: conPiezas, total: lecturas.length });
  }
  async function leerUhf() {
    setUhf({ leyendo: true });
    const l = await lectorR6.rafaga(1500).catch(() => null);
    if (!l) { setUhf({ error: 'No se pudo leer con el escáner. Fijate que esté conectado.' }); return; }
    mostrarUhf(l);
  }

  const diag = nfc && nfc.piezas ? diagnosticoNfc(nfc) : null;

  return (
    <>
      <div className="axt-overlay" onClick={onClose} />
      <aside className="pr-panel ser rv" role="dialog" aria-label="Revisar tag">
        <div className="ser-top">
          <div style={{ minWidth: 0 }}>
            <div className="pr-eyebrow">Revisar tag</div>
            <div className="ser-titulo">Qué tiene grabado y de qué pieza es</div>
          </div>
          <button className="axt-x sm" onClick={onClose} aria-label="Cerrar"><X size={15} /></button>
        </div>

        {/* ---------- NFC ---------- */}
        <div className="rv-sec">
          <div className="rv-sec-tit"><Radio size={14} /> NFC</div>
          {!puedeGrabar() ? (
            <div className="pr-muted">Para leer el NFC hace falta Chrome en un Android con NFC.</div>
          ) : nfcFase === 'listo' ? (
            <button className="axt-btn primary" onClick={leerNfc}><Radio size={14} /> Leer NFC</button>
          ) : (
            <div className="rv-esperando"><span className="ser-onda"><Radio size={16} /></span> Acercá el tag a la espalda del teléfono y dejalo quieto.</div>
          )}
          {nfcError && <div className="ser-aviso error" role="alert"><AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} /><div>{nfcError}</div></div>}
          {nadaTras && !nfc && (
            <div className="ser-aviso alerta" role="status">
              <Info size={15} style={{ flex: 'none', marginTop: 1 }} />
              <div>
                No se detecta ningún tag. Revisá:
                <ul className="rv-lista">
                  <li>Que un tag que sabés que anda sí se lea (si no, es el teléfono: NFC apagado, funda gruesa, otra app usando el NFC).</li>
                  <li>Que el tag no esté pegado a metal: despegalo o separalo de la pieza.</li>
                  <li>Con el escáner, si el UHF lee (abajo): si el UHF anda y el NFC no, la parte NFC está dañada o en modo privado.</li>
                </ul>
              </div>
            </div>
          )}
          {nfc && (
            <div className="rv-res">
              <div className="rv-fila"><span>Número de chip</span><b>{nfc.uid || '—'}</b></div>
              <div className="rv-fila"><span>Contenido</span>
                {nfc.regs.length ? (
                  <div className="rv-regs">{nfc.regs.map((r, i) => <div key={i}><em>{r.tipo}:</em> {r.texto || '(vacío)'}</div>)}</div>
                ) : <b>Vacío (sin datos)</b>}
              </div>
              <div className="rv-fila"><span>Link de Olympus</span><b>{nfc.token ? 'Sí' : 'No'}</b></div>
              {nfc.piezas === null ? <div className="rv-fila"><Loader2 size={14} className="spin" /> Buscando en Olympus…</div> : (
                <>
                  {nfc.piezas.map((t) => <Pieza key={t.tag_id} t={t} />)}
                  {diag && (
                    <div className={'ser-aviso ' + diag.tipo} role="status">
                      {diag.tipo === 'ok' ? <CheckCircle2 size={15} style={{ flex: 'none', marginTop: 1 }} /> : <AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} />}
                      <div>{diag.texto}</div>
                    </div>
                  )}
                  {nfc.error && <div className="ser-aviso error" role="alert"><div>No se pudo buscar en Olympus: {nfc.error}</div></div>}
                </>
              )}
              <div className="pr-muted" style={{ marginTop: 6 }}>Podés acercar otro tag: se revisa solo.</div>
            </div>
          )}
        </div>

        {/* ---------- UHF ---------- */}
        {hayBluetooth() && (
          <div className="rv-sec">
            <div className="rv-sec-tit"><Radar size={14} /> UHF (escáner RFID)</div>
            <BarraR6 fija />
            {conR6 && (
              <button className="axt-btn" style={{ marginTop: 10 }} onClick={leerUhf} disabled={!!(uhf && uhf.leyendo)}>
                {uhf && uhf.leyendo ? <Loader2 size={14} className="spin" /> : <Radar size={14} />} Leer UHF
              </button>
            )}
            {conR6 && <div className="pr-muted" style={{ marginTop: 6 }}>Con la potencia mínima: apuntá bien de cerca. También podés apretar el gatillo.</div>}
            {uhf && uhf.error && <div className="ser-aviso error" role="alert"><div>{uhf.error}</div></div>}
            {uhf && uhf.lecturas && (
              uhf.lecturas.length === 0 ? (
                <div className="ser-aviso alerta" role="status"><AlertTriangle size={15} style={{ flex: 'none', marginTop: 1 }} /><div>No se leyó ningún UHF. Acercá el escáner al tag. Si el NFC anda y el UHF no, la parte UHF del tag puede estar dañada.</div></div>
              ) : (
                <div className="rv-res">
                  {uhf.total > uhf.lecturas.length && <div className="pr-muted">Se leyeron {uhf.total} tags; se muestran los {uhf.lecturas.length} más cercanos.</div>}
                  {uhf.lecturas.map((x) => (
                    <div key={x.epc} className="rv-uhf">
                      <div className="rv-fila"><span>EPC{x.rssi != null ? ` · ${Math.round(x.rssi)} dBm` : ''}</span><b className="rv-epc">{epcLindo(x.epc)}</b></div>
                      {x.piezas === null ? <div className="rv-fila"><Loader2 size={14} className="spin" /> Buscando…</div>
                        : x.piezas.length ? x.piezas.map((t) => <Pieza key={t.tag_id} t={t} />)
                        : <div className="pr-muted">No está asociado a ninguna pieza.</div>}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </aside>
    </>
  );
}
