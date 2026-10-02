import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";
import { WASI, File, OpenFile, ConsoleStdout } from "@bjorn3/browser_wasi_shim";

class wasiRunnerHandler implements FormatHandler {
  public name = "wasiRunner";
  public supportedFormats = [
    CommonFormats.WASM.builder("wasm").lossless().from(),
    CommonFormats.TEXT.builder("txt").to(),
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
    const outputFiles: FileData[] = [];
    for (const inputFile of inputFiles) {
      let output: number[] = [];
      let fds = [
        new OpenFile(new File([])), // stdin
        new ConsoleStdout((buffer) => output.push(...buffer)),
        new ConsoleStdout((buffer) => output.push(...buffer)),
      ];
      let wasi = new WASI([inputFile.name], [], fds);

      let wasm = await WebAssembly.compile(new Uint8Array(inputFile.bytes));
      let inst = (await WebAssembly.instantiate(wasm, {
        wasi_snapshot_preview1: wasi.wasiImport,
      })) as any;
      wasi.start(inst);

      outputFiles.push({
        name: inputFile.name.replace(/\.[^.]+$/, "") + `.txt`,
        bytes: new Uint8Array(output),
      });
    }
    return outputFiles;
  }
}

export default wasiRunnerHandler;
