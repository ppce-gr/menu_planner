import { EchoAdapter } from './EchoAdapter.js';
import { OpenAiCompatibleAdapter } from './OpenAiCompatibleAdapter.js';
import { AnthropicAdapter } from './AnthropicAdapter.js';
import { GeminiAdapter } from './GeminiAdapter.js';

/**
 * Elige el adaptador de IA según la configuración del hogar. Añadir un
 * proveedor nuevo es añadir un `case` y su adaptador: ni el dominio ni los
 * casos de uso cambian.
 */
export function createAiFactory() {
  return async function aiFactory(config = {}) {
    switch (config.proveedor) {
      case 'openai':
      case 'openai-compatible':
        return new OpenAiCompatibleAdapter({ baseUrl: config.parametros?.baseUrl });
      case 'anthropic':
        return new AnthropicAdapter();
      case 'gemini':
      case 'google':
        return new GeminiAdapter();
      default:
        return new EchoAdapter();
    }
  };
}
