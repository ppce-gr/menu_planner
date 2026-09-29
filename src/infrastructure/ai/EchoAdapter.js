import { AiPort } from '../../domain/ports/AiPort.js';

/**
 * Adaptador de pruebas: no llama a ninguna red. Sirve para arrancar y para los
 * tests. Si le pides planificar, devuelve una semana de ejemplo construida con
 * los comensales que vienen en el prompt, para poder probar todo el flujo.
 */
export class EchoAdapter extends AiPort {
  async listModels() {
    return ['echo'];
  }

  async chat(messages) {
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

    if (/planific|plan semanal|men[uú] semanal|prepara la semana/i.test(lastUser)) {
      return demoPlan(system);
    }
    return (
      `[adaptador de pruebas] He recibido: "${lastUser}". ` +
      'Configura un proveedor de IA y su token en Ajustes para planificar de verdad.'
    );
  }
}

function extractDiners(system) {
  const match = system.match(/Comensales: (\[.*\])/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

function demoRecipe(nombre, ingredientes) {
  return {
    nombre,
    racionesBase: 4,
    tiempoMin: 30,
    utensilios: ['cocina'],
    etiquetas: ['de prueba'],
    ingredientes,
    pasos: ['Paso 1', 'Paso 2'],
  };
}

function demoPlan(system) {
  const diners = extractDiners(system);
  const start = nextMonday();
  const dias = [];
  for (let i = 0; i < 7; i += 1) {
    dias.push({
      fecha: addDays(start, i),
      comidas: [
        {
          tipo: 'comida',
          receta: demoRecipe('Lentejas estofadas', [
            { nombre: 'lentejas', cantidad: 300, unidad: 'g', opcional: false },
            { nombre: 'cebolla', cantidad: 1, unidad: 'ud', opcional: false },
          ]),
          comensales: diners.map((d) => ({ comensalId: d.id, raciones: 1 })),
          notas: '',
        },
        {
          tipo: 'cena',
          receta: demoRecipe('Tortilla de patatas', [
            { nombre: 'patata', cantidad: 500, unidad: 'g', opcional: false },
            { nombre: 'huevo', cantidad: 4, unidad: 'ud', opcional: false },
          ]),
          comensales: diners.map((d) => ({ comensalId: d.id, raciones: 1 })),
          notas: '',
        },
      ],
    });
  }
  const payload = {
    plan: { fechaInicio: start, fechaFin: addDays(start, 6), dias },
    listaCompraSugerida: [],
    preguntasPendientes: [],
  };
  return `Esta es una semana de ejemplo del adaptador de pruebas.\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\``;
}

function nextMonday() {
  const date = new Date();
  const day = date.getUTCDay();
  const delta = (8 - day) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
