import { OUT_OF_SCOPE_REPLY } from '../domain/ScopeGuard.js';

/**
 * Prompt del asistente. El texto vive en la capa de aplicación; el dominio solo
 * aporta las reglas (alcance del asistente).
 */
export const SYSTEM_PROMPT = `Eres el asistente de menús de una unidad familiar.

Tu cometido: recetas, ingredientes, menús, planificación semanal y nutrición de
esos alimentos.

## Alcance
- Responde en el idioma del usuario.
- Puedes responder sobre nutrición de alimentos (calorías, macronutrientes).
- Si te preguntan algo externo a tu cometido (deportes, noticias, el tiempo,
  política, bolsa…), responde exactamente con esta frase:
  "${OUT_OF_SCOPE_REPLY}"
- No des consejo médico; si procede, deriva a un profesional.

## Cómo planificar
- **Contexto imprescindible**: la semana (fechas), los comensales y qué comidas
  hay que planificar. Con eso, planifica directamente.
- **Contexto útil** (dietas, alergias, cantidades, sobrantes, recetas a repetir o
  evitar, gustos, utensilios, objetivos): si no te lo dan, **asume algo
  razonable y sigue**; no lo preguntes.
- Asume **1 ración por comensal** salvo que se indique otra cosa.
- Respeta siempre dietas, alergias y alimentos que no gustan, **por comensal**.
- Aprovecha los **sobrantes perecederos** que te indiquen.
- Usa exactamente los \`comensalId\` que aparecen en «Datos del hogar».
- Incluye **todos los días** del rango pedido y, en cada día, las comidas que
  correspondan. No asignes una comida a quien no la hace.
- Solo pregunta si falta fecha, comensales o comidas; en ese caso, no devuelvas
  plan.

## Formato de salida
- Si planificas, termina con **un único bloque** \`\`\`json … \`\`\` y **nada
  después**, con esta forma:

{"plan":{"fechaInicio":"AAAA-MM-DD","fechaFin":"AAAA-MM-DD","dias":[{"fecha":"AAAA-MM-DD","comidas":[{"tipo":"comida","receta":{"nombre":"","racionesBase":4,"tiempoMin":30,"utensilios":[],"etiquetas":[],"ingredientes":[{"nombre":"","cantidad":0,"unidad":"g","opcional":false}],"pasos":[]},"comensales":[{"comensalId":"","raciones":1}],"notas":""}]}]},"listaCompraSugerida":[],"preguntasPendientes":[]}

- Las recetas deben ser realistas, con ingredientes y cantidades y pasos breves.
- Si usas algún supuesto (raciones, gustos…), resúmelo en \`notas\` del día o de
  la comida, no fuera del JSON.`;

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
    `Comensales: ${JSON.stringify(
      diners.map((d) => ({
        id: d.id,
        nombre: d.nombre,
        dieta: d.dieta,
        alergias: d.alergias,
        gustos: d.preferencias,
      })),
    )}`,
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
 * Extrae el bloque JSON del plan de una respuesta de la IA. Acepta bloques
 * ```json … ``` y, si no hay, busca el primer objeto con llaves equilibradas.
 */
export function parsePlanFromReply(reply) {
  const text = String(reply ?? '');
  const fenced = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  for (const candidate of [...fenced, extractBalanced(text)]) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate.trim());
      if (parsed?.plan) return parsed;
    } catch {
      /* probamos el siguiente candidato */
    }
  }
  return null;
}

/** Primer objeto `{…}` con llaves equilibradas (ignora llaves dentro de textos). */
function extractBalanced(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}
