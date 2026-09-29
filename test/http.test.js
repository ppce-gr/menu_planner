import { after, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildTestServer } from './helpers/buildServer.js';

const server = buildTestServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

after(() => server.close());

async function json(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

test('GET /api/health responde', async () => {
  const { status, data } = await json('/api/health');
  assert.equal(status, 200);
  assert.equal(data.ok, true);
});

test('la raíz sirve la interfaz', async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /menu_planner/);
});

test('el chat corta lo externo', async () => {
  const { status, data } = await json('/api/chat/messages', {
    method: 'POST',
    body: { text: '¿quién ganó el partido?' },
  });
  assert.equal(status, 200);
  assert.equal(data.offScope, true);
});

test('flujo por HTTP: comensal, plan, aplicar, verificar, cerrar y compra', async () => {
  const diner = await json('/api/diners', { method: 'POST', body: { nombre: 'Ana' } });
  assert.equal(diner.status, 200);

  const chat = await json('/api/chat/messages', {
    method: 'POST',
    body: { text: 'planifica la semana' },
  });
  assert.ok(chat.data.plan, 'el asistente debería devolver un plan');

  const created = await json('/api/plans', {
    method: 'POST',
    body: { fechaInicio: chat.data.plan.fechaInicio, fechaFin: chat.data.plan.fechaFin },
  });
  assert.equal(created.status, 200);

  const applied = await json(`/api/plans/${created.data.id}/apply`, {
    method: 'POST',
    body: { plan: chat.data.plan },
  });
  assert.equal(applied.status, 200);
  assert.equal(applied.data.estado, 'en_revision');

  for (const dia of applied.data.dias) {
    for (const comida of dia.comidas) {
      for (const asignacion of comida.comensales) {
        const verified = await json(`/api/plans/${created.data.id}/verify`, {
          method: 'POST',
          body: {
            mealId: comida.id,
            comensalId: asignacion.comensalId,
            verificado: true,
          },
        });
        assert.equal(verified.status, 200);
      }
    }
  }

  const closed = await json(`/api/plans/${created.data.id}/close`, {
    method: 'POST',
    body: { homeNames: [] },
  });
  assert.equal(closed.status, 200);
  assert.equal(closed.data.estado, 'cerrada');
  assert.ok(closed.data.listaCompra.length > 0);

  const item = closed.data.listaCompra[0];
  const comprado = await json(`/api/plans/${created.data.id}/shopping-items/${item.id}`, {
    method: 'PATCH',
    body: { estado: 'comprado' },
  });
  assert.equal(comprado.status, 200);
  assert.equal(comprado.data.listaCompra[0].estado, 'comprado');
});
