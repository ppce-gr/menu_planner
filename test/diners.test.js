import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DinerService } from '../src/application/DinerService.js';
import { createMemoryRepositories } from '../src/infrastructure/persistence/MemoryRepositories.js';
import { buildMessages } from '../src/application/prompt.js';

function build() {
  const repositories = createMemoryRepositories();
  return { diners: new DinerService({ diners: repositories.diners }), repositories };
}

test('crea un comensal con edad, dieta, alergias y comidas', async () => {
  const { diners } = build();
  const ana = await diners.create('h1', {
    nombre: 'Ana',
    edad: '42',
    dieta: 'vegana, baja en calorías',
    alergias: 'frutos secos, gluten',
    comidasPorDefecto: ['comida', 'cena'],
  });
  assert.equal(ana.edad, 42);
  assert.equal(ana.dieta, 'vegana, baja en calorías');
  assert.deepEqual(ana.alergias, ['frutos secos', 'gluten']);
  assert.deepEqual(ana.comidasPorDefecto, ['comida', 'cena']);
});

test('la edad se valida y puede quedar vacía', async () => {
  const { diners } = build();
  await assert.rejects(() => diners.create('h1', { nombre: 'Ana', edad: 'abc' }), /edad/i);
  await assert.rejects(() => diners.create('h1', { nombre: 'Ana', edad: 200 }), /edad/i);
  const sinEdad = await diners.create('h1', { nombre: 'Luis' });
  assert.equal(sinEdad.edad, null);
});

test('edita y borra un comensal', async () => {
  const { diners } = build();
  const ana = await diners.create('h1', { nombre: 'Ana', edad: 42 });

  const editada = await diners.update(ana.id, {
    nombre: 'Ana María',
    edad: 43,
    dieta: 'sin gluten',
  });
  assert.equal(editada.nombre, 'Ana María');
  assert.equal(editada.edad, 43);
  assert.equal(editada.dieta, 'sin gluten');
  assert.equal(editada.id, ana.id);

  await diners.remove(ana.id);
  assert.deepEqual(await diners.list('h1'), []);

  await assert.rejects(() => diners.update('no-existe', { nombre: 'X' }), /no existe/i);
});

test('la edad y las comidas viajan en el prompt', () => {
  const messages = buildMessages({
    diners: [
      { id: 'c1', nombre: 'Ana', edad: 42, dieta: 'vegana', comidasPorDefecto: ['comida'] },
    ],
    userText: 'Planifica',
  });
  const system = messages[0].content;
  assert.match(system, /"edad":42/);
  assert.match(system, /"comidas":\["comida"\]/);
});
