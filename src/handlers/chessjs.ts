import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";
import { Chess } from "chess.js";

class chessjsHandler implements FormatHandler {
  public name: string = "chessjs";
  public supportedFormats: FileFormat[] = [
    CommonFormats.FEN.builder("fen").fromTo(),
    CommonFormats.PGN.builder("pgn").lossless().fromTo(),
    CommonFormats.TEXT.builder("txt").to(),
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
    const outputFiles: FileData[] = [];
    for (const inputFile of inputFiles) {
      const chess = new Chess();

      const input = new TextDecoder().decode(inputFile.bytes).trim();
      if (inputFormat.internal === "fen") {
        chess.load(input, { skipValidation: true });
      } else if (inputFormat.internal === "pgn") {
        chess.loadPgn(input);
      } else {
        throw new TypeError(`chessjsHandler cannot convert from ${inputFormat.mime}`);
      }

      let output;
      if (outputFormat.internal === "fen") {
        output = chess.fen();
      } else if (outputFormat.internal === "pgn") {
        output = chess.pgn();
      } else if (outputFormat.internal === "txt") {
        output = chess.ascii();
      } else {
        throw new TypeError(`chessjsHandler cannot convert to ${outputFormat.mime}`);
      }

      const bytes = new TextEncoder().encode(output);
      const name = inputFile.name.replace(/\.[^.]+$/, "") + `.${outputFormat.extension}`;
      outputFiles.push({ name, bytes });
    }
    return outputFiles;
  }
}

export default chessjsHandler;
