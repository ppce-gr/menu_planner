import { newId } from '../domain/ids.js';
import { scopeGuard } from '../domain/ScopeGuard.js';
import { buildMessages, parsePlanFromReply } from './prompt.js';

/**
 * Conversación con el asistente. Aplica la primera capa del alcance (el dominio
 * corta lo externo) antes de molestar al modelo.
 */
export class AssistantService {
  constructor({ conversations, diners, recipes, configService, aiFactory, hogarService }) {
    this.conversations = conversations;
    this.diners = diners;
    this.recipes = recipes;
    this.configService = configService;
    this.aiFactory = aiFactory;
    this.hogarService = hogarService;
  }

  async chat({ hogarId, conversacionId, text }) {
    const contenido = String(text ?? '').trim();
    if (!contenido) {
      return { conversacionId: conversacionId ?? null, reply: '', error: true };
    }
    const convId = conversacionId || newId();
    await this.conversations.ensureConversation({
      id: convId,
      hogarId,
      creadoEn: new Date().toISOString(),
    });

    const userMessage = await this.conversations.saveMessage({
      id: newId(),
      conversacionId: convId,
      rol: 'usuario',
      contenido,
      creadoEn: new Date().toISOString(),
    });

    const rejection = scopeGuard(contenido);
    if (rejection) {
      await this.conversations.saveMessage({
        id: newId(),
        conversacionId: convId,
        rol: 'asistente',
        contenido: rejection,
        metadata: { offScope: true },
        creadoEn: new Date().toISOString(),
      });
      return { conversacionId: convId, reply: rejection, offScope: true, plan: null };
    }

    const config = await this.configService.getFullAiConfig(hogarId);
    const diners = await this.diners.list(hogarId);
    const recipes = await this.recipes.list(hogarId);
    const history = await this.conversations.listMessages(convId);
    const rules = this.hogarService ? await this.hogarService.getRules(hogarId) : {};
    const messages = buildMessages({
      diners,
      recipes,
      rules,
      history: history.filter((m) => m.id !== userMessage.id && m.rol !== 'herramienta'),
      userText: contenido,
    });

    let reply;
    try {
      const ai = await this.aiFactory(config);
      reply = await ai.chat(messages, {
        model: config.modelo,
        temperature: config.parametros?.temperatura,
        baseUrl: config.parametros?.baseUrl,
        token: config.token,
      });
    } catch (error) {
      reply = `No he podido contactar con la IA (${error.message}). Revisa la configuración y el token.`;
      await this.conversations.saveMessage({
        id: newId(),
        conversacionId: convId,
        rol: 'asistente',
        contenido: reply,
        metadata: { error: true },
        creadoEn: new Date().toISOString(),
      });
      return { conversacionId: convId, reply, error: true, plan: null };
    }

    await this.conversations.saveMessage({
      id: newId(),
      conversacionId: convId,
      rol: 'asistente',
      contenido: reply,
      metadata: { modelo: config.modelo },
      creadoEn: new Date().toISOString(),
    });

    const parsed = parsePlanFromReply(reply);
    return {
      conversacionId: convId,
      reply,
      offScope: false,
      plan: parsed?.plan ?? null,
      listaCompraSugerida: parsed?.listaCompraSugerida ?? [],
      preguntasPendientes: parsed?.preguntasPendientes ?? [],
    };
  }

  listMessages(conversacionId) {
    return this.conversations.listMessages(conversacionId);
  }
}
