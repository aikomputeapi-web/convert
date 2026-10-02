import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import { InitializationError } from "src/errors.ts";

class svgToBlobHandler implements FormatHandler {
  public readonly name = "svgToBlob";
  public supportedFormats = [
    CommonFormats.PNG.builder("png").to(),
    CommonFormats.JPEG.builder("jpeg").to(),
    CommonFormats.WEBP.builder("webp").to(),
    CommonFormats.SVG.builder("svg").from(),
  ];
  public ready = false;
  public offload = false; // svg does not like createImageBitmap

  #canvas?: OffscreenCanvas;
  #ctx?: OffscreenCanvasRenderingContext2D;

  async init() {
    this.ready = true;
    this.#canvas = new OffscreenCanvas(1, 1);
    this.#ctx = this.#canvas.getContext("2d") || undefined;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    if (!this.#canvas || !this.#ctx) {
      throw new InitializationError("Handler not initialized.");
    }

    const outputFiles: FileData[] = [];
    for (const inputFile of inputFiles) {
      // avoid the "Tainted canvases may not be exported" error
      const url = `data:${inputFormat.mime};base64,${btoa(inputFile.bytes.reduce((str, byte) => str + String.fromCharCode(byte), ""))}`;

      const image = new Image();
      await new Promise((resolve, reject) => {
        image.addEventListener("load", resolve);
        image.addEventListener("error", reject);
        image.src = url;
      });

      this.#canvas.width = image.naturalWidth;
      this.#canvas.height = image.naturalHeight;
      this.#ctx.drawImage(image, 0, 0);

      const blob = await this.#canvas.convertToBlob({
        type: outputFormat.mime,
      });
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const name = inputFile.name.split(".").slice(0, -1).join(".") + "." + outputFormat.extension;

      outputFiles.push({ bytes, name });
    }
    return outputFiles;
  }
}

export default svgToBlobHandler;
