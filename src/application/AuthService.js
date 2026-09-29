import { newId } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';

const SESSION_MS = 1000 * 60 * 60 * 24 * 30; // 30 días

const publicUser = (usuario) => ({
  id: usuario.id,
  nombre: usuario.nombre,
  creadoEn: usuario.creadoEn,
});

/**
 * Autenticación: un usuario ahora, preparada para varios. La contraseña se
 * guarda con hash y la sesión es un token opaco con caducidad.
 */
export class AuthService {
  constructor({ users, sessions, hasher }) {
    this.users = users;
    this.sessions = sessions;
    this.hasher = hasher;
  }

  async needsSetup() {
    return (await this.users.count()) === 0;
  }

  /** Crea el primer usuario (solo si no hay ninguno) y lo deja con sesión. */
  async setup({ nombre, password }) {
    if (!(await this.needsSetup())) {
      throw new DomainError('YA_CONFIGURADO', 'Ya existe un usuario; inicia sesión');
    }
    await this.register({ nombre, password });
    return this.login({ nombre, password });
  }

  async register({ nombre, password }) {
    const clean = String(nombre ?? '').trim();
    if (!clean) throw new DomainError('USUARIO_SIN_NOMBRE', 'El usuario necesita un nombre');
    if (String(password ?? '').length < 6) {
      throw new DomainError('CLAVE_CORTA', 'La contraseña debe tener al menos 6 caracteres');
    }
    if (await this.users.findByName(clean)) {
      throw new DomainError('USUARIO_EXISTE', 'Ya existe un usuario con ese nombre');
    }
    const usuario = {
      id: newId(),
      nombre: clean,
      hash: this.hasher.hash(password),
      creadoEn: new Date().toISOString(),
    };
    await this.users.save(usuario);
    return publicUser(usuario);
  }

  async login({ nombre, password }) {
    const usuario = await this.users.findByName(String(nombre ?? '').trim());
    if (!usuario || !this.hasher.verify(password, usuario.hash)) {
      throw new DomainError('CREDENCIALES', 'Usuario o contraseña incorrectos');
    }
    const token = this.hasher.newToken();
    await this.sessions.save({
      token,
      usuarioId: usuario.id,
      creadoEn: new Date().toISOString(),
      expiraEn: new Date(Date.now() + SESSION_MS).toISOString(),
    });
    return { token, usuario: publicUser(usuario) };
  }

  async logout(token) {
    if (token) await this.sessions.remove(token);
  }

  async userForToken(token) {
    if (!token) return null;
    const session = await this.sessions.get(token);
    if (!session) return null;
    if (new Date(session.expiraEn).getTime() < Date.now()) {
      await this.sessions.remove(token);
      return null;
    }
    const usuario = await this.users.get(session.usuarioId);
    return usuario ? publicUser(usuario) : null;
  }
}
