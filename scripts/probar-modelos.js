/**
 * Prueba los modelos del proveedor de IA del más básico al más potente con un
 * "hola" y guarda el primero que responda.
 *
 *   npm run probar-ia
 *   AI_PROVEEDOR=gemini AI_TOKEN=xxxx npm run probar-ia
 *
 * Sin `AI_TOKEN`, usa el token ya guardado en la configuración.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSqliteRepositories } from '../src/infrastructure/persistence/sqlite/SqliteRepositories.js';
import { createSecretBox } from '../src/infrastructure/crypto/SecretBox.js';
import { createAiFactory } from '../src/infrastructure/ai/AiAdapterFactory.js';
import { ConfigService } from '../src/application/ConfigService.js';
import { rankModels } from '../src/application/AiDiagnosticsService.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ?? join(here, '..', 'data');
const HOGAR_ID = process.env.HOGAR_ID ?? 'hogar-principal';

const repositories = createSqliteRepositories({ file: join(DATA_DIR, 'menu-planner.db') });
const secretBox = createSecretBox({
  key: process.env.SECRET_KEY,
  keyFile: join(DATA_DIR, '.secret'),
});
const configService = new ConfigService({ config: repositories.config, secretBox });

const stored = await configService.getFullAiConfig(HOGAR_ID);
const proveedor = process.env.AI_PROVEEDOR ?? stored.proveedor ?? 'gemini';
const token = process.env.AI_TOKEN ?? stored.token;

if (!token) {
  console.error('Falta el token: pásalo con AI_TOKEN=... o guárdalo en Ajustes.');
  process.exitCode = 1;
} else {
  const ai = await createAiFactory()({ proveedor, token, parametros: stored.parametros });
  console.log(`Proveedor: ${proveedor}`);

  const models = rankModels(
    await ai.listModels({ token, baseUrl: stored.parametros?.baseUrl }),
  );
  console.log(`Modelos con generateContent: ${models.length}`);
  console.log(models.join('\n'));
  console.log('--- probando del más básico al más potente ---');

  let elegido = null;
  for (const model of models) {
    try {
      const reply = await ai.chat([{ role: 'user', content: 'Hola, responde solo con "ok".' }], {
        model,
        token,
        temperature: 0,
      });
      const text = String(reply ?? '').trim();
      if (text) {
        console.log(`OK    ${model} -> ${text.slice(0, 80).replace(/\n/g, ' ')}`);
        elegido = model;
        break;
      }
      console.log(`VACÍO ${model}`);
    } catch (error) {
      console.log(`FALLA ${model} -> ${String(error.message).slice(0, 120)}`);
    }
  }

  if (elegido) {
    await configService.saveAiConfig(HOGAR_ID, { modelo: elegido, activo: true, proveedor });
    console.log(`\nModelo elegido y guardado: ${elegido}`);
  } else {
    console.log('\nNingún modelo ha respondido.');
    process.exitCode = 2;
  }
}

repositories.close?.();
