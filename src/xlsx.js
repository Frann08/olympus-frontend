// La librería de Excel es pesada (~400 kB): se baja recién cuando alguien importa o exporta un Excel.
let prom = null;
export const cargarXlsx = () => (prom ||= import('xlsx'));
