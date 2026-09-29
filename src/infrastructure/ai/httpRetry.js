const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `fetch` con reintentos y espera creciente ante saturación del proveedor
 * (429/503) o fallos de red. Evita que un pico de demanda tumbe la conversación.
 */
export async function fetchWithRetry(url, options = {}, { retries = 4, baseDelayMs = 1000 } = {}) {
  let lastResponse;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 || response.status === 503) {
        lastResponse = response;
        if (attempt < retries) {
          await sleep(baseDelayMs * 2 ** attempt);
          continue;
        }
        return response;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      throw error;
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError;
}
