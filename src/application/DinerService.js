import { newId } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';

export class DinerService {
  constructor({ diners }) {
    this.diners = diners;
  }

  list(hogarId) {
    return this.diners.list(hogarId);
  }

  async create(hogarId, data = {}) {
    const nombre = String(data.nombre ?? '').trim();
    if (!nombre) throw new DomainError('COMENSAL_SIN_NOMBRE', 'El comensal necesita un nombre');
    return this.diners.save({
      id: newId(),
      hogarId,
      nombre,
      activo: data.activo !== false,
      dieta: data.dieta ?? '',
      alergias: data.alergias ?? [],
      preferencias: data.preferencias ?? [],
      comidasPorDefecto: data.comidasPorDefecto ?? [],
    });
  }

  async update(id, data = {}) {
    const current = await this.diners.get(id);
    if (!current) throw new DomainError('COMENSAL_NO_ENCONTRADO', `No existe el comensal ${id}`);
    return this.diners.save({ ...current, ...data, id, hogarId: current.hogarId });
  }

  async remove(id) {
    return this.diners.remove(id);
  }
}
