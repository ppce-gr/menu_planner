import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createMemoryRepositories } from './infrastructure/persistence/MemoryRepositories.js';
import { createSecretBox } from './infrastructure/crypto/SecretBox.js';
import { createPasswordHasher } from './infrastructure/crypto/PasswordHasher.js';
import { createAiFactory } from './infrastructure/ai/AiAdapterFactory.js';
import { createServer } from './infrastructure/http/createServer.js';

import { DinerService } from './application/DinerService.js';
import { RecipeService } from './application/RecipeService.js';
import { ConfigService } from './application/ConfigService.js';
import { AssistantService } from './application/AssistantService.js';
import { PlanService } from './application/PlanService.js';
import { AuthService } from './application/AuthService.js';
import { AiDiagnosticsService } from './application/AiDiagnosticsService.js';

const here = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT ?? 3090);
const HOST = process.env.HOST ?? '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR ?? join(here, '..', 'data');
const HOGAR_ID = process.env.HOGAR_ID ?? 'hogar-principal';
const USE_MEMORY = process.env.PERSISTENCE === 'memory';

// SQLite se importa solo si hace falta: así el modo memoria no arrastra el
// aviso experimental de `node:sqlite`.
let repositories;
if (USE_MEMORY) {
  repositories = createMemoryRepositories();
} else {
  const { createSqliteRepositories } = await import(
    './infrastructure/persistence/sqlite/SqliteRepositories.js'
  );
  repositories = createSqliteRepositories({ file: join(DATA_DIR, 'menu-planner.db') });
}

const secretBox = createSecretBox({
  key: process.env.SECRET_KEY,
  keyFile: join(DATA_DIR, '.secret'),
});

const configService = new ConfigService({ config: repositories.config, secretBox });
const aiFactory = createAiFactory();

const services = {
  diners: new DinerService({ diners: repositories.diners }),
  recipes: new RecipeService({ recipes: repositories.recipes }),
  plans: new PlanService({
    plans: repositories.plans,
    recipes: repositories.recipes,
    diners: repositories.diners,
  }),
  config: configService,
  diagnostics: new AiDiagnosticsService({ configService, aiFactory }),
  auth: new AuthService({
    users: repositories.users,
    sessions: repositories.sessions,
    hasher: createPasswordHasher(),
  }),
  assistant: new AssistantService({
    conversations: repositories.conversations,
    diners: repositories.diners,
    recipes: repositories.recipes,
    configService,
    aiFactory,
  }),
};

const server = createServer({
  services,
  hogarId: HOGAR_ID,
  publicDir: join(here, '..', 'public'),
});

server.listen(PORT, HOST, () => {
  console.log(`menu_planner escuchando en http://${HOST}:${PORT}`);
  console.log(`persistencia: ${USE_MEMORY ? 'memoria' : join(DATA_DIR, 'menu-planner.db')}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      repositories.close?.();
      process.exit(0);
    });
  });
}
