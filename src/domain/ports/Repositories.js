/**
 * Puertos de persistencia. El dominio no sabe si detrás hay SQLite, Postgres o
 * memoria: solo conoce estas interfaces. Cada motor implementa sus adaptadores.
 *
 * Los métodos son intencionadamente genéricos para no duplicar un fichero por
 * entidad; cada adaptador decide cómo materializarlos.
 */

export class DinerRepository {
  async list(_hogarId) { throw new Error('DinerRepository.list no implementado'); }
  async get(_id) { throw new Error('DinerRepository.get no implementado'); }
  async save(_diner) { throw new Error('DinerRepository.save no implementado'); }
  async remove(_id) { throw new Error('DinerRepository.remove no implementado'); }
}

export class RecipeRepository {
  async list(_hogarId) { throw new Error('RecipeRepository.list no implementado'); }
  async get(_id) { throw new Error('RecipeRepository.get no implementado'); }
  async save(_recipe) { throw new Error('RecipeRepository.save no implementado'); }
  async remove(_id) { throw new Error('RecipeRepository.remove no implementado'); }
}

export class PlanRepository {
  async list(_hogarId) { throw new Error('PlanRepository.list no implementado'); }
  async get(_id) { throw new Error('PlanRepository.get no implementado'); }
  async save(_plan) { throw new Error('PlanRepository.save no implementado'); }
}

export class ConfigRepository {
  async getAiConfig(_hogarId) { throw new Error('ConfigRepository.getAiConfig no implementado'); }
  async saveAiConfig(_config) { throw new Error('ConfigRepository.saveAiConfig no implementado'); }
}

export class ConversationRepository {
  async listMessages(_conversacionId) { throw new Error('ConversationRepository.listMessages no implementado'); }
  async saveMessage(_message) { throw new Error('ConversationRepository.saveMessage no implementado'); }
  async ensureConversation(_conversacion) { throw new Error('ConversationRepository.ensureConversation no implementado'); }
}

export class UserRepository {
  async count() { throw new Error('UserRepository.count no implementado'); }
  async get(_id) { throw new Error('UserRepository.get no implementado'); }
  async findByName(_nombre) { throw new Error('UserRepository.findByName no implementado'); }
  async save(_usuario) { throw new Error('UserRepository.save no implementado'); }
}

export class SessionRepository {
  async save(_session) { throw new Error('SessionRepository.save no implementado'); }
  async get(_token) { throw new Error('SessionRepository.get no implementado'); }
  async remove(_token) { throw new Error('SessionRepository.remove no implementado'); }
}
