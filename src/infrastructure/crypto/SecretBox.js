import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Cifrado del token de IA (AES-256-GCM). La clave sale de `SECRET_KEY` o, si no
 * hay, se genera una en `data/.secret` con permisos 600.
 */
export function createSecretBox({ key, keyFile }) {
  const secret = resolveKey(key, keyFile);

  return {
    encrypt(text) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', secret, iv);
      const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
    },
    decrypt(payload) {
      try {
        const [version, iv, tag, data] = String(payload).split(':');
        if (version !== 'v1') return '';
        const decipher = createDecipheriv('aes-256-gcm', secret, Buffer.from(iv, 'base64'));
        decipher.setAuthTag(Buffer.from(tag, 'base64'));
        return Buffer.concat([
          decipher.update(Buffer.from(data, 'base64')),
          decipher.final(),
        ]).toString('utf8');
      } catch {
        return '';
      }
    },
  };
}

function resolveKey(key, keyFile) {
  if (key) return scryptSync(key, 'menu-planner', 32);
  if (existsSync(keyFile)) {
    return Buffer.from(readFileSync(keyFile, 'utf8').trim(), 'base64');
  }
  const generated = randomBytes(32);
  mkdirSync(dirname(keyFile), { recursive: true });
  writeFileSync(keyFile, generated.toString('base64'), { mode: 0o600 });
  return generated;
}
