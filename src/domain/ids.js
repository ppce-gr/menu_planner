/**
 * Identificadores propios (UUID v4), no autoincrementales: así el modelo no
 * depende del motor de base de datos.
 */
export function newId() {
  return globalThis.crypto.randomUUID();
}
