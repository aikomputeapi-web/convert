import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import { changeExt, decode, encode } from "src/common/index.ts";

class htmlEmbedHandler implements FormatHandler {
  public readonly name = "htmlEmbed";
  public supportedFormats = [
    CommonFormats.HTML.builder("html").lossless().to(),
    CommonFormats.PNG.builder("png").from(),
    CommonFormats.JPEG.builder("jpeg").from(),
    CommonFormats.WEBP.builder("webp").from(),
    CommonFormats.GIF.builder("gif").from(),
    CommonFormats.SVG.builder("svg").from(),
    CommonFormats.TEXT.builder("text").from(),
    CommonFormats.MP4.builder("mp4").from(),
    CommonFormats.MP3.builder("mp3").from(),
  ];
  public ready = false;

  async init() {
    this.ready = true;
  }

  static bytesToBase64(bytes: Uint8Array): string {
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 32768) {
      const byteChunk = bytes.subarray(i, i + 32768);
      chunks.push(String.fromCharCode(...byteChunk));
    }
    return btoa(chunks.join(""));
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    if (outputFormat.internal !== "html")
      throw new TypeError(`Unsupported output format: ${outputFormat.internal}`);

    let html = "";

    if (inputFormat.internal === "text") {
      for (const inputFile of inputFiles) {
        const text = decode(inputFile.bytes)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
        html += `<pre>${text}</pre>`;
      }
    } else {
      for (const inputFile of inputFiles) {
        const base64 = htmlEmbedHandler.bytesToBase64(inputFile.bytes);

        if (inputFormat.mime.startsWith("image/")) {
          html += `<img src="data:${inputFormat.mime};base64,${base64}"><br>`;
        } else if (inputFormat.mime.startsWith("audio/")) {
          html += `<audio controls>
            <source src="data:${inputFormat.mime};base64,${base64}" type="${inputFormat.mime}"></source>
          </audio><br>`;
        } else {
          html += `<video controls>
            <source src="data:${inputFormat.mime};base64,${base64}" type="${inputFormat.mime}"></source>
          </video><br>`;
        }
      }
    }

    const bytes = encode(html);
    const name = changeExt(inputFiles[0].name, outputFormat.extension);
    return [{ bytes, name }];
  }
}

export default htmlEmbedHandler;
