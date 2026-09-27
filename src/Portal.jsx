import React from 'react';

const DOORS = [
  {
    id: 'cliente', n: '01', t: 'Cliente', s: 'Halliburton · SPI',
    d: 'Consultá tus activos, vencimientos e informes. Armá relevamientos en campo.',
    items: ['Mis activos', 'Relevamientos', 'Informes BM'],
  },
  {
    id: 'operador', n: '02', t: 'Operador', s: 'Precintos · Trazabilidad',
    d: 'Carga de la Hoja 2, grabado y colocación de tags, entradas con pistola UHF.',
    items: ['Precintos: cargar, grabar y colocar', 'Trazabilidad: entradas y salidas'],
  },
  {
    id: 'admin', n: '03', t: 'Administración', s: 'Olympus',
    d: 'Empresas, IBMs, usuarios y permisos de toda la plataforma.',
    items: ['Empresas e IBMs', 'Usuarios y permisos', 'Supervisión general'],
  },
];

export const SIDE_NAME = { cliente: 'Lado cliente', operador: 'Lado operador', admin: 'Administración' };

export default function Portal({ onPick, Logo }) {
  return (
    <div className="pt-wrap">
      <header className="pt-top"><Logo /></header>
      <main className="pt-main">
        <section className="pt-hero">
          <div className="pt-eyebrow">Plataforma de trazabilidad industrial</div>
          <h1 className="pt-title">
            <span className="pt-steel">OLYMPUS</span><br />
            <span className="pt-gold">TRACE</span>
          </h1>
          <p className="pt-lead">Elegí tu acceso. Cada lado tiene su propio usuario y ve solo lo que le corresponde.</p>
        </section>

        <div className="pt-doors">
          {DOORS.map((d) => (
            <button key={d.id} className="pt-door" onClick={() => onPick(d.id)}>
              <span className="pt-n">{d.n}</span>
              <span className="pt-t">{d.t}</span>
              <span className="pt-s">{d.s}</span>
              <span className="pt-d">{d.d}</span>
              <span className="pt-l">
                {d.items.map((i) => <span key={i}>{i}</span>)}
              </span>
              <span className="pt-go">Ingresar →</span>
            </button>
          ))}
        </div>

        <p className="pt-foot">Un solo sistema, una sola base: la pieza que carga Precintos es la misma que ve el Cliente al escanear.</p>
      </main>
    </div>
  );
}
