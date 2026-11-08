import React, { useState, useEffect } from 'react';
import { Eye } from 'lucide-react';
import { api, setVerCliente } from './api.js';
import { Spinner, ErrorNote } from './ui.jsx';
import Cliente from './Cliente.jsx';

// Administración: ver la pantalla del cliente tal como la ve una empresa, sin cambiar de usuario
export default function VistaCliente({ toast }) {
  const [empresas, setEmpresas] = useState(null);
  const [error, setError] = useState(null);
  const [id, setId] = useState(() => { try { return sessionStorage.getItem('ot_ver_cliente') || ''; } catch { return ''; } });
  setVerCliente(id); // antes de dibujar la pantalla del cliente, para que sus pedidos vayan por esa empresa

  useEffect(() => {
    api('/api/clients').then(setEmpresas).catch((e) => setError(e.message));
    return () => setVerCliente(null);
  }, []);

  const elegir = (v) => {
    setVerCliente(v);
    setId(v);
    try { sessionStorage.setItem('ot_ver_cliente', v); } catch { /* nada */ }
  };
  const emp = (empresas || []).find((c) => String(c.id) === String(id));
  useEffect(() => { if (empresas && id && !emp) elegir(''); }, [empresas]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorNote error={error} />;
  if (!empresas) return <Spinner />;
  return (
    <div>
      <div className="axt-card vc-barra">
        <Eye size={18} color="var(--t-D9B44A)" />
        <label className="fld vc-sel"><span>Ver la pantalla del cliente como</span>
          <select className="cor-select" value={id} onChange={(e) => elegir(e.target.value)}>
            <option value="">— Elegí la empresa —</option>
            {empresas.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.assets} {c.assets === 1 ? 'pieza' : 'piezas'})</option>)}
          </select>
        </label>
        <p className="vc-nota">Ves todos los IBM de la empresa. Lo que armes acá (listas de relevamiento, destinos) queda guardado para esa empresa.</p>
      </div>
      {emp
        ? <Cliente key={emp.id} toast={toast} vista={{ nombre: emp.name }} />
        : <div className="vc-vacio">Elegí una empresa para ver lo mismo que ve el cliente: sus piezas, relevamientos y destinos.</div>}
    </div>
  );
}
