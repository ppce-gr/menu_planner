import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OUT_OF_SCOPE_REPLY, isInScope, scopeGuard } from '../src/domain/ScopeGuard.js';
import { isPlanningReady, missingRequiredPoints } from '../src/domain/PlanningContext.js';
import { consolidate, markAsAtHome } from '../src/domain/ShoppingList.js';
import {
  scaleIngredients,
  shoppingEntriesFromPlan,
  validateAiPlan,
} from '../src/domain/PlanValidator.js';

const samplePlan = () => ({
  fechaInicio: '2025-01-06',
  fechaFin: '2025-01-12',
  dias: [
    {
      fecha: '2025-01-06',
      comidas: [
        {
          tipo: 'comida',
          receta: {
            nombre: 'Lentejas',
            racionesBase: 2,
            ingredientes: [{ nombre: 'lentejas', cantidad: 200, unidad: 'g' }],
          },
          comensales: [{ comensalId: 'c1', raciones: 2 }],
        },
      ],
    },
  ],
});

test('el alcance corta lo externo y deja pasar lo del cometido', () => {
  assert.equal(scopeGuard('¿A qué hora juega el Madrid?'), OUT_OF_SCOPE_REPLY);
  assert.equal(scopeGuard('Dime las noticias de hoy'), OUT_OF_SCOPE_REPLY);
  assert.equal(scopeGuard('¿Cuántas calorías tiene una pechuga de pollo de 100 g?'), null);
  assert.equal(scopeGuard('Prepárame una receta con lentejas'), null);
  assert.equal(isInScope('planifica la semana'), true);
});

test('los puntos obligatorios de planificación se detectan', () => {
  assert.equal(isPlanningReady({}), false);
  const completo = {
    semana: '2025-01-06',
    comensales: ['c1'],
    comidas: ['comida', 'cena'],
    dietas: ['sin gluten'],
    cantidades: { c1: 1 },
  };
  assert.equal(isPlanningReady(completo), true);
  assert.deepEqual(missingRequiredPoints(completo), []);
  assert.deepEqual(
    missingRequiredPoints({ semana: 'x' }).map((p) => p.key),
    ['comensales', 'comidas', 'dietas', 'cantidades'],
  );
});

test('la compra se consolida por ingrediente y unidad', () => {
  const lista = consolidate([
    { nombre: 'Lentejas', cantidad: 200, unidad: 'g' },
    { nombre: 'lentejas', cantidad: 300, unidad: 'g' },
    { nombre: 'cebolla', cantidad: 1, unidad: 'ud' },
  ]);
  assert.equal(lista.length, 2);
  assert.deepEqual(lista[0], { nombre: 'cebolla', unidad: 'ud', cantidad: 1 });
  assert.deepEqual(lista[1], { nombre: 'Lentejas', unidad: 'g', cantidad: 500 });

  const conCasa = markAsAtHome(lista, ['lentejas']);
  assert.equal(conCasa.find((i) => i.nombre === 'Lentejas').estado, 'enCasa');
  assert.equal(conCasa.find((i) => i.nombre === 'cebolla').estado, 'pendiente');
});

test('el plan de la IA se valida antes de volcarse', () => {
  assert.equal(validateAiPlan(samplePlan(), { dinerIds: ['c1'] }).fechaInicio, '2025-01-06');
  assert.throws(() => validateAiPlan({}, {}), /Faltan/);
  assert.throws(
    () =>
      validateAiPlan(
        {
          fechaInicio: '2025-01-06',
          fechaFin: '2025-01-12',
          dias: [
            {
              fecha: '2025-01-06',
              comidas: [
                {
                  tipo: 'comida',
                  receta: { nombre: 'X' },
                  comensales: [{ comensalId: 'desconocido', raciones: 1 }],
                },
              ],
            },
          ],
        },
        { dinerIds: ['c1'] },
      ),
    /Comensal desconocido/,
  );
});

test('las cantidades se escalan por raciones y salen a la compra', () => {
  const receta = { racionesBase: 2, ingredientes: [{ nombre: 'lentejas', cantidad: 200, unidad: 'g' }] };
  assert.equal(scaleIngredients(receta, 4)[0].cantidad, 400);
  const entries = shoppingEntriesFromPlan(samplePlan());
  assert.deepEqual(entries[0], {
    nombre: 'lentejas',
    cantidad: 200,
    unidad: 'g',
    opcional: false,
  });
});
