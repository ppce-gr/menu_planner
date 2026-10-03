import { normalizeText } from './text.js';

/** Tipos de comida canónicos que usa la app. */
export const MEAL_TYPES = ['desayuno', 'comida', 'merienda', 'cena'];

const SYNONYMS = {
  desayuno: 'desayuno',
  breakfast: 'desayuno',
  almuerzo: 'comida',
  comida: 'comida',
  lunch: 'comida',
  'media manana': 'merienda',
  'media tarde': 'merienda',
  merienda: 'merienda',
  snack: 'merienda',
  tentempie: 'merienda',
  cena: 'cena',
  dinner: 'cena',
  supper: 'cena',
};

/**
 * Lleva cualquier nombre de comida al canónico (`desayuno`, `comida`,
 * `merienda`, `cena`). Si no lo reconoce, devuelve el texto normalizado.
 */
export function normalizeMealType(value) {
  const key = normalizeText(value);
  if (!key) return 'comida';
  return SYNONYMS[key] ?? key;
}
