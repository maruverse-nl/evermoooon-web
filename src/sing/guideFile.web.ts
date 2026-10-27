let last: string | undefined;

export async function storeGuide(wav: Uint8Array) {
  if (last) URL.revokeObjectURL(last);
  last = URL.createObjectURL(new Blob([wav as Uint8Array<ArrayBuffer>], { type: 'audio/wav' }));
  return last;
}
