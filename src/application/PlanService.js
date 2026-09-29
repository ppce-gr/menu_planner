import { newId } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';
import { shoppingEntriesFromPlan, validateAiPlan } from '../domain/PlanValidator.js';
import { consolidate, markAsAtHome } from '../domain/ShoppingList.js';

const SHOPPING_STATES = ['pendiente', 'comprado', 'enCasa', 'descartado'];

export class PlanService {
  constructor({ plans, recipes, diners }) {
    this.plans = plans;
    this.recipes = recipes;
    this.diners = diners;
  }

  list(hogarId) {
    return this.plans.list(hogarId);
  }

  async get(id) {
    const plan = await this.plans.get(id);
    if (!plan) throw new DomainError('PLAN_NO_ENCONTRADO', `No existe el plan ${id}`);
    return plan;
  }

  async create({ hogarId, fechaInicio, fechaFin, contexto = {} }) {
    if (!fechaInicio || !fechaFin) {
      throw new DomainError('PLAN_INVALIDO', 'El plan necesita fecha de inicio y de fin');
    }
    return this.plans.save({
      id: newId(),
      hogarId,
      fechaInicio,
      fechaFin,
      estado: 'borrador',
      contexto,
      dias: [],
      listaCompra: [],
      creadoEn: new Date().toISOString(),
    });
  }

  /** Vuelca el plan que ha devuelto la IA tras validarlo en el dominio. */
  async applyAiPlan(planId, aiPlan) {
    const plan = await this.get(planId);
    const diners = await this.diners.list(plan.hogarId);
    validateAiPlan(aiPlan, { dinerIds: diners.map((d) => d.id) });

    plan.fechaInicio = aiPlan.fechaInicio;
    plan.fechaFin = aiPlan.fechaFin;
    plan.dias = aiPlan.dias.map((dia) => ({
      fecha: dia.fecha,
      comidas: dia.comidas.map((comida) => ({
        id: newId(),
        tipo: comida.tipo,
        notas: comida.notas ?? '',
        receta: comida.receta,
        comensales: (comida.comensales ?? []).map((asignacion) => ({
          comensalId: asignacion.comensalId,
          raciones: Number(asignacion.raciones) || 1,
          verificado: false,
        })),
      })),
    }));
    plan.estado = 'en_revision';

    for (const dia of plan.dias) {
      for (const comida of dia.comidas) {
        await this.recipes.save({
          id: newId(),
          hogarId: plan.hogarId,
          ...comida.receta,
          origen: 'ia',
          creadaEn: new Date().toISOString(),
        });
      }
    }
    return this.plans.save(plan);
  }

  /** Marca (o desmarca) el check de un comensal en una comida. */
  async setVerified(planId, mealId, comensalId, verificado) {
    const plan = await this.get(planId);
    let encontrada = false;
    for (const dia of plan.dias) {
      for (const comida of dia.comidas) {
        if (comida.id !== mealId) continue;
        const asignacion = comida.comensales.find((c) => c.comensalId === comensalId);
        if (!asignacion) break;
        asignacion.verificado = Boolean(verificado);
        asignacion.verificadoEn = verificado ? new Date().toISOString() : null;
        encontrada = true;
      }
    }
    if (!encontrada) {
      throw new DomainError('ASIGNACION_NO_ENCONTRADA', 'No existe esa comida y comensal');
    }
    return this.plans.save(plan);
  }

  /** Cierra la semana: exige todos los checks y fija la compra consolidada. */
  async close(planId, { homeNames = [] } = {}) {
    const plan = await this.get(planId);
    const asignaciones = plan.dias.flatMap((d) => d.comidas.flatMap((c) => c.comensales));
    const pendientes = asignaciones.filter((a) => !a.verificado);
    if (pendientes.length > 0) {
      throw new DomainError(
        'PLAN_SIN_VERIFICAR',
        `Faltan ${pendientes.length} verificaciones (comensal y comida) antes de cerrar`,
      );
    }
    const entries = shoppingEntriesFromPlan(plan).filter((e) => !e.opcional);
    plan.listaCompra = markAsAtHome(consolidate(entries), homeNames).map((item) => ({
      id: newId(),
      ...item,
    }));
    plan.estado = 'cerrada';
    plan.cerradoEn = new Date().toISOString();
    return this.plans.save(plan);
  }

  async setShoppingItemState(planId, itemId, estado) {
    if (!SHOPPING_STATES.includes(estado)) {
      throw new DomainError('ESTADO_INVALIDO', `Estado de compra no válido: ${estado}`);
    }
    const plan = await this.get(planId);
    const item = plan.listaCompra.find((i) => i.id === itemId);
    if (!item) throw new DomainError('ITEM_NO_ENCONTRADO', 'No existe ese artículo de compra');
    item.estado = estado;
    return this.plans.save(plan);
  }
}
