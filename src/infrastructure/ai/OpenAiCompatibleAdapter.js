import { AiPort } from '../../domain/ports/AiPort.js';

/**
 * Adaptador para cualquier API compatible con OpenAI: OpenAI, DeepSeek, Groq,
 * OpenRouter, Together, y servidores locales (Ollama, LM Studio…).
 */
export class OpenAiCompatibleAdapter extends AiPort {
  constructor({ baseUrl = 'https://api.openai.com/v1' } = {}) {
    super();
    this.baseUrl = baseUrl;
  }

  async chat(messages, { model, temperature, token, baseUrl } = {}) {
    if (!token) throw new Error('falta el token del proveedor de IA');
    const url = `${(baseUrl || this.baseUrl).replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages,
        temperature: temperature ?? 0.7,
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`HTTP ${response.status} ${detail}`);
    }
    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }
}
