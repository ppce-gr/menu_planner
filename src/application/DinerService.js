import { newId } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';

function toList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[,;]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function toEdad(value) {
  if (value === '' || value === undefined || value === null) return null;
  const edad = Number(value);
  if (!Number.isFinite(edad) || edad < 0 || edad > 130) {
    throw new DomainError('EDAD_INVALIDA', 'La edad debe ser un número entre 0 y 130');
  }
  return Math.round(edad);
}

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
      edad: toEdad(data.edad),
      activo: data.activo !== false,
      dieta: String(data.dieta ?? '').trim(),
      alergias: toList(data.alergias),
      preferencias: toList(data.preferencias),
      comidasPorDefecto: toList(data.comidasPorDefecto),
    });
  }

  async update(id, data = {}) {
    const current = await this.diners.get(id);
    if (!current) throw new DomainError('COMENSAL_NO_ENCONTRADO', `No existe el comensal ${id}`);
    const merged = { ...current, id, hogarId: current.hogarId };

    if ('nombre' in data) {
      const nombre = String(data.nombre ?? '').trim();
      if (!nombre) throw new DomainError('COMENSAL_SIN_NOMBRE', 'El comensal necesita un nombre');
      merged.nombre = nombre;
    }
    if ('edad' in data) merged.edad = toEdad(data.edad);
    if ('dieta' in data) merged.dieta = String(data.dieta ?? '').trim();
    if ('alergias' in data) merged.alergias = toList(data.alergias);
    if ('preferencias' in data) merged.preferencias = toList(data.preferencias);
    if ('comidasPorDefecto' in data) merged.comidasPorDefecto = toList(data.comidasPorDefecto);
    if ('activo' in data) merged.activo = data.activo !== false;

    return this.diners.save(merged);
  }

  async remove(id) {
    return this.diners.remove(id);
  }
}
