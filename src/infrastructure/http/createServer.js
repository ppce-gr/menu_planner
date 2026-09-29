import { createServer as createHttpServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { DomainError } from '../../domain/errors.js';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

function route(method, path, handler) {
  const names = [];
  const pattern = new RegExp(
    '^' +
      path.replace(/:([A-Za-z]+)/g, (_, name) => {
        names.push(name);
        return '([^/]+)';
      }) +
      '$',
  );
  return { method, pattern, names, handler };
}

function buildRoutes(services, hogarId) {
  return [
    route('GET', '/api/health', () => ({ ok: true, app: 'menu_planner' })),

    route('GET', '/api/diners', () => services.diners.list(hogarId)),
    route('POST', '/api/diners', ({ body }) => services.diners.create(hogarId, body)),
    route('PATCH', '/api/diners/:id', ({ params, body }) => services.diners.update(params.id, body)),
    route('DELETE', '/api/diners/:id', ({ params }) => services.diners.remove(params.id)),

    route('GET', '/api/recipes', () => services.recipes.list(hogarId)),
    route('POST', '/api/recipes', ({ body }) => services.recipes.create(hogarId, body)),
    route('GET', '/api/recipes/:id', ({ params }) => services.recipes.get(params.id)),
    route('PATCH', '/api/recipes/:id', ({ params, body }) => services.recipes.update(params.id, body)),
    route('DELETE', '/api/recipes/:id', ({ params }) => services.recipes.remove(params.id)),

    route('GET', '/api/plans', () => services.plans.list(hogarId)),
    route('POST', '/api/plans', ({ body }) => services.plans.create({ hogarId, ...body })),
    route('GET', '/api/plans/:id', ({ params }) => services.plans.get(params.id)),
    route('POST', '/api/plans/:id/apply', ({ params, body }) =>
      services.plans.applyAiPlan(params.id, body?.plan ?? body),
    ),
    route('POST', '/api/plans/:id/verify', ({ params, body }) =>
      services.plans.setVerified(params.id, body.mealId, body.comensalId, body.verificado),
    ),
    route('POST', '/api/plans/:id/close', ({ params, body }) =>
      services.plans.close(params.id, { homeNames: body?.homeNames ?? [] }),
    ),
    route('PATCH', '/api/plans/:id/shopping-items/:itemId', ({ params, body }) =>
      services.plans.setShoppingItemState(params.id, params.itemId, body.estado),
    ),

    route('GET', '/api/config/ai', () => services.config.getAiConfig(hogarId)),
    route('PUT', '/api/config/ai', ({ body }) => services.config.saveAiConfig(hogarId, body)),

    route('POST', '/api/chat/messages', ({ body }) =>
      services.assistant.chat({ hogarId, conversacionId: body.conversacionId, text: body.text }),
    ),
    route('GET', '/api/conversations/:id', ({ params }) => services.assistant.listMessages(params.id)),
  ];
}

export function createServer({ services, hogarId, publicDir }) {
  const routes = buildRoutes(services, hogarId);

  return createHttpServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
      if (url.pathname.startsWith('/api/')) {
        const body = await readJsonBody(req);
        const match = matchRoute(routes, req.method, url.pathname);
        if (!match) {
          sendJson(res, 404, { error: 'NO_ENCONTRADO', message: 'Ruta no encontrada' });
          return;
        }
        const params = Object.fromEntries(
          match.names.map((name, index) => [name, decodeURIComponent(match.values[index])]),
        );
        const result = await match.handler({ params, body, query: url.searchParams, req });
        sendJson(res, result?.status ?? 200, result?.body ?? result ?? {});
        return;
      }
      await serveStatic(res, publicDir, url.pathname);
    } catch (error) {
      if (error instanceof DomainError) {
        sendJson(res, 400, { error: error.code, message: error.message });
        return;
      }
      sendJson(res, 500, { error: 'ERROR_INTERNO', message: error.message });
    }
  });
}

function matchRoute(routes, method, pathname) {
  for (const candidate of routes) {
    if (candidate.method !== method) continue;
    const match = candidate.pattern.exec(pathname);
    if (match) return { ...candidate, values: match.slice(1) };
  }
  return null;
}

async function readJsonBody(req) {
  if (req.method === 'GET' || req.method === 'DELETE') return {};
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new DomainError('JSON_INVALIDO', 'El cuerpo de la petición no es JSON válido');
  }
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function serveStatic(res, publicDir, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '');
  try {
    const content = await readFile(join(publicDir, safe));
    res.writeHead(200, {
      'content-type': MIME[extname(safe)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  }
}
