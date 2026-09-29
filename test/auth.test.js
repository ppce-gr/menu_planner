import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryRepositories } from '../src/infrastructure/persistence/MemoryRepositories.js';
import { createPasswordHasher } from '../src/infrastructure/crypto/PasswordHasher.js';
import { AuthService } from '../src/application/AuthService.js';

function build(options = {}) {
  const repositories = createMemoryRepositories();
  const auth = new AuthService({
    users: repositories.users,
    sessions: repositories.sessions,
    hogares: repositories.hogares,
    hasher: createPasswordHasher(),
    defaultHogarId: 'hogar-principal',
    ...options,
  });
  return { auth, repositories };
}

test('el primer arranque crea el admin y le da el hogar existente', async () => {
  const { auth, repositories } = build();
  assert.equal(await auth.needsSetup(), true);

  const { token, usuario } = await auth.setup({ nombre: 'Ana', password: 'secreta1' });
  assert.equal(usuario.nombre, 'Ana');
  assert.equal(usuario.rol, 'admin');
  assert.equal(usuario.hogarId, 'hogar-principal');
  assert.equal(await auth.needsSetup(), false);
  assert.equal((await auth.userForToken(token)).nombre, 'Ana');

  const hogar = await repositories.hogares.get('hogar-principal');
  assert.equal(hogar.nombre, 'Hogar de Ana');
  assert.equal(hogar.usuarioId, usuario.id);
});

test('login correcto e incorrecto', async () => {
  const { auth } = build();
  await auth.setup({ nombre: 'Ana', password: 'secreta1' });

  await assert.rejects(() => auth.login({ nombre: 'Ana', password: 'mala' }), /incorrectos/);
  await assert.rejects(() => auth.login({ nombre: 'Nadie', password: 'secreta1' }), /incorrectos/);

  const { token } = await auth.login({ nombre: 'Ana', password: 'secreta1' });
  assert.ok(token.length > 20);
});

test('la contraseña se guarda con hash, nunca en claro', async () => {
  const { auth, repositories } = build();
  const { usuario } = await auth.setup({ nombre: 'Ana', password: 'secreta1' });
  const stored = await repositories.users.get(usuario.id);
  assert.ok(stored.hash.startsWith('scrypt:'));
  assert.equal(stored.hash.includes('secreta1'), false);
});

test('logout invalida la sesión y el setup no se repite', async () => {
  const { auth } = build();
  const { token } = await auth.setup({ nombre: 'Ana', password: 'secreta1' });

  await assert.rejects(() => auth.setup({ nombre: 'Luis', password: 'secreta1' }), /Ya existe/);

  await auth.logout(token);
  assert.equal(await auth.userForToken(token), null);
});

test('el registro crea un usuario normal con su propio hogar', async () => {
  const { auth, repositories } = build();
  await auth.setup({ nombre: 'Ana', password: 'secreta1' });

  const { token, usuario } = await auth.signUp({
    nombre: 'Luis',
    password: 'secreta2',
    hogarNombre: 'Casa de Luis',
  });
  assert.equal(usuario.rol, 'user');
  assert.notEqual(usuario.hogarId, 'hogar-principal');
  assert.equal((await repositories.hogares.get(usuario.hogarId)).nombre, 'Casa de Luis');
  assert.equal((await auth.userForToken(token)).hogarId, usuario.hogarId);
});

test('el registro se puede cerrar y se puede exigir código', async () => {
  const cerrado = build({ allowRegistration: false });
  await cerrado.auth.setup({ nombre: 'Ana', password: 'secreta1' });
  await assert.rejects(
    () => cerrado.auth.signUp({ nombre: 'Luis', password: 'secreta2' }),
    /cerrado/,
  );

  const conCodigo = build({ registrationCode: 'AMIGOS' });
  await conCodigo.auth.setup({ nombre: 'Ana', password: 'secreta1' });
  await assert.rejects(
    () => conCodigo.auth.signUp({ nombre: 'Luis', password: 'secreta2', codigo: 'MALO' }),
    /código/i,
  );
  const { usuario } = await conCodigo.auth.signUp({
    nombre: 'Luis',
    password: 'secreta2',
    codigo: 'AMIGOS',
  });
  assert.equal(usuario.nombre, 'Luis');
});
