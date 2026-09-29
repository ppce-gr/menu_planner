import { AiPort } from '../../domain/ports/AiPort.js';

export class GeminiAdapter extends AiPort {
  async chat(messages, { model, temperature, token } = {}) {
    if (!token) throw new Error('falta el token del proveedor de IA');
    const modelId = model || 'gemini-1.5-flash';
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      }));

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}` +
      `:generateContent?key=${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: temperature ?? 0.7 },
      }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new Error(`HTTP ${response.status} ${detail}`);
    }
    const data = await response.json();
    return (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text).join('');
  }
}
