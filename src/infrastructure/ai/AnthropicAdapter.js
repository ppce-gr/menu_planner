import { AiPort } from '../../domain/ports/AiPort.js';

export class AnthropicAdapter extends AiPort {
  async chat(messages, { model, temperature, token } = {}) {
    if (!token) throw new Error('falta el token del proveedor de IA');
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': token,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-3-5-sonnet-latest',
        max_tokens: 4096,
        system,
        messages: conversation,
        temperature: temperature ?? 0.7,
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`HTTP ${response.status} ${detail}`);
    }
    const data = await response.json();
    return (data?.content ?? []).map((part) => part.text).join('');
  }
}
