import { test } from 'node:test';
import assert from 'node:assert/strict';

import { OUT_OF_SCOPE_REPLY, looksLikeRefusal } from '../src/domain/ScopeGuard.js';
import { AssistantService } from '../src/application/AssistantService.js';
import { ConfigService } from '../src/application/ConfigService.js';
import { createMemoryRepositories } from '../src/infrastructure/persistence/MemoryRepositories.js';
import { createSecretBox } from '../src/infrastructure/crypto/SecretBox.js';

function build(fakeChat) {
  const repositories = createMemoryRepositories();
  const configService = new ConfigService({
    config: repositories.config,
    secretBox: createSecretBox({ key: 'clave', keyFile: '/tmp/no-se-usa' }),
  });
  const assistant = new AssistantService({
    conversations: repositories.conversations,
    diners: repositories.diners,
    recipes: repositories.recipes,
    configService,
    aiFactory: async () => ({ chat: fakeChat }),
  });
  return { assistant, repositories };
}

test('looksLikeRefusal reconoce la frase de rechazo', () => {
  assert.equal(looksLikeRefusal(OUT_OF_SCOPE_REPLY), true);
  assert.equal(looksLikeRefusal('No trabajo con cosas externas a mi cometido'), true);
  assert.equal(looksLikeRefusal('Aquí tienes el menú de la semana'), false);
});

test('si el modelo rechaza algo de su cometido, se le da otra oportunidad', async () => {
  let calls = 0;
  const { assistant } = build(async () => {
    calls += 1;
    return calls === 1 ? OUT_OF_SCOPE_REPLY : 'Claro: te propongo un menú rico en proteína.';
  });

  const response = await assistant.chat({
    hogarId: 'h1',
    text: 'Planifica los menús de esta semana, ricos en proteína y bajos en hidratos.',
  });
  assert.equal(calls, 2);
  assert.equal(response.offScope, false);
  assert.match(response.reply, /proteína/);
});

test('un tema externo lo corta el dominio sin llamar al modelo', async () => {
  let calls = 0;
  const { assistant } = build(async () => {
    calls += 1;
    return 'no debería llamarse';
  });

  const response = await assistant.chat({ hogarId: 'h1', text: '¿A qué hora juega el Madrid?' });
  assert.equal(calls, 0);
  assert.equal(response.offScope, true);
});

test('si el plan sale incompleto, se pide otra vez', async () => {
  let calls = 0;
  const incompleto = '```json\n{"plan":{"fechaInicio":"2026-10-05","dias":[';
  const completo =
    '```json\n{"plan":{"fechaInicio":"2026-10-05","fechaFin":"2026-10-11","dias":[]},"preguntasPendientes":[]}\n```';
  const { assistant } = build(async () => {
    calls += 1;
    return calls === 1 ? incompleto : completo;
  });

  const response = await assistant.chat({ hogarId: 'h1', text: 'Planifica la semana del 5 de octubre' });
  assert.equal(calls, 2);
  assert.equal(response.plan?.fechaInicio, '2026-10-05');
});
