/**
 * Red de seguridad del alcance del asistente (segunda capa, además del prompt).
 *
 * El asistente solo trabaja recetas, ingredientes, menús, planificación y
 * nutrición de esos alimentos. Si le preguntan algo externo (fútbol, noticias,
 * el tiempo…), se corta con un mensaje fijo sin depender del modelo.
 *
 * Es deliberadamente conservador: ante la duda, deja pasar.
 */

export const OUT_OF_SCOPE_REPLY =
  'No trabajo con cosas externas fuera de mi cometido. Puedo ayudarte con ' +
  'recetas, menús, ingredientes, planificación semanal y su información ' +
  'nutricional.';

const IN_SCOPE = [
  /\b(receta|recetas|cocina|cocinar|cocinado|ingrediente|ingredientes|men[uú]|men[uú]s|desayuno|almuerzo|comida|comidas|cena|cenas|merienda|postre|planific\w*|plan semanal|dieta|alergia|alergias|al[eé]rgen\w*|calor[ií]as?|prote[ií]nas?|hidratos|grasas?|nutrici[oó]n|nutricional|sobrante|sobrantes|compra|raciones?|thermomix|horno|guiso|verdura|carne|pescado|legumbre|fruta|l[aá]cteo)\b/i,
];

const OUT_OF_SCOPE = [
  /\b(f[uú]tbol|madrid|barça|barcelona|liga|champions|partido|clasificaci[oó]n|marcador|gol(es)?)\b/i,
  /\b(noticias?|pol[ií]tica|elecciones|presidente|guerra|bolsa|cripto\w*|bitcoin|cotizaci[oó]n)\b/i,
  /\b(el tiempo|clima|llover[aá]|pron[oó]stico meteorol\w*|temperatura en)\b/i,
  /\b(chiste|chistes|canci[oó]n|pel[ií]cula|serie de televisi[oó]n)\b/i,
];

export function isInScope(text) {
  const t = String(text ?? '');
  if (IN_SCOPE.some((re) => re.test(t))) return true;
  if (OUT_OF_SCOPE.some((re) => re.test(t))) return false;
  return true;
}

/**
 * @returns {string|null} el mensaje de rechazo, o `null` si está dentro del alcance.
 */
export function scopeGuard(text) {
  return isInScope(text) ? null : OUT_OF_SCOPE_REPLY;
}
