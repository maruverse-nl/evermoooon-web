import { Directory, File, Paths } from 'expo-file-system';

const dir = new Directory(Paths.document, 'coach');
const file = (key: string) => new File(dir, `${key}.json`);

export function keys() {
  if (!dir.exists) return [];
  return dir.list().flatMap(f => (f instanceof File && f.name.endsWith('.json') ? [f.name.slice(0, -5)] : []));
}

export async function load<T>(key: string): Promise<T | undefined> {
  const f = file(key);
  return f.exists ? JSON.parse(await f.text()) : undefined;
}

export async function save(key: string, value: unknown) {
  dir.create({ idempotent: true, intermediates: true });
  await file(key).write(JSON.stringify(value));
}

export function drop(key: string) {
  const f = file(key);
  if (f.exists) f.delete();
}

export const bytesAt = (uri: string) => new File(uri).bytes();
