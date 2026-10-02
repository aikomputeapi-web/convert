import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";
import { commands } from "@yowasp/clang";

class clangWasiHandler implements FormatHandler {
  public name: string = "clangWasi";
  public supportedFormats: FileFormat[] = [
    CommonFormats.C.builder("c").from(),
    CommonFormats.CPP.builder("cpp").from(),
    CommonFormats.ASM.builder("asm").from(),
    CommonFormats.WASM.builder("wasm").lossless().to(),
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
      const output = await commands[inputFormat.internal === "cpp" ? "clang++" : "clang"](
        [inputFile.name, "-o", "out.wasm", "-O3", "-fno-exceptions"],
        // this build specifically excludes exceptions for some reason
        {
          [inputFile.name]: inputFile.bytes,
        },
      );
      if (!output) throw new Error("clang did not return any files?");

      const data = output["out.wasm"];
      let bytes;
      if (data instanceof Uint8Array) {
        // js wtf is this ??
        bytes = data;
      } else if (typeof data === "string") {
        bytes = new TextEncoder().encode(data);
      } else {
        throw new Error("clang output was not a file");
      }

      outputFiles.push({
        name: inputFile.name.replace(/\.[^.]+$/, "") + `.wasm`,
        bytes,
      });
    }
    return outputFiles;
  }
}

export default clangWasiHandler;
