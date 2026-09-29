import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EMPTY_RULES, forbiddenIngredientIn, normalizeRules } from '../src/domain/HouseRules.js';
import { validateAiPlan } from '../src/domain/PlanValidator.js';
import { buildMessages } from '../src/application/prompt.js';
import { HogarService } from '../src/application/HogarService.js';
import { PlanService } from '../src/application/PlanService.js';
import { createMemoryRepositories } from '../src/infrastructure/persistence/MemoryRepositories.js';

const planCon = (ingrediente) => ({
  fechaInicio: '2026-10-05',
  fechaFin: '2026-10-11',
  dias: [
    {
      fecha: '2026-10-05',
      comidas: [
        {
          tipo: 'comida',
          receta: { nombre: 'Revuelto', ingredientes: [{ nombre: ingrediente, cantidad: 100, unidad: 'g' }] },
          comensales: [{ comensalId: 'c1', raciones: 1 }],
        },
      ],
    },
  ],
});

test('las normas se normalizan desde listas o texto', () => {
  assert.deepEqual(normalizeRules({}), EMPTY_RULES);
  const reglas = normalizeRules({ normas: 'Sin setas\nThermomix', ingredientesProhibidos: 'setas, frutos secos' });
  assert.deepEqual(reglas.normas, ['Sin setas', 'Thermomix']);
  assert.deepEqual(reglas.ingredientesProhibidos, ['setas', 'frutos secos']);
});

test('detecta ingredientes prohibidos ignorando acentos y mayúsculas', () => {
  assert.ok(forbiddenIngredientIn(planCon('Setas de cardo'), ['setas']));
  assert.equal(forbiddenIngredientIn(planCon('Calabacín'), ['setas']), null);
  assert.ok(forbiddenIngredientIn(planCon('JAMÓN cocido'), ['jamon']));
});

test('el plan se rechaza si incumple una norma del hogar', () => {
  assert.throws(
    () => validateAiPlan(planCon('Setas'), { dinerIds: ['c1'], ingredientesProhibidos: ['setas'] }),
    /prohibido por las normas/i,
  );
  assert.ok(validateAiPlan(planCon('Calabacín'), { dinerIds: ['c1'], ingredientesProhibidos: ['setas'] }));
});

test('las normas viajan en el prompt del asistente', () => {
  const messages = buildMessages({
    diners: [{ id: 'c1', nombre: 'Ana' }],
    rules: { normas: ['Cocinar con Thermomix'], ingredientesProhibidos: ['setas'] },
    userText: 'Planifica',
  });
  const system = messages[0].content;
  assert.match(system, /Normas del hogar/);
  assert.match(system, /Thermomix/);
  assert.match(system, /setas/);
});

test('PlanService rechaza un plan que incumple las normas del hogar', async () => {
  const repositories = createMemoryRepositories();
  await repositories.hogares.save({
    id: 'h1',
    nombre: 'Casa',
    usuarioId: 'u1',
    creadoEn: new Date().toISOString(),
    reglas: { normas: [], ingredientesProhibidos: ['setas'] },
  });
  const hogarService = new HogarService({ hogares: repositories.hogares });
  const plans = new PlanService({
    plans: repositories.plans,
    recipes: repositories.recipes,
    diners: repositories.diners,
    hogarService,
  });

  const plan = await plans.create({ hogarId: 'h1', fechaInicio: '2026-10-05', fechaFin: '2026-10-11' });
  await assert.rejects(() => plans.applyAiPlan(plan.id, planCon('Setas')), /prohibido/);

  const bueno = await plans.applyAiPlan(plan.id, planCon('Calabacín'));
  assert.equal(bueno.estado, 'en_revision');
});
