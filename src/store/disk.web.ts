const PREFIX = 'coach:';

export const keys = () =>
  Object.keys(localStorage).flatMap(k => (k.startsWith(PREFIX) ? [k.slice(PREFIX.length)] : []));

export async function load<T>(key: string): Promise<T | undefined> {
  const raw = localStorage.getItem(PREFIX + key);
  return raw ? JSON.parse(raw) : undefined;
}

export async function save(key: string, value: unknown) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export const drop = (key: string) => localStorage.removeItem(PREFIX + key);

export const bytesAt = async (uri: string) => new Uint8Array(await (await fetch(uri)).arrayBuffer());
