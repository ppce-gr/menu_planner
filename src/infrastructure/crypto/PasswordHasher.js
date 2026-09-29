import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Contraseñas con `scrypt` (sin dependencias) y tokens de sesión aleatorios.
 */
export function createPasswordHasher() {
  return {
    hash(password) {
      const salt = randomBytes(16).toString('hex');
      const derived = scryptSync(String(password), salt, 64).toString('hex');
      return `scrypt:${salt}:${derived}`;
    },
    verify(password, stored) {
      try {
        const [algo, salt, expected] = String(stored).split(':');
        if (algo !== 'scrypt' || !salt || !expected) return false;
        const derived = scryptSync(String(password), salt, 64);
        const target = Buffer.from(expected, 'hex');
        return derived.length === target.length && timingSafeEqual(derived, target);
      } catch {
        return false;
      }
    },
    newToken() {
      return randomBytes(32).toString('hex');
    },
  };
}
