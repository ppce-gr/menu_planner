import { DomainError } from '../domain/errors.js';

/**
 * Ordena los modelos de **más básico a más potente** para probarlos en ese
 * orden y quedarnos con el primero que responda.
 */
const CAPABILITY = [
  { test: /(?:^|[-_.])(?:lite|8b|small|mini)(?:$|[-_.])/i, rank: 1 },
  { test: /(?:^|[-_.])(?:flash|turbo)(?:$|[-_.])/i, rank: 2 },
  { test: /(?:^|[-_.])(?:pro|ultra|opus|large)(?:$|[-_.])/i, rank: 3 },
];
const PENALTY = /(exp|preview|thinking|vision|embedding|aqa|image|tts|learnlm|gemma|audio|live)/i;

function rank(name) {
  for (const rule of CAPABILITY) if (rule.test.test(name)) return rule.rank;
  return 2;
}

export function rankModels(models = []) {
  return [...models].sort((a, b) => {
    const penalty = Number(PENALTY.test(a)) - Number(PENALTY.test(b));
    if (penalty !== 0) return penalty;
    const byRank = rank(a) - rank(b);
    if (byRank !== 0) return byRank;
    return a.localeCompare(b);
  });
}

/**
 * Diagnóstico de la IA: listar modelos y encontrar el más básico que responde.
 */
export class AiDiagnosticsService {
  constructor({ configService, aiFactory }) {
    this.configService = configService;
    this.aiFactory = aiFactory;
  }

  async listModels(hogarId) {
    const config = await this.configService.getFullAiConfig(hogarId);
    const ai = await this.aiFactory(config);
    if (typeof ai.listModels !== 'function') return [];
    return rankModels(await ai.listModels({ token: config.token, baseUrl: config.parametros?.baseUrl }));
  }

  /**
   * Prueba los modelos del más básico al más potente con un "hola" y devuelve
   * el primero que contesta. Si lo encuentra, lo guarda en la configuración.
   */
  async findWorkingModel(hogarId, { token, prompt = 'Hola, responde solo con "ok".' } = {}) {
    const config = await this.configService.getFullAiConfig(hogarId);
    const useToken = token || config.token;
    if (!useToken) throw new DomainError('SIN_TOKEN', 'Guarda primero el token del proveedor');

    const probe = { ...config, token: useToken };
    const ai = await this.aiFactory(probe);
    const models = rankModels(await ai.listModels({ token: useToken, baseUrl: config.parametros?.baseUrl }));

    const results = [];
    for (const model of models) {
      try {
        const reply = await ai.chat([{ role: 'user', content: prompt }], {
          model,
          token: useToken,
          temperature: 0,
        });
        if (String(reply ?? '').trim()) {
          results.push({ model, ok: true });
          await this.configService.saveAiConfig(hogarId, {
            modelo: model,
            activo: true,
            proveedor: config.proveedor,
          });
          return { modelo: model, results, respuesta: String(reply).slice(0, 300) };
        }
        results.push({ model, ok: false, error: 'respuesta vacía' });
      } catch (error) {
        results.push({ model, ok: false, error: error.message });
      }
    }
    return { modelo: null, results };
  }
}
