import { test } from 'node:test';
import assert from 'node:assert/strict';

import { AiDiagnosticsService, rankModels } from '../src/application/AiDiagnosticsService.js';
import { createMemoryRepositories } from '../src/infrastructure/persistence/MemoryRepositories.js';
import { createSecretBox } from '../src/infrastructure/crypto/SecretBox.js';
import { createAiFactory } from '../src/infrastructure/ai/AiAdapterFactory.js';
import { ConfigService } from '../src/application/ConfigService.js';

test('los modelos se ordenan del más básico al más potente', () => {
  const orden = rankModels([
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
  ]);
  assert.deepEqual(orden, [
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ]);
});

test('los modelos experimentales van al final', () => {
  const orden = rankModels(['gemini-2.5-pro-preview', 'gemini-2.5-flash']);
  assert.deepEqual(orden, ['gemini-2.5-flash', 'gemini-2.5-pro-preview']);
});

test('findWorkingModel guarda el primer modelo que responde', async () => {
  const repositories = createMemoryRepositories();
  const secretBox = createSecretBox({ key: 'clave-de-prueba', keyFile: '/tmp/no-se-usa' });
  const configService = new ConfigService({ config: repositories.config, secretBox });
  const diagnostics = new AiDiagnosticsService({ configService, aiFactory: createAiFactory() });

  // El adaptador por defecto es `echo`, que responde siempre.
  const result = await diagnostics.findWorkingModel('h1', { token: 'de-prueba' });
  assert.equal(result.modelo, 'echo');

  const stored = await configService.getFullAiConfig('h1');
  assert.equal(stored.modelo, 'echo');
  assert.equal(stored.activo, true);
});

test('sin token, findWorkingModel avisa', async () => {
  const repositories = createMemoryRepositories();
  const secretBox = createSecretBox({ key: 'clave-de-prueba', keyFile: '/tmp/no-se-usa' });
  const configService = new ConfigService({ config: repositories.config, secretBox });
  const diagnostics = new AiDiagnosticsService({ configService, aiFactory: createAiFactory() });

  await assert.rejects(() => diagnostics.findWorkingModel('h1'), /token/i);
});
