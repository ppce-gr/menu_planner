import { DomainError } from './errors.js';
import { forbiddenIngredientIn } from './HouseRules.js';

/**
 * Reglas de la planificación: validación del plan que devuelve la IA y cálculo
 * de la compra. Dominio puro.
 */

/**
 * Escala los ingredientes de una receta al número de raciones pedido.
 */
export function scaleIngredients(recipe, raciones) {
  const base = Number(recipe?.racionesBase) || 1;
  const factor = (Number(raciones) || base) / base;
  return (recipe?.ingredientes ?? []).map((i) => ({
    nombre: String(i?.nombre ?? '').trim(),
    cantidad: (Number(i?.cantidad) || 0) * factor,
    unidad: i?.unidad || 'ud',
    opcional: Boolean(i?.opcional),
  }));
}

/**
 * Valida la forma del JSON que devuelve el asistente antes de volcar nada.
 */
export function validateAiPlan(plan, { dinerIds = [], ingredientesProhibidos = [] } = {}) {
  if (!plan || typeof plan !== 'object') {
    throw new DomainError('PLAN_INVALIDO', 'El plan no es un objeto');
  }
  if (!plan.fechaInicio || !plan.fechaFin) {
    throw new DomainError('PLAN_INVALIDO', 'Faltan las fechas del plan');
  }
  if (!Array.isArray(plan.dias) || plan.dias.length === 0) {
    throw new DomainError('PLAN_INVALIDO', 'El plan no tiene días');
  }
  const validDiners = new Set(dinerIds);
  for (const dia of plan.dias) {
    if (!dia.fecha) throw new DomainError('PLAN_INVALIDO', 'Hay un día sin fecha');
    if (!Array.isArray(dia.comidas)) {
      throw new DomainError('PLAN_INVALIDO', `El día ${dia.fecha} no tiene comidas`);
    }
    for (const comida of dia.comidas) {
      if (!comida.tipo) {
        throw new DomainError('PLAN_INVALIDO', `Hay una comida sin tipo en ${dia.fecha}`);
      }
      if (!comida.receta?.nombre) {
        throw new DomainError('PLAN_INVALIDO', `Hay una comida sin receta en ${dia.fecha}`);
      }
      for (const comensal of comida.comensales ?? []) {
        if (validDiners.size > 0 && !validDiners.has(comensal.comensalId)) {
          throw new DomainError('COMENSAL_DESCONOCIDO', `Comensal desconocido: ${comensal.comensalId}`);
        }
      }
    }
  }
  const incumplimiento = forbiddenIngredientIn(plan, ingredientesProhibidos);
  if (incumplimiento) {
    throw new DomainError(
      'REGLA_INCUMPLIDA',
      `El plan usa «${incumplimiento.ingrediente}», prohibido por las normas del hogar`,
    );
  }
  return plan;
}

/**
 * Extrae las entradas de compra de un plan validado, escalando cada receta por
 * el total de raciones asignadas.
 */
export function shoppingEntriesFromPlan(plan) {
  const entries = [];
  for (const dia of plan?.dias ?? []) {
    for (const comida of dia?.comidas ?? []) {
      const raciones = (comida.comensales ?? []).reduce(
        (sum, c) => sum + (Number(c.raciones) || 1),
        0,
      );
      entries.push(...scaleIngredients(comida.receta, raciones));
    }
  }
  return entries;
}
