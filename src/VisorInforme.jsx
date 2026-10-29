import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Loader2, FileText } from 'lucide-react';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { informePdf } from './api.js';
import { useEscape } from './ui.jsx';

GlobalWorkerOptions.workerSrc = workerUrl;

/* Visor del informe en PDF, dentro de Olympus (en Android Chrome no abre PDFs solo).
   Dibuja las hojas una tras otra al ancho de la pantalla. Se carga recién al tocar "Ver informe". */
export default function VisorInforme({ numero, ibm, onClose }) {
  useEscape(onClose);
  const hojas = useRef(null);
  const datos = useRef(null);
  const [st, setSt] = useState({ cargando: true }); // { cargando } | { error } | { total, listas }

  useEffect(() => {
    let vivo = true;
    let doc = null;
    (async () => {
      try {
        const buf = await informePdf(numero, ibm);
        if (!vivo) return;
        datos.current = buf.slice(0); // copia para descargar (pdf.js se queda con el original)
        doc = await getDocument({ data: buf }).promise;
        if (!vivo) return;
        setSt({ total: doc.numPages, listas: 0 });
        const caja = hojas.current;
        const ancho = Math.min(caja.clientWidth || 360, 1100);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= doc.numPages && vivo; n++) {
          const pag = await doc.getPage(n);
          const base = pag.getViewport({ scale: 1 });
          const vp = pag.getViewport({ scale: (ancho / base.width) * dpr });
          const cv = document.createElement('canvas');
          cv.width = vp.width; cv.height = vp.height;
          cv.style.width = '100%';
          cv.className = 'vi-hoja';
          cv.setAttribute('aria-label', `Hoja ${n} de ${doc.numPages}`);
          caja.appendChild(cv);
          await pag.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
          if (vivo) setSt({ total: doc.numPages, listas: n });
        }
      } catch (e) {
        if (vivo) setSt({ error: e.message || 'No se pudo abrir el informe.' });
      }
    })();
    return () => { vivo = false; if (doc) doc.destroy(); };
  }, [numero, ibm]);

  function descargar() {
    if (!datos.current) return;
    const url = URL.createObjectURL(new Blob([datos.current], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = `Informe-${numero}${ibm ? `-IBM${ibm}` : ''}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return (
    <div className="vi" role="dialog" aria-label={`Informe ${numero}`}>
      <div className="vi-bar">
        <FileText size={16} color="var(--t-E7C15A)" />
        <div className="vi-tit">
          <b>Informe {numero}</b>{ibm ? <span> · IBM {ibm}</span> : null}
          {st.total ? <em>{st.listas < st.total ? `Cargando hoja ${st.listas + 1} de ${st.total}…` : `${st.total} ${st.total === 1 ? 'hoja' : 'hojas'}`}</em> : null}
        </div>
        <button className="axt-btn small" onClick={descargar} disabled={!st.total} title="Descargar el PDF"><Download size={13} /> <span className="vi-txt">Descargar</span></button>
        <button className="axt-x sm" onClick={onClose} aria-label="Cerrar el informe"><X size={15} /></button>
      </div>
      <div className="vi-cuerpo">
        {st.cargando && <div className="vi-estado"><Loader2 size={22} className="spin" /> Abriendo el informe…</div>}
        {st.error && <div className="vi-estado error">{st.error}</div>}
        <div ref={hojas} className="vi-hojas" />
      </div>
    </div>
  );
}
