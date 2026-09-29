import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Adaptador de persistencia SQLite (motor nativo `node:sqlite`). Guarda cada
 * entidad como un documento JSON con sus columnas de búsqueda: así el modelo de
 * dominio no cambia si mañana se implementa otro motor.
 */
export function createSqliteRepositories({ file }) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);

  db.exec(`
    CREATE TABLE IF NOT EXISTS diners (
      id TEXT PRIMARY KEY, hogar_id TEXT NOT NULL, data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS diners_hogar ON diners(hogar_id);

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY, hogar_id TEXT NOT NULL, data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS recipes_hogar ON recipes(hogar_id);

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY, hogar_id TEXT NOT NULL, data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS plans_hogar ON plans(hogar_id);

    CREATE TABLE IF NOT EXISTS ai_config (
      hogar_id TEXT PRIMARY KEY, data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, hogar_id TEXT NOT NULL, data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL,
      creado_en TEXT NOT NULL, data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_conv ON messages(conversation_id, creado_en);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, nombre TEXT NOT NULL UNIQUE, data TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, usuario_id TEXT NOT NULL,
      expira_en TEXT NOT NULL, data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_usuario ON sessions(usuario_id);
  `);

  const stmt = {
    dinersList: db.prepare('SELECT data FROM diners WHERE hogar_id = ? ORDER BY rowid'),
    dinersGet: db.prepare('SELECT data FROM diners WHERE id = ?'),
    dinersSave: db.prepare(
      `INSERT INTO diners (id, hogar_id, data) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET hogar_id = excluded.hogar_id, data = excluded.data`,
    ),
    dinersRemove: db.prepare('DELETE FROM diners WHERE id = ?'),

    recipesList: db.prepare('SELECT data FROM recipes WHERE hogar_id = ? ORDER BY rowid'),
    recipesGet: db.prepare('SELECT data FROM recipes WHERE id = ?'),
    recipesSave: db.prepare(
      `INSERT INTO recipes (id, hogar_id, data) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET hogar_id = excluded.hogar_id, data = excluded.data`,
    ),
    recipesRemove: db.prepare('DELETE FROM recipes WHERE id = ?'),

    plansList: db.prepare('SELECT data FROM plans WHERE hogar_id = ? ORDER BY rowid'),
    plansGet: db.prepare('SELECT data FROM plans WHERE id = ?'),
    plansSave: db.prepare(
      `INSERT INTO plans (id, hogar_id, data) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET hogar_id = excluded.hogar_id, data = excluded.data`,
    ),

    configGet: db.prepare('SELECT data FROM ai_config WHERE hogar_id = ?'),
    configSave: db.prepare(
      `INSERT INTO ai_config (hogar_id, data) VALUES (?, ?)
       ON CONFLICT(hogar_id) DO UPDATE SET data = excluded.data`,
    ),

    convEnsure: db.prepare(
      `INSERT INTO conversations (id, hogar_id, data) VALUES (?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
    ),
    messagesList: db.prepare(
      'SELECT data FROM messages WHERE conversation_id = ? ORDER BY creado_en ASC, rowid ASC',
    ),
    messagesSave: db.prepare(
      `INSERT INTO messages (id, conversation_id, creado_en, data) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    ),

    usersCount: db.prepare('SELECT COUNT(*) AS total FROM users'),
    usersGet: db.prepare('SELECT data FROM users WHERE id = ?'),
    usersFindByName: db.prepare('SELECT data FROM users WHERE lower(nombre) = lower(?)'),
    usersSave: db.prepare(
      `INSERT INTO users (id, nombre, data) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, data = excluded.data`,
    ),

    sessionsSave: db.prepare(
      `INSERT INTO sessions (token, usuario_id, expira_en, data) VALUES (?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET expira_en = excluded.expira_en, data = excluded.data`,
    ),
    sessionsGet: db.prepare('SELECT data FROM sessions WHERE token = ?'),
    sessionsRemove: db.prepare('DELETE FROM sessions WHERE token = ?'),
  };

  const one = (row) => (row ? JSON.parse(row.data) : null);
  const many = (rows) => rows.map((row) => JSON.parse(row.data));

  return {
    diners: {
      async list(hogarId) {
        return many(stmt.dinersList.all(hogarId));
      },
      async get(id) {
        return one(stmt.dinersGet.get(id));
      },
      async save(diner) {
        stmt.dinersSave.run(diner.id, diner.hogarId, JSON.stringify(diner));
        return diner;
      },
      async remove(id) {
        stmt.dinersRemove.run(id);
        return true;
      },
    },
    recipes: {
      async list(hogarId) {
        return many(stmt.recipesList.all(hogarId));
      },
      async get(id) {
        return one(stmt.recipesGet.get(id));
      },
      async save(recipe) {
        stmt.recipesSave.run(recipe.id, recipe.hogarId, JSON.stringify(recipe));
        return recipe;
      },
      async remove(id) {
        stmt.recipesRemove.run(id);
        return true;
      },
    },
    plans: {
      async list(hogarId) {
        return many(stmt.plansList.all(hogarId));
      },
      async get(id) {
        return one(stmt.plansGet.get(id));
      },
      async save(plan) {
        stmt.plansSave.run(plan.id, plan.hogarId, JSON.stringify(plan));
        return plan;
      },
    },
    config: {
      async getAiConfig(hogarId) {
        return one(stmt.configGet.get(hogarId));
      },
      async saveAiConfig(config) {
        stmt.configSave.run(config.hogarId, JSON.stringify(config));
        return config;
      },
    },
    conversations: {
      async ensureConversation(conversation) {
        stmt.convEnsure.run(conversation.id, conversation.hogarId, JSON.stringify(conversation));
        return conversation;
      },
      async listMessages(conversacionId) {
        return many(stmt.messagesList.all(conversacionId));
      },
      async saveMessage(message) {
        stmt.messagesSave.run(
          message.id,
          message.conversacionId,
          message.creadoEn ?? new Date().toISOString(),
          JSON.stringify(message),
        );
        return message;
      },
    },
    users: {
      async count() {
        return stmt.usersCount.get().total;
      },
      async get(id) {
        return one(stmt.usersGet.get(id));
      },
      async findByName(nombre) {
        return one(stmt.usersFindByName.get(String(nombre ?? '').trim()));
      },
      async save(usuario) {
        stmt.usersSave.run(usuario.id, usuario.nombre, JSON.stringify(usuario));
        return usuario;
      },
    },
    sessions: {
      async save(session) {
        stmt.sessionsSave.run(
          session.token,
          session.usuarioId,
          session.expiraEn,
          JSON.stringify(session),
        );
        return session;
      },
      async get(token) {
        return one(stmt.sessionsGet.get(token));
      },
      async remove(token) {
        stmt.sessionsRemove.run(token);
        return true;
      },
    },
    close() {
      db.close();
    },
  };
}
