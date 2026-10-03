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
npm start          # servidor en http://localhost:3090
npm test           # pruebas con node:test
```

Variables de entorno:

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `3090` | Puerto HTTP |
| `HOST` | `0.0.0.0` | Interfaz de escucha (todas, para entrar desde la red) |
| `DATA_DIR` | `./data` | Carpeta de la base de datos SQLite |
| `SECRET_KEY` | (generada en `data/.secret`) | Cifrado del token de IA |
| `ALLOW_REGISTRATION` | `true` | `false` cierra el registro de cuentas nuevas |
| `REGISTRATION_CODE` | (vacío) | Si se define, el registro exige ese código |
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
deploy/            servicio systemd
docs/              documentación
```

## Despliegue

Ver [`docs/despliegue.md`](docs/despliegue.md):

- **Raspberry + systemd** con **Tailscale** (privado) o **Funnel** para una URL
  HTTPS gratuita.
- **Docker** para cualquier hosting de contenedores (con un volumen persistente
  para `DATA_DIR`). Netlify por sí solo no puede: es un servidor Node con
  SQLite, no un sitio estático.

## Estado

MVP en construcción. Consulta las notas de la idea en `conceptual/` del
proyecto (índice: `_indice.md`).
