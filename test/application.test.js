import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryRepositories } from '../src/infrastructure/persistence/MemoryRepositories.js';
import { createSecretBox } from '../src/infrastructure/crypto/SecretBox.js';
import { createAiFactory } from '../src/infrastructure/ai/AiAdapterFactory.js';
import { DinerService } from '../src/application/DinerService.js';
import { PlanService } from '../src/application/PlanService.js';
import { RecipeService } from '../src/application/RecipeService.js';
import { ConfigService } from '../src/application/ConfigService.js';
import { AssistantService } from '../src/application/AssistantService.js';

function setup() {
  const repos = createMemoryRepositories();
  const secretBox = createSecretBox({ key: 'clave-de-prueba', keyFile: '/tmp/no-se-usa' });
  const configService = new ConfigService({ config: repos.config, secretBox });
  return {
    repos,
    configService,
    diners: new DinerService({ diners: repos.diners }),
    recipes: new RecipeService({ recipes: repos.recipes }),
    plans: new PlanService({ plans: repos.plans, recipes: repos.recipes, diners: repos.diners }),
    assistant: new AssistantService({
      conversations: repos.conversations,
      diners: repos.diners,
      recipes: repos.recipes,
      configService,
      aiFactory: createAiFactory(),
    }),
  };
}

const aiPlan = (comensalId) => ({
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
            tiempoMin: 40,
            ingredientes: [{ nombre: 'lentejas', cantidad: 200, unidad: 'g' }],
            pasos: ['Sofríe', 'Cuece'],
          },
          comensales: [{ comensalId, raciones: 2 }],
        },
      ],
    },
  ],
});

test('flujo completo: crear semana, aplicar plan, verificar y cerrar', async () => {
  const { diners, plans } = setup();
  const ana = await diners.create('h1', { nombre: 'Ana' });
  const plan = await plans.create({
    hogarId: 'h1',
    fechaInicio: '2025-01-06',
    fechaFin: '2025-01-12',
  });
  assert.equal(plan.estado, 'borrador');

  const applied = await plans.applyAiPlan(plan.id, aiPlan(ana.id));
  assert.equal(applied.estado, 'en_revision');
  assert.equal(applied.dias[0].comidas[0].comensales[0].verificado, false);

  const comida = applied.dias[0].comidas[0];
  await assert.rejects(() => plans.close(plan.id), /verificaciones/);

  await plans.setVerified(plan.id, comida.id, ana.id, true);
  const closed = await plans.close(plan.id, { homeNames: ['lentejas'] });
  assert.equal(closed.estado, 'cerrada');
  assert.equal(closed.listaCompra.length, 1);
  assert.equal(closed.listaCompra[0].estado, 'enCasa');

  const item = closed.listaCompra[0];
  const updated = await plans.setShoppingItemState(plan.id, item.id, 'comprado');
  assert.equal(updated.listaCompra[0].estado, 'comprado');
});

test('el token de IA se guarda cifrado y no se devuelve', async () => {
  const { configService, repos } = setup();
  const saved = await configService.saveAiConfig('h1', {
    proveedor: 'openai',
    modelo: 'gpt-4o-mini',
    token: 'sk-secreto',
    activo: true,
  });
  assert.equal(saved.tieneToken, true);
  assert.equal(saved.token, undefined);
  assert.equal(saved.tokenCifrado, undefined);

  const stored = await repos.config.getAiConfig('h1');
  assert.ok(stored.tokenCifrado.startsWith('v1:'));
  assert.equal(stored.tokenCifrado.includes('sk-secreto'), false);

  const full = await configService.getFullAiConfig('h1');
  assert.equal(full.token, 'sk-secreto');
});

test('el asistente rechaza lo externo sin llamar al modelo', async () => {
  const { assistant, diners } = setup();
  await diners.create('h1', { nombre: 'Ana' });
  const response = await assistant.chat({ hogarId: 'h1', text: '¿A qué hora juega el Madrid?' });
  assert.equal(response.offScope, true);
  assert.match(response.reply, /no trabajo con cosas externas/i);
});

test('el adaptador de pruebas devuelve un plan aplicable', async () => {
  const { assistant, diners, plans } = setup();
  await diners.create('h1', { nombre: 'Ana' });
  const response = await assistant.chat({
    hogarId: 'h1',
    text: 'Planifica la semana por favor',
  });
  assert.ok(response.plan, 'debería traer un plan');
  const plan = await plans.create({
    hogarId: 'h1',
    fechaInicio: response.plan.fechaInicio,
    fechaFin: response.plan.fechaFin,
  });
  const applied = await plans.applyAiPlan(plan.id, response.plan);
  assert.equal(applied.estado, 'en_revision');
  assert.equal(applied.dias.length, 7);
});
