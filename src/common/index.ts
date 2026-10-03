export function changeExt(name: string, newExt: string): string {
  const idx = name.lastIndexOf(".");
  const baseName = idx > 0 ? name.slice(0, idx) : name;
  return `${baseName}.${newExt}`;
}

export function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

export function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
