import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { ArrowLeft, X, Printer, Info, AlertTriangle, ChevronDown } from 'lucide-react';
import { Pill } from './ui.jsx';

/* ============================================================
   AYUDA · instructivos de uso (Cliente, Precintos, Trazabilidad)
   Se abre encima de la pantalla actual (no se pierde lo que se
   estaba haciendo) o como página suelta con ?ayuda=cliente
   (la que abre el QR de la hoja impresa). No muestra datos.
============================================================ */

const IMG = (n) => `${import.meta.env.BASE_URL}ayuda/${n}.webp`;
export const NOMBRE_GUIA = { cliente: 'Cliente', precintos: 'Precintos', traza: 'Trazabilidad' };

// Qué instructivos ve cada uno
export function guiasPara(rol) {
  if (rol === 'cliente') return ['cliente'];
  if (rol === 'precintos' || rol === 'traza' || rol === 'operador') return ['precintos', 'traza'];
  return ['cliente', 'precintos', 'traza'];
}

/* ---------- piezas de contenido ---------- */
function Sec({ id, n, titulo, img, imgs, children }) {
  const lista = imgs || (img ? [img] : []);
  return (
    <section id={'ay-' + id} className="ay-sec">
      <h2><span className="ay-n">{n}</span>{titulo}</h2>
      <div className={'ay-body' + (lista.length ? ' con-img' : '')}>
        <div className="ay-txt">{children}</div>
        {lista.length > 0 && (
          <div className="ay-figs">
            {lista.map((f) => (
              <figure key={f.src} className="ay-fig">
                <img src={IMG(f.src)} alt={f.alt} loading="lazy" />
                {f.cap && <figcaption>{f.cap}</figcaption>}
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
const Nota = ({ children }) => <div className="ay-nota"><Info size={15} /><div>{children}</div></div>;
const Aviso = ({ children }) => <div className="ay-aviso"><AlertTriangle size={15} /><div>{children}</div></div>;
function Faq({ q, children }) {
  return (
    <details className="ay-faq">
      <summary>{q}<ChevronDown size={15} /></summary>
      <div>{children}</div>
    </details>
  );
}

/* ============================================================
   CLIENTE
============================================================ */
const IDX_CLIENTE = [
  ['entrar', 'Entrar a Olympus'], ['escanear', 'Escanear una pieza'], ['ficha', 'La ficha de la pieza'],
  ['colores', 'Qué significan los colores'], ['nodisp', 'Si dice “Pieza no disponible”'],
  ['activos', 'Mis activos'], ['relev', 'Relevamientos en campo'], ['senal', 'Sin señal'], ['faq', 'Preguntas frecuentes'],
];
function GuiaCliente() {
  const url = window.location.origin;
  return (
    <>
      <Sec id="entrar" n="1" titulo="Entrar a Olympus" img={{ src: 'c-login', alt: 'Pantalla de ingreso del lado Cliente', cap: 'Ingreso del lado Cliente.' }}>
        <ol className="ay-pasos">
          <li>Abrí <b>{url.replace(/^https?:\/\//, '')}</b> en el navegador del celular (en Android, Chrome).</li>
          <li>Tocá <b>Cliente</b> e ingresá el <b>usuario</b> y la <b>contraseña</b> que te dio BM.</li>
          <li>Listo: ves tus activos. La sesión dura <b>3 días</b>; en ese tiempo el celular no te vuelve a pedir la contraseña.</li>
        </ol>
        <Nota><b>Instalala como app.</b> En Chrome tocá los tres puntos <b>⋮</b> → <b>Agregar a la pantalla principal</b> (o <b>Instalar app</b>). Queda el ícono de Olympus Trace junto a tus otras aplicaciones.</Nota>
      </Sec>

      <Sec id="escanear" n="2" titulo="Escanear una pieza con el celular" img={{ src: 'c-tag-login', alt: 'Pantalla que pide iniciar sesión al escanear un tag', cap: 'Sin sesión iniciada, primero pide usuario y contraseña.' }}>
        <p>Cada pieza inspeccionada por BM lleva un <b>tag</b> (el precinto electrónico). Con el celular ves su estado al instante.</p>
        <ol className="ay-pasos">
          <li><b>Activá el NFC.</b> En Android: bajá la barra de notificaciones y tocá <b>NFC</b>, o entrá a Ajustes → Conexiones (o Dispositivos conectados) → NFC.</li>
          <li><b>Desbloqueá</b> la pantalla.</li>
          <li><b>Apoyá la parte de atrás del celular sobre el tag</b> y dejalo quieto 1 o 2 segundos. En la mayoría de los Android la antena está en el centro de la espalda, cerca de la cámara. En iPhone, acercá la parte de arriba del teléfono.</li>
          <li>Se abre Olympus con la <b>ficha de la pieza</b>. Si el celular no tenía la sesión iniciada, primero te pide usuario y contraseña.</li>
        </ol>
        <Nota>Para ver una pieza siempre hace falta tu usuario. Si alguien escanea el tag sin usuario, no ve ningún dato.</Nota>
      </Sec>

      <Sec id="ficha" n="3" titulo="La ficha de la pieza" img={{ src: 'c-tag-pieza', alt: 'Ficha de una pieza vigente con su certificado', cap: 'Ficha de una pieza vigente.' }}>
        <ul className="ay-lista">
          <li><b>Arriba:</b> tipo de pieza, empresa, IBM, descripción, <b>Nº de serie</b> y el estado general.</li>
          <li><b>Certificados:</b> cada inspección de BM, con el número de informe, el resultado (<b>APTO</b> / <b>NO APTO</b>), la presión, el texto del precinto, la fecha de emisión, la de vencimiento y cuántos días faltan.</li>
          <li>Si BM habilitó el informe, aparece el botón <b>Ver informe (BM)</b> para abrirlo.</li>
          <li><b>Abajo:</b> con qué usuario estás, <b>Ir a Olympus</b> (tu pantalla completa) y <b>Salir</b>.</li>
        </ul>
      </Sec>

      <Sec id="colores" n="4" titulo="Qué significan los colores" img={{ src: 'c-tag-porvencer', alt: 'Ficha de una pieza por vencer', cap: 'Una pieza por vencer.' }}>
        <div className="ay-leyenda">
          <div><Pill status="certified" /><span>El certificado está al día.</span></div>
          <div><Pill status="due" /><span>Vence en <b>60 días o menos</b>. Conviene coordinar la próxima inspección con BM.</span></div>
          <div><Pill status="overdue" /><span>La fecha de vencimiento <b>ya pasó</b>.</span></div>
          <div><Pill status="sin_cert" /><span>La pieza está registrada pero todavía no tiene inspecciones cargadas.</span></div>
        </div>
      </Sec>

      <Sec id="nodisp" n="5" titulo="Si dice “Pieza no disponible”" img={{ src: 'c-no-disponible', alt: 'Mensaje Pieza no disponible', cap: 'La pieza no le corresponde a este usuario.' }}>
        <p>Aparece cuando la pieza:</p>
        <ul className="ay-lista">
          <li>es de <b>otra empresa</b>,</li>
          <li>es de un <b>IBM que tu usuario no tiene habilitado</b>, o</li>
          <li>tiene el tag <b>dado de baja</b>.</li>
        </ul>
        <p>Si tenés otro usuario (por ejemplo, de otro IBM), tocá <b>Salir</b> y entrá con ese. Si creés que deberías verla, pasale a BM el Nº de serie de la pieza para que revisen tus permisos.</p>
      </Sec>

      <Sec id="activos" n="6" titulo="Mis activos: vencimientos, búsqueda y filtros"
        imgs={[
          { src: 'c-inicio', alt: 'Pantalla de inicio del cliente con el resumen de vencimientos', cap: 'Pantalla de inicio.' },
          { src: 'c-filtro', alt: 'Lista de activos filtrada por Por vencer', cap: 'Filtro “Por vencer”.' },
        ]}>
        <p>Al entrar a Olympus (sin escanear), la pestaña <b>Mis activos</b> muestra todo lo tuyo:</p>
        <ul className="ay-lista">
          <li><b>Tus certificaciones por vencer:</b> cuántos certificados necesitan atención en los próximos 90 días, separados en vencidos, 30 días o menos y de 31 a 90 días.</li>
          <li><b>Tus activos:</b> la lista de piezas, ordenada por el vencimiento más cercano.</li>
          <li><b>Buscador:</b> por Nº de serie, descripción o número de informe.</li>
          <li><b>Filtros:</b> por estado (Todos, Vigentes, Por vencer, Vencidos) y, si tenés más de un IBM, por IBM.</li>
          <li><b>Tocá una pieza</b> para ver todos sus certificados.</li>
        </ul>
        <p>Debajo de los filtros figura de cuándo son los datos (por ejemplo, “datos hace instantes”).</p>
      </Sec>

      <Sec id="relev" n="7" titulo="Relevamientos en campo"
        imgs={[
          { src: 'c-relev-nuevo', alt: 'Nuevo relevamiento con tres piezas escaneadas', cap: 'Armando una lista.' },
          { src: 'c-relev-listas', alt: 'Listas guardadas con botones Excel y borrar', cap: 'Listas guardadas.' },
        ]}>
        <p>Sirven para dejar registrado qué piezas hay en un lugar; por ejemplo, todo lo que está en una locación.</p>
        <ol className="ay-pasos">
          <li>Entrá a la pestaña <b>Relevamientos</b>.</li>
          <li>Tocá <b>Escanear tag</b> y acercá el celular a cada tag, uno por uno. Cada pieza se suma a la lista con el color de su estado. Si escaneás una repetida, te avisa.</li>
          <li>Si agregaste una de más, quitala con la <b>✕</b>.</li>
          <li>Ponele un <b>nombre</b> a la lista (por ejemplo, “Locación Loma Campana”).</li>
          <li>Tocá <b>Guardar relevamiento</b>.</li>
        </ol>
        <p>En <b>Listas guardadas</b> quedan todas: tocá una para ver sus piezas, <b>Excel</b> para descargarla (Nº de serie, descripción, IBM, estado, vencimiento y Nº de informe) o el tacho para borrarla.</p>
        <Nota>Escanear desde adentro de Olympus funciona en <b>Android con Chrome</b>.</Nota>
      </Sec>

      <Sec id="senal" n="8" titulo="Sin señal">
        <ul className="ay-lista">
          <li><b>Mis activos</b> muestra los últimos datos descargados y se actualiza solo cuando vuelve la señal.</li>
          <li><b>Relevamientos:</b> podés escanear y armar la lista sin señal; queda guardada en el celular. Mientras no hay señal, el botón dice <b>Guardá al recuperar señal</b>: cuando vuelva, tocalo.</li>
          <li><b>Escanear un tag desde afuera de la app</b> (punto 2) necesita internet.</li>
          <li>Para usarlo sin señal, entrá a Olympus al menos una vez con internet desde ese celular.</li>
        </ul>
      </Sec>

      <Sec id="faq" n="9" titulo="Preguntas frecuentes">
        <Faq q="Me olvidé la contraseña">Pedile a BM que te la restablezca.</Faq>
        <Faq q="El tag no lee">Revisá que el NFC esté activado y la pantalla desbloqueada. Sacá la funda si es gruesa o metálica. Mové el celular despacio sobre el tag hasta encontrar el punto donde lee.</Faq>
        <Faq q="No veo algunas de mis piezas">Tu usuario ve solo las piezas de tu empresa y de los IBM que tiene habilitados. Pedile a BM que agregue los que falten.</Faq>
        <Faq q="¿Puedo usarlo en la computadora?">Sí, para ver tus activos y descargar relevamientos en Excel. Escanear tags necesita un celular con NFC.</Faq>
        <Faq q="¿Cómo cierro la sesión?">Con el ícono de salida, arriba a la derecha, o con <b>Salir</b> en la ficha de la pieza.</Faq>
        <Faq q="¿Alguien sin usuario puede ver mis piezas?">No. La información de cada pieza la ve solo quien tiene acceso a ella.</Faq>
      </Sec>
    </>
  );
}

/* ============================================================
   PRECINTOS
============================================================ */
const IDX_PRECINTOS = [
  ['entrar', 'Entrar'], ['cargar', 'Cargar la Hoja 2'], ['informe', 'Elegir el informe'], ['grabar', 'Grabar el tag'],
  ['colocar', 'Colocar el tag'], ['deshacer', 'Deshacer un paso'], ['noapto', 'Piezas NO APTO'], ['controlar', 'Controlar el trabajo'],
];
function GuiaPrecintos() {
  return (
    <>
      <Sec id="entrar" n="1" titulo="Entrar">
        <p>En el portal tocá <b>Operador</b> e ingresá con tu usuario de Precintos. La sesión dura 12 horas.</p>
        <p>La pantalla tiene dos pasos: <b>1 · Cargar Hoja 2 del informe</b> y <b>2 · Grabar y colocar tags</b>.</p>
      </Sec>

      <Sec id="cargar" n="2" titulo="Cargar la Hoja 2 del informe"
        imgs={[
          { src: 'p-carga', alt: 'Tarjeta Cargar Hoja 2 con los botones Descargar plantilla y Elegir Excel', cap: 'Paso 1 de la pantalla.' },
          { src: 'p-carga-preview', alt: 'Vista previa del Excel con filas válidas y una con error', cap: 'Vista previa: 3 filas válidas y 1 con error.' },
        ]}>
        <ol className="ay-pasos">
          <li>La primera vez, tocá <b>Descargar plantilla</b>: es un Excel con las columnas en el orden correcto y filas de ejemplo.</li>
          <li>Completá <b>una fila por ítem</b> del informe: cliente, ibm, informe, sector, item, descripcion, nro_serie, resultado, presion, vencimiento, precinto y link_informe_bm (opcional).</li>
          <li>Son obligatorios <b>cliente, nro_serie, informe y vencimiento</b>. El vencimiento va como mes/año: <b>06/2027</b>.</li>
          <li>Tocá <b>Elegir Excel</b> y elegí el archivo. Aparece una vista previa con las filas válidas y las que tienen error, con el motivo.</li>
          <li>Tocá <b>Importar N filas</b>. Las filas con error se saltean: corregilas en el Excel y volvé a subirlo.</li>
        </ol>
        <Nota>Cada Nº de serie es una pieza. Si la pieza ya existe por una inspección anterior, se le suma la nueva inspección a su historial; no se duplica.</Nota>
        <Nota>Un informe se identifica por <b>cliente + IBM + número</b>: el 001 del IBM 195 y el 001 del IBM 201 son informes distintos.</Nota>
      </Sec>

      <Sec id="informe" n="3" titulo="Elegir el informe" img={{ src: 'p-informe-top', alt: 'Tarjetas de informes, avance y filtros', cap: 'Informe 2182: 3 de 7 tags colocados.' }}>
        <ul className="ay-lista">
          <li>Cada informe cargado aparece como una tarjeta con su número, el cliente, el IBM y cuántos tags están colocados.</li>
          <li>Usá el buscador para encontrarlo por número o cliente.</li>
          <li>Al elegirlo ves el <b>avance</b>: colocados sobre el total, y cuántos están grabados y pendientes.</li>
          <li>Los filtros muestran <b>Todos</b>, <b>Pendientes</b>, <b>Grabados</b> o <b>Colocados</b>.</li>
        </ul>
      </Sec>

      <Sec id="grabar" n="4" titulo="Grabar el tag" img={{ src: 'p-grabar', alt: 'Panel Grabar tag con QR, link y botones', cap: 'Panel de grabado de una pieza.' }}>
        <p>Cada pieza tiene su propio link. Grabarlo en el tag es lo que une ese tag con esa pieza.</p>
        <ol className="ay-pasos">
          <li>En la pieza, tocá <b>Grabar tag</b>. Se abre un panel con el Nº de serie, un QR y el link de esa pieza.</li>
          <li><b>Desde el celular</b> (Android con Chrome): tocá <b>Grabar desde este teléfono</b> y apoyá el tag en la parte de atrás del celular. Cuando termina, la pieza pasa sola a <b>Grabado</b>.</li>
          <li><b>Con NFC Tools</b> (si lo anterior no funciona): tocá <b>Copiar URL</b>, abrí NFC Tools → Escribir → Agregar registro → URL, pegá el link, tocá Escribir y acercá el tag. Después volvé a Olympus y tocá <b>Ya lo grabé</b>.</li>
        </ol>
        <Aviso>Antes de grabar, confirmá que el <b>Nº de serie del panel</b> sea el de la pieza que tenés en la mano. Un tag grabado con el link de otra pieza mostraría la pieza equivocada.</Aviso>
      </Sec>

      <Sec id="colocar" n="5" titulo="Colocar el tag" img={{ src: 'p-lista', alt: 'Lista de piezas con estados colocado, grabado, pendiente y sin precinto', cap: 'Estados de cada pieza del informe.' }}>
        <ol className="ay-pasos">
          <li>Fijá el tag en la pieza.</li>
          <li>En la lista, tocá <b>Marcar colocado</b>. La pieza queda en verde con <b>✓ Listo</b>.</li>
        </ol>
        <p>El informe está terminado cuando todas las piezas APTO están colocadas (por ejemplo, 7 / 7).</p>
        <ul className="ay-lista">
          <li><b style={{ color: '#A9A7A2' }}>Pendiente:</b> falta grabar el tag.</li>
          <li><b style={{ color: '#E7C15A' }}>Grabado:</b> el tag está grabado pero todavía no se marcó como colocado.</li>
          <li><b style={{ color: '#57C98A' }}>Colocado:</b> terminado.</li>
          <li><b style={{ color: '#E5645C' }}>Sin precinto:</b> pieza NO APTO (ver punto 7).</li>
        </ul>
      </Sec>

      <Sec id="deshacer" n="6" titulo="Deshacer un paso">
        <p>La flecha <b>↶</b> al lado de cada pieza vuelve un paso atrás: de Colocado a Grabado, o de Grabado a Pendiente. Usala si marcaste algo por error.</p>
      </Sec>

      <Sec id="noapto" n="7" titulo="Piezas NO APTO">
        <p>Las piezas con resultado <b>NO APTO</b> aparecen como <b>Sin precinto</b> y dicen <b>No aplica</b>: no llevan tag.</p>
      </Sec>

      <Sec id="controlar" n="8" titulo="Controlar el trabajo">
        <p>Al terminar un informe, escaneá con el celular algunos de los tags ya colocados: se tiene que abrir la ficha con el <b>mismo Nº de serie</b> que tiene la pieza. Así te asegurás de que cada tag quedó en su pieza.</p>
        <p>El QR del panel de grabado abre la misma ficha: sirve para ver lo que va a ver el cliente.</p>
      </Sec>
    </>
  );
}

/* ============================================================
   TRAZABILIDAD
============================================================ */
const IDX_TRAZA = [
  ['entrar', 'Entrar'], ['datos', 'Datos de la entrada'], ['leer', 'Leer los tags'], ['revisar', 'Revisar la lista'],
  ['confirmar', 'Confirmar la entrada'], ['recientes', 'Entradas recientes'], ['salidas', 'Salidas'],
];
function GuiaTraza() {
  return (
    <>
      <Aviso><b>Etapa en preparación.</b> La pistola UHF todavía no está conectada: hoy la pantalla funciona en <b>modo prueba</b> y los botones de tags de prueba simulan lo que va a leer la pistola. Este instructivo describe el trabajo con la pistola.</Aviso>

      <Sec id="entrar" n="1" titulo="Entrar">
        <p>En el portal tocá <b>Operador</b> e ingresá con tu usuario de Trazabilidad. La sesión dura 12 horas.</p>
        <p>Trazabilidad registra las piezas que <b>entran al depósito</b> leyendo sus tags a distancia, sin tener que revisar una por una.</p>
      </Sec>

      <Sec id="datos" n="2" titulo="Cargar los datos de la entrada" img={{ src: 't-datos', alt: 'Datos de la entrada con remito y origen', cap: 'Remito y origen de la entrada.' }}>
        <ol className="ay-pasos">
          <li>Escribí el <b>Nº de remito</b>.</li>
          <li>Escribí el <b>origen o proveedor</b>: la base o el cliente que manda las piezas.</li>
        </ol>
        <Nota>Completalos <b>antes de leer el primer tag</b>. Con el primer tag se abre la entrada y esos datos quedan fijos hasta confirmarla.</Nota>
      </Sec>

      <Sec id="leer" n="3" titulo="Leer los tags con la pistola" img={{ src: 't-leer', alt: 'Zona de lectura de la pistola en modo prueba', cap: 'Zona de lectura (hoy, en modo prueba).' }}>
        <ol className="ay-pasos">
          <li>Encendé la pistola UHF y verificá que esté conectada.</li>
          <li>Apuntá a las piezas y <b>apretá el gatillo</b>. La pistola lee varios tags a la vez y a distancia.</li>
          <li>Recorré el lote hasta que la cantidad de <b>leídos</b> coincida con las piezas del remito.</li>
        </ol>
        <p>Cada tag leído aparece en la <b>Lista de entrada</b>. Si un tag ya estaba en la lista, no se duplica.</p>
      </Sec>

      <Sec id="revisar" n="4" titulo="Revisar la lista" img={{ src: 't-lista', alt: 'Lista de entrada con cuatro tags leídos y dos alertas', cap: '4 leídos, 2 con alerta.' }}>
        <ul className="ay-lista">
          <li>Arriba ves cuántos tags se leyeron y cuántos tienen <b>alerta</b>.</li>
          <li><b style={{ color: '#E5605C' }}>Cert vencido</b> o <b style={{ color: '#EDA53C' }}>Por vencer</b>: la pieza entra con el certificado vencido o próximo a vencer. Separala o avisá, según el procedimiento del depósito.</li>
          <li><b>Tag sin pieza asociada:</b> el tag no corresponde a ninguna pieza registrada. Apartala y avisá a Precintos.</li>
          <li>Si se leyó una pieza que no es de esta entrada (por ejemplo, una que ya estaba en el depósito), quitala con la <b>✕</b>.</li>
        </ul>
      </Sec>

      <Sec id="confirmar" n="5" titulo="Confirmar la entrada">
        <p>Cuando la lista está bien, tocá <b>Confirmar entrada</b>. Queda registrada con el remito, el origen y todas las piezas, y la pantalla queda lista para la siguiente.</p>
      </Sec>

      <Sec id="recientes" n="6" titulo="Entradas recientes" img={{ src: 't-recientes', alt: 'Lista de entradas recientes confirmadas', cap: 'Últimas entradas.' }}>
        <p>Muestra las últimas entradas con su remito, origen y cantidad de ítems.</p>
        <ul className="ay-lista">
          <li><b>Abierta:</b> se empezó a leer y todavía no se confirmó.</li>
          <li><b>Confirmada:</b> cerrada y registrada.</li>
        </ul>
      </Sec>

      <Sec id="salidas" n="7" titulo="Salidas (próxima etapa)">
        <p>El despacho de piezas va a funcionar igual: datos del remito de salida, lectura con la pistola, revisión y confirmación. Se habilita junto con la pistola.</p>
      </Sec>
    </>
  );
}

const GUIAS = {
  cliente: { titulo: 'Cliente', bajada: 'Cómo ver el estado de tus piezas, controlar los vencimientos y armar relevamientos en campo.', idx: IDX_CLIENTE, C: GuiaCliente },
  precintos: { titulo: 'Precintos', bajada: 'Cómo cargar un informe, grabar cada tag y dejar registrado que quedó colocado en su pieza.', idx: IDX_PRECINTOS, C: GuiaPrecintos },
  traza: { titulo: 'Trazabilidad', bajada: 'Cómo registrar las piezas que entran al depósito leyendo sus tags con la pistola UHF.', idx: IDX_TRAZA, C: GuiaTraza },
};

/* ============================================================
   Ventana de ayuda
   - overlay: encima de la app (onClose vuelve a donde estaba)
   - página suelta (?ayuda=): botón "Ir a Olympus"
============================================================ */
export default function Ayuda({ guias, inicial, onClose, pagina, puedeImprimir, Logo }) {
  const lista = (guias || []).filter((g) => GUIAS[g]);
  const [g, setG] = useState(lista.includes(inicial) ? inicial : lista[0]);
  const wrap = useRef(null);
  const cerrarRef = useRef(null);
  const G = GUIAS[g];

  useEffect(() => { if (wrap.current) wrap.current.scrollTop = 0; }, [g]);
  useEffect(() => {
    if (pagina) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [pagina]);
  useEffect(() => {
    if (pagina) return undefined;
    cerrarRef.current && cerrarRef.current.focus();
    const onKey = (e) => e.key === 'Escape' && onClose && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pagina, onClose]);

  const ir = (id) => {
    const el = document.getElementById('ay-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={'ay-wrap' + (pagina ? ' pagina' : '')} ref={wrap} role={pagina ? undefined : 'dialog'} aria-modal={pagina ? undefined : true} aria-label="Ayuda">
      <div className="ay-top">
        {pagina
          ? (Logo ? <Logo /> : <span className="ay-eyebrow">Olympus Trace</span>)
          : <button ref={cerrarRef} className="ay-back" onClick={onClose}><ArrowLeft size={15} /> Volver</button>}
        <span className="ay-top-r">
          {pagina
            ? <a className="axt-btn small" href={window.location.origin + '/'}>Ir a Olympus</a>
            : <button className="axt-x sm" onClick={onClose} aria-label="Cerrar ayuda"><X size={15} /></button>}
        </span>
      </div>

      <div className="ay-main">
        {lista.length > 1 && (
          <div className="ay-tabs" role="tablist" aria-label="Instructivos">
            {lista.map((k) => (
              <button key={k} role="tab" aria-selected={k === g} className={'ay-tab' + (k === g ? ' on' : '')} onClick={() => setG(k)}>{GUIAS[k].titulo}</button>
            ))}
          </div>
        )}

        <header className="ay-head">
          <div className="ay-eyebrow">Instructivo</div>
          <h1>{G.titulo}</h1>
          <p>{G.bajada}</p>
          {g === 'cliente' && puedeImprimir && (
            <a className="axt-btn small" href={window.location.origin + '/?ayuda=cliente&hoja=1'} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', marginTop: 12 }}>
              <Printer size={14} /> Hoja para imprimir y entregar al cliente
            </a>
          )}
        </header>

        <nav className="ay-idx" aria-label="Contenido">
          {G.idx.map(([id, t], i) => (
            <button key={id} onClick={() => ir(id)}><span>{i + 1}</span>{t}</button>
          ))}
        </nav>

        <G.C />

        <footer className="ay-foot">¿Algo no funciona como dice acá? Avisale a Administración de Olympus.</footer>
      </div>
    </div>
  );
}

/* ============================================================
   Hoja para imprimir y entregar al cliente (?ayuda=cliente&hoja=1)
   El QR apunta a la ayuda del cliente en este mismo dominio.
============================================================ */
export function HojaCliente() {
  const destino = `${window.location.origin}/?ayuda=cliente`;
  const [qr, setQr] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(destino, { margin: 1, width: 420, color: { dark: '#111111', light: '#FFFFFF' } }).then(setQr).catch(() => setQr(null));
  }, [destino]);
  useEffect(() => {
    const t = document.title;
    document.title = 'Olympus Trace - Hoja para el cliente';
    document.body.classList.add('hoja-body');
    return () => { document.title = t; document.body.classList.remove('hoja-body'); };
  }, []);

  return (
    <div className="hoja-wrap">
      <div className="hoja-bar">
        <button className="hoja-btn" onClick={() => window.print()}><Printer size={15} /> Imprimir o guardar PDF</button>
        <span>Tamaño A4. Completá a mano el usuario y el contacto antes de entregarla.</span>
      </div>

      <article className="hoja">
        <header className="hoja-head">
          <div className="hoja-logo">
            <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden>
              <circle cx="22" cy="22" r="20.4" fill="#0C0C0D" stroke="#C79A3B" strokeWidth="1.8" />
              <path d="M24.6 8.5 L13.8 23.6 L20.5 23.6 L18.6 35 L30.8 18.4 L23.4 18.4 Z" fill="#E7C15A" />
              <path d="M15 36.6 H29" stroke="#E7C15A" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <div><b>OLYMPUS</b> <span>TRACE</span></div>
          </div>
          <div className="hoja-kicker">Instructivo rápido · Cliente</div>
        </header>

        <h1>Cómo ver tus piezas con el celular</h1>
        <p className="hoja-lead">Cada pieza inspeccionada por BM lleva un tag. Acercando el celular ves su estado y sus certificados al instante.</p>

        <div className="hoja-datos">
          <div><span>Tu usuario</span><i /></div>
          <div><span>Contacto en BM</span><i /></div>
        </div>

        <ol className="hoja-pasos">
          <li><b>Activá el NFC</b> del celular. <em>Android: bajá la barra de notificaciones y tocá NFC.</em></li>
          <li><b>Apoyá la parte de atrás del celular sobre el tag</b> de la pieza y esperá 1 o 2 segundos.</li>
          <li><b>Ingresá tu usuario y contraseña.</b> <em>La sesión dura 3 días en ese celular.</em></li>
          <li><b>Mirá el estado y los certificados</b> de la pieza.</li>
        </ol>

        <div className="hoja-colores">
          <div><i style={{ background: '#2FA36B' }} /><b>Vigente</b><span>al día</span></div>
          <div><i style={{ background: '#E0962A' }} /><b>Por vencer</b><span>60 días o menos</span></div>
          <div><i style={{ background: '#D9443F' }} /><b>Vencido</b><span>fecha pasada</span></div>
          <div><i style={{ background: '#8C96A0' }} /><b>Sin certificados</b><span>sin inspecciones</span></div>
        </div>

        <div className="hoja-mas">
          <div>
            <h2>También en Olympus</h2>
            <p><b>Mis activos:</b> todas tus piezas y sus vencimientos, con buscador y filtros por estado e IBM.</p>
            <p><b>Relevamientos:</b> escaneá las piezas de una locación, guardá la lista y descargala en Excel. Funciona sin señal.</p>
            <p><b>En la computadora:</b> entrá a la misma dirección para ver tus activos y descargar listas.</p>
          </div>
          <div className="hoja-qr">
            {qr && <img src={qr} alt="QR al instructivo completo" />}
            <b>Instructivo completo</b>
            <span>{destino.replace(/^https?:\/\//, '')}</span>
          </div>
        </div>

        <section className="hoja-ayuda">
          <h2>Si algo no funciona</h2>
          <div><b>El tag no lee</b>Revisá que el NFC esté activado y la pantalla desbloqueada. Sacá la funda si es gruesa o metálica y mové el celular despacio sobre el tag.</div>
          <div><b>Dice “Pieza no disponible”</b>Esa pieza no está habilitada para tu usuario (otra empresa u otro IBM). Consultá a BM con el Nº de serie.</div>
          <div><b>Me volvió a pedir la contraseña</b>La sesión dura 3 días. Ingresá de nuevo; si no la recordás, pedile a BM que te la restablezca.</div>
        </section>

        <footer className="hoja-foot">Olympus Trace · Trazabilidad de activos, de la inspección al campo.</footer>
      </article>
    </div>
  );
}
