/**
 * Puntos de contexto que el asistente debe tener antes de planificar.
 * Los que son obligatorios se preguntan; los opcionales pueden quedar vacíos.
 */
export const PLANNING_POINTS = [
  { key: 'semana', label: 'Semana a planificar', required: true },
  { key: 'comensales', label: 'Comensales y cuántos comen', required: true },
  { key: 'comidas', label: 'Qué comidas se planifican', required: true },
  { key: 'dietas', label: 'Dieta, alergias y preferencias', required: true },
  { key: 'cantidades', label: 'Cantidades por comensal', required: true },
  { key: 'sobrantes', label: 'Sobrantes perecederos', required: false },
  { key: 'recetas', label: 'Recetas a repetir o evitar', required: false },
  { key: 'gustos', label: 'Gustos y utensilios (Thermomix…)', required: false },
  { key: 'objetivos', label: 'Objetivos (calorías, presupuesto…)', required: false },
];

function isEmpty(value) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function missingPoints(context = {}) {
  return PLANNING_POINTS.filter((p) => isEmpty(context[p.key]));
}

export function missingRequiredPoints(context = {}) {
  return missingPoints(context).filter((p) => p.required);
}

export function isPlanningReady(context = {}) {
  return missingRequiredPoints(context).length === 0;
}
