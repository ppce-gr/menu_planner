import { after, test } from 'node:test';
import assert from 'node:assert/strict';

import { buildTestServer } from './helpers/buildServer.js';

const server = buildTestServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

after(() => server.close());

let cookie = '';

async function json(path, { method = 'GET', body, useCookie = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (useCookie && cookie) headers.cookie = cookie;
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.getSetCookie();
  if (setCookie.length > 0) {
    cookie = setCookie.map((value) => value.split(';')[0]).join('; ');
  }
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

test('GET /api/health responde sin sesión', async () => {
  const { status, data } = await json('/api/health');
  assert.equal(status, 200);
  assert.equal(data.ok, true);
});

test('la raíz sirve la interfaz', async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /menu_planner/);
});

test('sin sesión, al principio pide crear usuario', async () => {
  const { status, data } = await json('/api/auth/me');
  assert.equal(status, 401);
  assert.equal(data.necesitaSetup, true);
});

test('las rutas de datos están protegidas', async () => {
  const { status, data } = await json('/api/diners');
  assert.equal(status, 401);
  assert.equal(data.error, 'NO_AUTENTICADO');
});

test('el setup crea el usuario y abre sesión', async () => {
  const { status, data } = await json('/api/auth/setup', {
    method: 'POST',
    body: { nombre: 'Ana', password: 'secreta1' },
  });
  assert.equal(status, 200);
  assert.equal(data.usuario.nombre, 'Ana');

  const me = await json('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.usuario.nombre, 'Ana');
  assert.equal(me.data.usuario.rol, 'admin');
  assert.equal(me.data.usuario.hogarId, 'test');
  assert.equal(me.data.necesitaSetup, false);
});

test('con contraseña mala no se entra', async () => {
  const previous = cookie;
  cookie = '';
  const bad = await json('/api/auth/login', {
    method: 'POST',
    body: { nombre: 'Ana', password: 'mala' },
  });
  assert.equal(bad.status, 400);
  cookie = previous;
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

test('al salir, las rutas vuelven a estar protegidas', async () => {
  const { status } = await json('/api/auth/logout', { method: 'POST' });
  assert.equal(status, 200);
  const after = await json('/api/diners');
  assert.equal(after.status, 401);
});

test('una cuenta nueva se registra con su propio hogar', async () => {
  const previous = cookie;
  const registro = await json('/api/auth/register', {
    method: 'POST',
    body: { nombre: 'Luis', password: 'secreta2', hogarNombre: 'Casa de Luis' },
  });
  assert.equal(registro.status, 200);
  assert.equal(registro.data.usuario.rol, 'user');
  assert.notEqual(registro.data.usuario.hogarId, 'test');

  // Su hogar no ve los comensales del primero.
  const diners = await json('/api/diners');
  assert.deepEqual(diners.data, []);
  cookie = previous;
});
