import { DomainError } from '../domain/errors.js';
import { EMPTY_RULES, normalizeRules } from '../domain/HouseRules.js';

/**
 * Hogar y sus normas. Las normas son reglas permanentes que el asistente debe
 * respetar en toda planificación.
 */
export class HogarService {
  constructor({ hogares }) {
    this.hogares = hogares;
  }

  async get(hogarId) {
    const hogar = await this.hogares.get(hogarId);
    if (!hogar) throw new DomainError('HOGAR_NO_ENCONTRADO', 'No existe el hogar');
    return { ...hogar, reglas: normalizeRules(hogar.reglas ?? EMPTY_RULES) };
  }

  /** Normas del hogar, con valores por defecto si aún no hay ninguna. */
  async getRules(hogarId) {
    const hogar = await this.hogares.get(hogarId);
    return normalizeRules(hogar?.reglas ?? EMPTY_RULES);
  }

  async updateRules(hogarId, reglas = {}) {
    const hogar = await this.hogares.get(hogarId);
    if (!hogar) throw new DomainError('HOGAR_NO_ENCONTRADO', 'No existe el hogar');
    const updated = { ...hogar, reglas: normalizeRules(reglas) };
    await this.hogares.save(updated);
    return updated;
  }
}
