/**
 * Puerto de conversación con la IA. Cada proveedor es un adaptador.
 *
 * Implementaciones previstas:
 *  - OpenAiCompatibleAdapter (OpenAI, DeepSeek, Groq, OpenRouter, Ollama…)
 *  - AnthropicAdapter
 *  - GeminiAdapter
 *  - EchoAdapter (pruebas y uso sin red)
 */
export class AiPort {
  /**
   * @param {{role:string, content:string}[]} _messages
   * @param {{model?:string, temperature?:number, json?:boolean}} [_options]
   * @returns {Promise<string>} texto de la respuesta
   */
  async chat(_messages, _options) {
    throw new Error('AiPort.chat no implementado');
  }
}
