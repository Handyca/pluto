/**
 * Thin fetch wrapper that parses JSON and throws on non-2xx responses.
 * Shared by all client-side data hooks.
 */
export async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}`;
    try {
      const error = await res.json();
      errorMessage = error.error || error.message || errorMessage;
    } catch {
      errorMessage = res.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return res.json() as Promise<T>;
}
