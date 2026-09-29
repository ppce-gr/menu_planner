/**
 * Error de dominio: no depende de HTTP ni de la base de datos.
 */
export class DomainError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}
