import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";
import { encode, decode } from "@toon-format/toon";

class toonHandler implements FormatHandler {
  public name: string = "toon";

  public supportedFormats?: FileFormat[] = [
    CommonFormats.JSON.builder("json").lossless().fromTo(),
    CommonFormats.TOON.builder("toon").lossless().fromTo(),
  ];

  public ready: boolean = false;
  public offload: boolean = true;

  async init() {
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    switch (inputFormat.mime) {
      case CommonFormats.JSON.mime:
        if (outputFormat.mime !== CommonFormats.TOON.mime) {
          throw new TypeError(`Unsupported output format MIME: ${outputFormat.mime}`);
        }

        return inputFiles.map((file) => {
          const text = new TextDecoder().decode(file.bytes);
          let jsonData = JSON.parse(text);

          const toonData = encode(jsonData);
          const name = file.name.split(".").slice(0, -1).join(".") + ".toon";

          return {
            name,
            bytes: new TextEncoder().encode(toonData),
          };
        });

      case CommonFormats.TOON.mime:
        if (outputFormat.mime !== CommonFormats.JSON.mime) {
          throw new TypeError(`Unsupported output format MIME: ${outputFormat.mime}`);
        }

        return inputFiles.map((file) => {
          const toonData = new TextDecoder().decode(file.bytes);
          const jsonData = JSON.stringify(decode(toonData));

          const name = file.name.split(".").slice(0, -1).join(".") + ".json";

          return {
            name,
            bytes: new TextEncoder().encode(jsonData),
          };
        });

      default:
        throw new TypeError(`Unsupported input format: ${inputFormat.internal}`);
    }
  }
}

export default toonHandler;
