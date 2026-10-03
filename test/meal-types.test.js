import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MEAL_TYPES, normalizeMealType } from '../src/domain/MealTypes.js';
import { normalizeAiPlan } from '../src/domain/PlanValidator.js';
import { PlanService } from '../src/application/PlanService.js';
import { createMemoryRepositories } from '../src/infrastructure/persistence/MemoryRepositories.js';

test('los tipos de comida se normalizan siempre', () => {
  assert.deepEqual(MEAL_TYPES, ['desayuno', 'comida', 'merienda', 'cena']);
  assert.equal(normalizeMealType('Almuerzo'), 'comida');
  assert.equal(normalizeMealType('lunch'), 'comida');
  assert.equal(normalizeMealType('Desayuno'), 'desayuno');
  assert.equal(normalizeMealType('breakfast'), 'desayuno');
  assert.equal(normalizeMealType('CENA'), 'cena');
  assert.equal(normalizeMealType('dinner'), 'cena');
  assert.equal(normalizeMealType('media mañana'), 'merienda');
  assert.equal(normalizeMealType('snack'), 'merienda');
  assert.equal(normalizeMealType('postre'), 'postre');
  assert.equal(normalizeMealType(''), 'comida');
});

test('normalizeAiPlan convierte los tipos del plan a canónicos', () => {
  const plan = normalizeAiPlan({
    dias: [{ fecha: '2026-10-05', comidas: [{ tipo: 'Almuerzo' }, { tipo: 'dinner' }] }],
  });
  assert.deepEqual(
    plan.dias[0].comidas.map((c) => c.tipo),
    ['comida', 'cena'],
  );
});

test('PlanService guarda «comida» aunque la IA devuelva «almuerzo»', async () => {
  const repositories = createMemoryRepositories();
  const plans = new PlanService({
    plans: repositories.plans,
    recipes: repositories.recipes,
    diners: repositories.diners,
  });
  const plan = await plans.create({
    hogarId: 'h1',
    fechaInicio: '2026-10-05',
    fechaFin: '2026-10-11',
  });
  const applied = await plans.applyAiPlan(plan.id, {
    fechaInicio: '2026-10-05',
    fechaFin: '2026-10-11',
    dias: [
      {
        fecha: '2026-10-05',
        comidas: [{ tipo: 'almuerzo', receta: { nombre: 'X', ingredientes: [] }, comensales: [] }],
      },
    ],
  });
  assert.equal(applied.dias[0].comidas[0].tipo, 'comida');
});
