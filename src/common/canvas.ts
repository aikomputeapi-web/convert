export type CanvasBundle = { canvas: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D };

export function createCanvas(cpu: boolean = true): CanvasBundle {
  const canvas = new OffscreenCanvas(0, 0);
  const ctx = canvas.getContext("2d", { willReadFrequently: cpu });
  if (!ctx) throw new Error("Could not create canvas context.");
  return { canvas, ctx };
}

export async function canvasToBlob(bundle: CanvasBundle, mime: string): Promise<Uint8Array> {
  const blob = await bundle.canvas.convertToBlob({
    type: mime,
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function blobToCanvas(bundle: CanvasBundle, bytes: Uint8Array, mime: string) {
  const blob = new Blob([bytes as BlobPart], { type: mime });

  const image = await createImageBitmap(blob);

  bundle.canvas.width = image.width;
  bundle.canvas.height = image.height;
  bundle.ctx.drawImage(image, 0, 0);
  image.close();
}
