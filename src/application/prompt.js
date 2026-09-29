import { OUT_OF_SCOPE_REPLY } from '../domain/ScopeGuard.js';
import { PLANNING_POINTS } from '../domain/PlanningContext.js';

/**
 * Prompt del asistente. El texto vive en la capa de aplicación; el dominio solo
 * aporta las reglas (alcance y puntos de planificación).
 */
export const SYSTEM_PROMPT = `Eres el asistente de menús de una unidad familiar.

Tu cometido: recetas, ingredientes, menús, planificación semanal y nutrición de
esos alimentos.

Reglas:
- Responde en el idioma del usuario.
- Puedes responder sobre nutrición de alimentos (calorías, macronutrientes).
- No inventes datos del hogar (comensales, alergias, sobrantes): si te faltan,
  pregunta.
- Si te preguntan algo externo a tu cometido (deportes, noticias, el tiempo,
  política, bolsa…), responde exactamente con esta frase:
  "${OUT_OF_SCOPE_REPLY}"
- No des consejo médico; si procede, deriva a un profesional.

Antes de planificar necesitas este contexto: ${PLANNING_POINTS.map((p) => p.label).join(', ')}.
Si falta algo imprescindible, pregunta en lugar de inventar.

Cuando planifiques la semana, además del texto, devuelve un JSON con esta forma:

{"plan":{"fechaInicio":"AAAA-MM-DD","fechaFin":"AAAA-MM-DD","dias":[{"fecha":"AAAA-MM-DD","comidas":[{"tipo":"comida","receta":{"nombre":"","racionesBase":4,"tiempoMin":30,"utensilios":[],"etiquetas":[],"ingredientes":[{"nombre":"","cantidad":0,"unidad":"g","opcional":false}],"pasos":[]},"comensales":[{"comensalId":"","raciones":1}],"notas":""}]}]},"listaCompraSugerida":[],"preguntasPendientes":[]}`;

/**
 * Monta los mensajes que se envían al adaptador de IA.
 */
export function buildMessages({
  systemPrompt = SYSTEM_PROMPT,
  context = {},
  diners = [],
  recipes = [],
  history = [],
  userText,
} = {}) {
  const household = [
    `Comensales: ${JSON.stringify(diners.map((d) => ({ id: d.id, nombre: d.nombre, dieta: d.dieta, alergias: d.alergias })))}`,
    `Contexto de planificación: ${JSON.stringify(context)}`,
    `Recetas conocidas: ${JSON.stringify(recipes.map((r) => r.nombre))}`,
  ].join('\n');

  const previous = (history ?? []).map((m) => ({
    role: m.rol === 'usuario' ? 'user' : 'assistant',
    content: m.contenido,
  }));

  return [
    { role: 'system', content: `${systemPrompt}\n\n--- Datos del hogar ---\n${household}` },
    ...previous,
    { role: 'user', content: String(userText ?? '') },
  ];
}

/**
 * Extrae el bloque JSON del plan de una respuesta de la IA, si lo trae.
 * @returns {{plan:object, listaCompraSugerida:any[], preguntasPendientes:any[]}|null}
 */
export function parsePlanFromReply(reply) {
  const text = String(reply ?? '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed?.plan ? parsed : null;
  } catch {
    return null;
  }
}
