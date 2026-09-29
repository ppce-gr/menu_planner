/**
 * Consolidación de la lista de la compra. Dominio puro.
 */

const norm = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Suma cantidades por ingrediente + unidad.
 * @param {{nombre:string, cantidad:number, unidad?:string}[]} entries
 */
export function consolidate(entries = []) {
  const map = new Map();
  for (const entry of entries) {
    const nombre = norm(entry?.nombre);
    if (!nombre) continue;
    const unidad = norm(entry?.unidad) || 'ud';
    const key = `${nombre}|${unidad}`;
    const cantidad = Number(entry?.cantidad) || 0;
    const prev = map.get(key);
    if (prev) prev.cantidad += cantidad;
    else {
      map.set(key, {
        nombre: String(entry.nombre).trim(),
        unidad: entry.unidad || 'ud',
        cantidad,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/**
 * Marca como `enCasa` lo que ya tenemos, para no comprarlo.
 * @param {{nombre:string, cantidad:number, unidad:string}[]} items
 * @param {string[]} homeNames
 */
export function markAsAtHome(items = [], homeNames = []) {
  const home = new Set(homeNames.map(norm));
  return items.map((item) => ({
    ...item,
    estado: home.has(norm(item.nombre)) ? 'enCasa' : item.estado || 'pendiente',
  }));
}
