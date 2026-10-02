import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";
import { PDFParse } from "pdf-parse";
import pdfWorkerUrl from "../../node_modules/pdf-parse/dist/pdf-parse/web/pdf.worker.mjs?url";

class pdfparseHandler implements FormatHandler {
  public readonly name = "pdfparse";
  public supportedFormats = [
    CommonFormats.PDF.builder("pdf").from(),
    CommonFormats.TEXT.builder("txt").to(),
  ];
  public ready = false;

  async init() {
    PDFParse.setWorker(pdfWorkerUrl);
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];

    for (const inputFile of inputFiles) {
      const parser = new PDFParse({ data: new Uint8Array(inputFile.bytes) });
      const text = await parser.getText();
      await parser.destroy();

      outputFiles.push({
        bytes: new TextEncoder().encode(text.text),
        name: inputFile.name.replace(/\.pdf$/i, ".txt"),
      });
    }

    return outputFiles;
  }
}

export default pdfparseHandler;
