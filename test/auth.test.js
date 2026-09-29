import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryRepositories } from '../src/infrastructure/persistence/MemoryRepositories.js';
import { createPasswordHasher } from '../src/infrastructure/crypto/PasswordHasher.js';
import { AuthService } from '../src/application/AuthService.js';

function setup() {
  const repositories = createMemoryRepositories();
  return new AuthService({
    users: repositories.users,
    sessions: repositories.sessions,
    hasher: createPasswordHasher(),
  });
}

test('el primer arranque pide crear usuario y deja sesión', async () => {
  const auth = setup();
  assert.equal(await auth.needsSetup(), true);

  const { token, usuario } = await auth.setup({ nombre: 'Ana', password: 'secreta1' });
  assert.equal(usuario.nombre, 'Ana');
  assert.equal(await auth.needsSetup(), false);
  assert.equal((await auth.userForToken(token)).nombre, 'Ana');
});

test('login correcto e incorrecto', async () => {
  const auth = setup();
  await auth.setup({ nombre: 'Ana', password: 'secreta1' });

  await assert.rejects(() => auth.login({ nombre: 'Ana', password: 'mala' }), /incorrectos/);
  await assert.rejects(() => auth.login({ nombre: 'Nadie', password: 'secreta1' }), /incorrectos/);

  const { token } = await auth.login({ nombre: 'Ana', password: 'secreta1' });
  assert.ok(token.length > 20);
});

test('la contraseña se guarda con hash, nunca en claro', async () => {
  const repositories = createMemoryRepositories();
  const auth = new AuthService({
    users: repositories.users,
    sessions: repositories.sessions,
    hasher: createPasswordHasher(),
  });

  const { usuario } = await auth.setup({ nombre: 'Ana', password: 'secreta1' });
  const stored = await repositories.users.get(usuario.id);
  assert.ok(stored.hash.startsWith('scrypt:'));
  assert.equal(stored.hash.includes('secreta1'), false);
});

test('logout invalida la sesión y no se repite el setup', async () => {
  const auth = setup();
  const { token } = await auth.setup({ nombre: 'Ana', password: 'secreta1' });

  await assert.rejects(() => auth.setup({ nombre: 'Luis', password: 'secreta1' }), /Ya existe/);

  await auth.logout(token);
  assert.equal(await auth.userForToken(token), null);
});
