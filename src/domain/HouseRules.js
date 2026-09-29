/**
 * Normas del hogar: reglas permanentes que el asistente debe respetar siempre
 * al planificar. El dominio las normaliza y sabe comprobar su cumplimiento.
 */

export const EMPTY_RULES = { normas: [], ingredientesProhibidos: [] };

/** minusculas, sin acentos y sin espacios sobrantes */
export function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function asStringList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[\n,;]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizeRules(rules = {}) {
  return {
    normas: asStringList(rules.normas),
    ingredientesProhibidos: asStringList(rules.ingredientesProhibidos),
  };
}

/**
 * Devuelve el primer ingrediente del plan que incumple la lista de prohibidos,
 * o `null` si todo está bien.
 */
export function forbiddenIngredientIn(plan, ingredientesProhibidos = []) {
  const prohibidos = ingredientesProhibidos.map(normalizeText).filter(Boolean);
  if (prohibidos.length === 0) return null;
  for (const dia of plan?.dias ?? []) {
    for (const comida of dia?.comidas ?? []) {
      for (const ingrediente of comida?.receta?.ingredientes ?? []) {
        const nombre = normalizeText(ingrediente?.nombre);
        if (!nombre) continue;
        for (const prohibido of prohibidos) {
          if (nombre.includes(prohibido)) {
            return { ingrediente: String(ingrediente.nombre), prohibido };
          }
        }
      }
    }
  }
  return null;
}
