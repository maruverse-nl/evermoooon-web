import { Asset } from 'expo-asset';
import { getDocumentAsync } from 'expo-document-picker';
import { readScore } from '../music/load';
import type { Song } from '../music/types';
import { bytesAt, drop, keys, load, save } from './disk';

const DEMO = 'demo-evergreen';
const cache = new Map<string, Song>();

async function demo() {
  const asset = Asset.fromModule(require('../../assets/songs/evergreen.musicxml'));
  await asset.downloadAsync();
  return readScore(await bytesAt(asset.localUri ?? asset.uri), DEMO);
}

export async function getSong(id: string) {
  if (!cache.has(id)) {
    const song = id === DEMO ? await demo() : await load<Song>(`song-${id}`);
    if (!song) throw new Error('This song is gone from the phone.');
    cache.set(id, song);
  }
  return cache.get(id)!;
}

export async function allSongs() {
  const ids = keys().flatMap(k => (k.startsWith('song-') ? [k.slice(5)] : []));
  const saved = await Promise.all(ids.map(getSong));
  return [await getSong(DEMO), ...saved.sort((a, b) => a.title.localeCompare(b.title))];
}

export const isDemo = (id: string) => id === DEMO;

export async function importSong(): Promise<Song | undefined> {
  const picked = await getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (picked.canceled) return;
  const file = picked.assets[0];
  if (/\.pdf$/i.test(file.name)) {
    throw new Error(
      'A PDF is a picture of the music, the app needs the notes themselves. ' +
        'Export MusicXML from Sibelius, Finale, Dorico or MuseScore (MuseScore can also open a PDF and convert it), then import that file.',
    );
  }

  const id = Date.now().toString(36);
  const song = readScore(await bytesAt(file.uri), id);
  if (!song.parts.length) throw new Error('No sung notes found in this file.');
  if (song.title === 'Untitled') song.title = file.name.replace(/\.(musicxml|mxl|xml)$/i, '');

  await save(`song-${id}`, song);
  cache.set(id, song);
  return song;
}

export function deleteSong(id: string) {
  drop(`song-${id}`);
  cache.delete(id);
}

type Progress = { best: Record<string, number>; part: Record<string, string> };

export const progress = async (): Promise<Progress> => (await load<Progress>('progress')) ?? { best: {}, part: {} };

export async function remember(songId: string, partId: string, score?: number) {
  const p = await progress();
  p.part[songId] = partId;
  const key = `${songId}/${partId}`;
  if (score !== undefined && score > (p.best[key] ?? -1)) p.best[key] = score;
  await save('progress', p);
}
