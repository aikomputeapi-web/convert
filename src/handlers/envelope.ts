import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

import { parseODT, parseODP, parseODS } from "built/envelope/parseODF.js";
import parseDOCX from "built/envelope/parseDOCX.js";
import parsePPTX from "built/envelope/parsePPTX.js";
import parseXLSX from "built/envelope/parseXLSX.js";
import CommonFormats from "src/CommonFormats.ts";

class envelopeHandler implements FormatHandler {
  public name = "envelope";
  public supportedFormats = [
    CommonFormats.DOCX.builder("docx").from(),
    // Currently, Pancoc handles PPTX and XLSX better than Envelope.
    // CommonFormats.PPTX.builder("pptx").from(),
    // CommonFormats.XLSX.builder("xlsx").from(),
    CommonFormats.ODT.builder("odt").from(),
    CommonFormats.ODP.builder("odp").from(),
    CommonFormats.ODS.builder("ods").from(),
    // Technically not "lossless", but it's about as close as we'll ever get
    CommonFormats.HTML.builder("html").lossless().to(),
  ];
  public ready = false;

  async init() {
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    if (outputFormat.internal !== "html")
      throw new TypeError(`Unsupported output format: ${outputFormat.internal}`);

    let parser: (bytes: Uint8Array) => Promise<string>;
    switch (inputFormat.internal) {
      case "odt":
        parser = parseODT;
        break;
      case "odp":
        parser = parseODP;
        break;
      case "ods":
        parser = parseODS;
        break;
      case "docx":
        parser = parseDOCX;
        break;
      case "pptx":
        parser = parsePPTX;
        break;
      case "xlsx":
        parser = parseXLSX;
        break;
      default:
        throw new TypeError(`Unsupported input format: ${inputFormat.internal}`);
    }

    const outputFiles: FileData[] = [];

    const encoder = new TextEncoder();

    for (const inputFile of inputFiles) {
      const html = `<div style="background: #fff">
        ${await parser(inputFile.bytes)}
      </div>`;
      const bytes = encoder.encode(html);
      const baseName = inputFile.name.split(".").slice(0, -1).join(".");
      const name = baseName + "." + outputFormat.extension;
      outputFiles.push({ bytes, name });
    }

    return outputFiles;
  }
}

export default envelopeHandler;
