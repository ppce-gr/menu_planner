/**
 * Adaptador de persistencia en memoria. Sirve para pruebas y para arrancar sin
 * base de datos. Cumple los mismos puertos que el adaptador de SQLite.
 */
export function createMemoryRepositories() {
  const diners = new Map();
  const recipes = new Map();
  const plans = new Map();
  const configs = new Map();
  const conversations = new Map();
  const messages = new Map();
  const users = new Map();
  const sessions = new Map();
  const hogares = new Map();

  return {
    diners: {
      async list(hogarId) {
        return [...diners.values()].filter((d) => !hogarId || d.hogarId === hogarId);
      },
      async get(id) {
        return diners.get(id) ?? null;
      },
      async save(diner) {
        diners.set(diner.id, diner);
        return diner;
      },
      async remove(id) {
        return diners.delete(id);
      },
    },
    recipes: {
      async list(hogarId) {
        return [...recipes.values()].filter((r) => !hogarId || r.hogarId === hogarId);
      },
      async get(id) {
        return recipes.get(id) ?? null;
      },
      async save(recipe) {
        recipes.set(recipe.id, recipe);
        return recipe;
      },
      async remove(id) {
        return recipes.delete(id);
      },
    },
    plans: {
      async list(hogarId) {
        return [...plans.values()].filter((p) => !hogarId || p.hogarId === hogarId);
      },
      async get(id) {
        return plans.get(id) ?? null;
      },
      async save(plan) {
        plans.set(plan.id, plan);
        return plan;
      },
    },
    config: {
      async getAiConfig(hogarId) {
        return configs.get(hogarId) ?? null;
      },
      async saveAiConfig(config) {
        configs.set(config.hogarId, config);
        return config;
      },
    },
    conversations: {
      async ensureConversation(conversation) {
        if (!conversations.has(conversation.id)) conversations.set(conversation.id, conversation);
        return conversations.get(conversation.id);
      },
      async listMessages(conversacionId) {
        return [...messages.values()]
          .filter((m) => m.conversacionId === conversacionId)
          .sort((a, b) => String(a.creadoEn).localeCompare(String(b.creadoEn)));
      },
      async saveMessage(message) {
        messages.set(message.id, message);
        return message;
      },
    },
    users: {
      async count() {
        return users.size;
      },
      async get(id) {
        return users.get(id) ?? null;
      },
      async findByName(nombre) {
        const target = String(nombre ?? '').trim().toLowerCase();
        return [...users.values()].find((u) => u.nombre.toLowerCase() === target) ?? null;
      },
      async save(usuario) {
        users.set(usuario.id, usuario);
        return usuario;
      },
    },
    sessions: {
      async save(session) {
        sessions.set(session.token, session);
        return session;
      },
      async get(token) {
        return sessions.get(token) ?? null;
      },
      async remove(token) {
        return sessions.delete(token);
      },
    },
    hogares: {
      async get(id) {
        return hogares.get(id) ?? null;
      },
      async save(hogar) {
        hogares.set(hogar.id, hogar);
        return hogar;
      },
    },
  };
}
