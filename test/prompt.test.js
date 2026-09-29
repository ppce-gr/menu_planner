import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildMessages, formatToday, parsePlanFromReply } from '../src/application/prompt.js';

const planObj = {
  plan: {
    fechaInicio: '2026-10-05',
    fechaFin: '2026-10-06',
    dias: [
      {
        fecha: '2026-10-05',
        comidas: [
          {
            tipo: 'comida',
            receta: { nombre: 'Lentejas', ingredientes: [{ nombre: 'lentejas', cantidad: 200, unidad: 'g' }] },
            comensales: [{ comensalId: 'c1', raciones: 1 }],
          },
        ],
      },
    ],
  },
  preguntasPendientes: [],
};

test('extrae el plan de un bloque ```json', () => {
  const reply = `Aquí tienes la semana:\n\`\`\`json\n${JSON.stringify(planObj)}\n\`\`\``;
  const parsed = parsePlanFromReply(reply);
  assert.equal(parsed.plan.dias.length, 1);
});

test('extrae el plan aunque venga con texto alrededor', () => {
  const reply = `Te propongo esto: ${JSON.stringify(planObj)} ¡Que aproveche!`;
  assert.ok(parsePlanFromReply(reply)?.plan);
});

test('ignora llaves dentro de textos de las recetas', () => {
  const conLlaves = {
    ...planObj,
    plan: {
      ...planObj.plan,
      dias: [
        {
          fecha: '2026-10-05',
          comidas: [
            {
              tipo: 'comida',
              receta: { nombre: 'Salsa {especial}', pasos: ['Mezclar {A} y {B}'] },
              comensales: [{ comensalId: 'c1', raciones: 1 }],
            },
          ],
        },
      ],
    },
  };
  const reply = '```json\n' + JSON.stringify(conLlaves) + '\n```';
  assert.equal(parsePlanFromReply(reply).plan.dias[0].comidas[0].receta.nombre, 'Salsa {especial}');
});

test('no confunde un JSON sin plan y devuelve null si no hay nada', () => {
  assert.equal(parsePlanFromReply('{"otra":"cosa"}'), null);
  assert.equal(parsePlanFromReply('solo texto, sin json'), null);
});

test('la fecha de hoy viaja en el prompt para resolver «esta semana»', () => {
  const lunes = new Date(2026, 9, 5); // 5 de octubre de 2026, lunes
  assert.equal(formatToday(lunes), '2026-10-05 (lunes)');
  const messages = buildMessages({ diners: [], userText: 'Planifica esta semana', today: lunes });
  assert.match(messages[0].content, /Hoy es 2026-10-05 \(lunes\)/);
});
