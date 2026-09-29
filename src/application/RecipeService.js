import { newId } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';

export class RecipeService {
  constructor({ recipes }) {
    this.recipes = recipes;
  }

  list(hogarId) {
    return this.recipes.list(hogarId);
  }

  get(id) {
    return this.recipes.get(id);
  }

  async create(hogarId, data = {}) {
    const nombre = String(data.nombre ?? '').trim();
    if (!nombre) throw new DomainError('RECETA_SIN_NOMBRE', 'La receta necesita un nombre');
    return this.recipes.save({
      id: newId(),
      hogarId,
      nombre,
      descripcion: data.descripcion ?? '',
      racionesBase: Number(data.racionesBase) || 4,
      tiempoMin: Number(data.tiempoMin) || 0,
      utensilios: data.utensilios ?? [],
      etiquetas: data.etiquetas ?? [],
      ingredientes: data.ingredientes ?? [],
      pasos: data.pasos ?? [],
      origen: data.origen ?? 'manual',
      creadaEn: new Date().toISOString(),
    });
  }

  async update(id, data = {}) {
    const current = await this.recipes.get(id);
    if (!current) throw new DomainError('RECETA_NO_ENCONTRADA', `No existe la receta ${id}`);
    return this.recipes.save({ ...current, ...data, id, hogarId: current.hogarId });
  }

  async remove(id) {
    return this.recipes.remove(id);
  }
}
