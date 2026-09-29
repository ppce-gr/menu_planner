import { newId } from '../domain/ids.js';

const DEFAULT = {
  proveedor: 'echo',
  modelo: 'echo',
  parametros: {},
  activo: false,
};

/**
 * Configuración del proveedor de IA. El token se guarda cifrado y nunca se
 * devuelve al frontend.
 */
export class ConfigService {
  constructor({ config, secretBox }) {
    this.config = config;
    this.secretBox = secretBox;
  }

  async getAiConfig(hogarId) {
    const stored = await this.config.getAiConfig(hogarId);
    if (!stored) return { ...DEFAULT, tieneToken: false };
    const { tokenCifrado, ...rest } = stored;
    return { ...rest, tieneToken: Boolean(tokenCifrado) };
  }

  /** Config completa, con el token ya descifrado. Solo para uso interno. */
  async getFullAiConfig(hogarId) {
    const stored = await this.config.getAiConfig(hogarId);
    if (!stored) return { ...DEFAULT, token: '' };
    const token = stored.tokenCifrado ? this.secretBox.decrypt(stored.tokenCifrado) : '';
    return { ...stored, token };
  }

  async saveAiConfig(hogarId, data = {}) {
    const current = (await this.config.getAiConfig(hogarId)) ?? {};
    const tokenCifrado = data.token
      ? this.secretBox.encrypt(String(data.token))
      : current.tokenCifrado ?? '';
    const saved = await this.config.saveAiConfig({
      id: current.id ?? newId(),
      hogarId,
      proveedor: data.proveedor ?? current.proveedor ?? DEFAULT.proveedor,
      modelo: data.modelo ?? current.modelo ?? DEFAULT.modelo,
      parametros: data.parametros ?? current.parametros ?? {},
      activo: data.activo ?? current.activo ?? false,
      tokenCifrado,
    });
    const { tokenCifrado: _omit, ...safe } = saved;
    return { ...safe, tieneToken: Boolean(tokenCifrado) };
  }
}
