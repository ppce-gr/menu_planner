/** Texto normalizado: minúsculas, sin acentos y sin espacios sobrantes. */
export function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
