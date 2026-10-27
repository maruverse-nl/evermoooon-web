import { strFromU8, unzipSync } from 'fflate';
import { parseMusicXml } from './musicxml';
import type { Song } from './types';

const isZip = (bytes: Uint8Array) => bytes[0] === 0x50 && bytes[1] === 0x4b;

// .mxl is a zip; META-INF/container.xml names the score inside it.
export function readScore(bytes: Uint8Array, id: string): Song {
  if (!isZip(bytes)) return parseMusicXml(strFromU8(bytes), id);

  const files = unzipSync(bytes);
  const container = files['META-INF/container.xml'] && strFromU8(files['META-INF/container.xml']);
  const path =
    container?.match(/full-path="([^"]+)"/)?.[1] ??
    Object.keys(files).find(f => !f.startsWith('META-INF') && /\.(xml|musicxml)$/i.test(f));
  if (!path || !files[path]) throw new Error('No score found inside this .mxl file.');
  return parseMusicXml(strFromU8(files[path]), id);
}
