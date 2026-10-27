import { Directory, File, Paths } from 'expo-file-system';

const dir = new Directory(Paths.cache, 'guide');

// A fresh name each time: the player may still hold the previous file open.
export async function storeGuide(wav: Uint8Array) {
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true });
  const file = new File(dir, `${Date.now()}.wav`);
  await file.write(wav);
  return file.uri;
}
