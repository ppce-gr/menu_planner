# menu_planner

Planificador familiar de menús semanales, recetas y lista de la compra, con un
asistente de IA que conversa contigo para planificar la semana.

- **Arquitectura hexagonal**: el dominio no conoce ni Node, ni HTTP, ni la base
  de datos. Cada IA y cada motor de base de datos son adaptadores
  intercambiables.
- **Cero dependencias de runtime**: `npm start` funciona sin `npm install`.
- Pensado para la Raspberry Pi, pero portable a cualquier servidor.

## Arranque

```bash
npm start          # servidor en http://localhost:3080
npm test           # pruebas con node:test
```

Variables de entorno:

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `3080` | Puerto HTTP |
| `DATA_DIR` | `./data` | Carpeta de la base de datos SQLite |
| `SECRET_KEY` | (generada en `data/.secret`) | Cifrado del token de IA |
| `AI_ADAPTER` | `echo` | `echo` para probar sin red, `openai` para IA real |

## Estructura

```text
src/
  domain/          entidades, reglas y puertos
  application/     casos de uso
  infrastructure/  HTTP, persistencia y adaptadores de IA
  index.js         cableado
public/            interfaz (HTML/CSS/JS, PWA)
test/              pruebas
```

## Estado

MVP en construcción. Consulta las notas de la idea en `conceptual/` del
proyecto (índice: `_indice.md`).
