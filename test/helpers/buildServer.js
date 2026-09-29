import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMemoryRepositories } from '../../src/infrastructure/persistence/MemoryRepositories.js';
import { createSecretBox } from '../../src/infrastructure/crypto/SecretBox.js';
import { createAiFactory } from '../../src/infrastructure/ai/AiAdapterFactory.js';
import { createServer } from '../../src/infrastructure/http/createServer.js';
import { DinerService } from '../../src/application/DinerService.js';
import { RecipeService } from '../../src/application/RecipeService.js';
import { PlanService } from '../../src/application/PlanService.js';
import { ConfigService } from '../../src/application/ConfigService.js';
import { AssistantService } from '../../src/application/AssistantService.js';

const here = dirname(fileURLToPath(import.meta.url));

export function buildTestServer({ hogarId = 'test' } = {}) {
  const repositories = createMemoryRepositories();
  const secretBox = createSecretBox({ key: 'clave-de-prueba', keyFile: '/tmp/no-se-usa' });
  const configService = new ConfigService({ config: repositories.config, secretBox });

  const services = {
    diners: new DinerService({ diners: repositories.diners }),
    recipes: new RecipeService({ recipes: repositories.recipes }),
    plans: new PlanService({
      plans: repositories.plans,
      recipes: repositories.recipes,
      diners: repositories.diners,
    }),
    config: configService,
    assistant: new AssistantService({
      conversations: repositories.conversations,
      diners: repositories.diners,
      recipes: repositories.recipes,
      configService,
      aiFactory: createAiFactory(),
    }),
  };

  return createServer({
    services,
    hogarId,
    publicDir: join(here, '..', '..', 'public'),
  });
}
