import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import Formats from "src/Formats.ts";
import { commands } from "@yowasp/clang";
import { changeExt, encode } from "src/common/index.ts";

class clangWasiHandler implements FormatHandler {
  public readonly name = "clangWasi";
  public supportedFormats = [
    Formats.C.builder("c").from(),
    Formats.CPP.builder("cpp").from(),
    Formats.ASM.builder("asm").from(),
    Formats.WASM.builder("wasm").lossless().to(),
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
        bytes = encode(data);
      } else {
        throw new Error("clang output was not a file");
      }

      outputFiles.push({
        name: changeExt(inputFile.name, "wasm"),
        bytes,
      });
    }
    return outputFiles;
  }
}

export default clangWasiHandler;
