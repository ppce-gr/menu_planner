import { newId } from '../domain/ids.js';
import { DomainError } from '../domain/errors.js';

const SESSION_MS = 1000 * 60 * 60 * 24 * 30; // 30 días

const publicUser = (usuario) => ({
  id: usuario.id,
  nombre: usuario.nombre,
  rol: usuario.rol ?? 'user',
  hogarId: usuario.hogarId ?? null,
  creadoEn: usuario.creadoEn,
});

/**
 * Cuentas: registro, login, sesión y logout. Cada usuario tiene **su propio
 * hogar** (los menús de uno no se mezclan con los de otro). El primer usuario
 * es `admin` y adopta el hogar que ya existiera, para no perder configuración.
 */
export class AuthService {
  constructor({
    users,
    sessions,
    hogares,
    hasher,
    defaultHogarId = 'hogar-principal',
    allowRegistration = true,
    registrationCode = '',
  }) {
    this.users = users;
    this.sessions = sessions;
    this.hogares = hogares;
    this.hasher = hasher;
    this.defaultHogarId = defaultHogarId;
    this.allowRegistration = allowRegistration;
    this.registrationCode = registrationCode;
  }

  async needsSetup() {
    return (await this.users.count()) === 0;
  }

  canRegister() {
    return this.allowRegistration;
  }

  requiresCode() {
    return Boolean(this.registrationCode);
  }

  async register({ nombre, password, hogarNombre, codigo } = {}) {
    const clean = String(nombre ?? '').trim();
    if (!clean) throw new DomainError('USUARIO_SIN_NOMBRE', 'El usuario necesita un nombre');
    if (String(password ?? '').length < 6) {
      throw new DomainError('CLAVE_CORTA', 'La contraseña debe tener al menos 6 caracteres');
    }
    if (await this.users.findByName(clean)) {
      throw new DomainError('USUARIO_EXISTE', 'Ya existe un usuario con ese nombre');
    }

    const first = (await this.users.count()) === 0;
    if (!first) {
      if (!this.allowRegistration) {
        throw new DomainError('REGISTRO_CERRADO', 'El registro está cerrado');
      }
      if (this.registrationCode && String(codigo ?? '') !== this.registrationCode) {
        throw new DomainError('CODIGO_INVALIDO', 'El código de invitación no es correcto');
      }
    }

    const hogarId = first && this.defaultHogarId ? this.defaultHogarId : newId();
    const usuario = {
      id: newId(),
      nombre: clean,
      hash: this.hasher.hash(password),
      rol: first ? 'admin' : 'user',
      hogarId,
      creadoEn: new Date().toISOString(),
    };
    await this.users.save(usuario);
    await this.hogares.save({
      id: hogarId,
      nombre: String(hogarNombre ?? '').trim() || `Hogar de ${clean}`,
      usuarioId: usuario.id,
      creadoEn: usuario.creadoEn,
    });
    return publicUser(usuario);
  }

  /** Registra y deja la sesión iniciada. */
  async signUp(args) {
    await this.register(args);
    return this.login({ nombre: args?.nombre, password: args?.password });
  }

  /** Primer arranque: crea el usuario administrador. */
  async setup(args) {
    if (!(await this.needsSetup())) {
      throw new DomainError('YA_CONFIGURADO', 'Ya existe un usuario; inicia sesión');
    }
    return this.signUp(args);
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
