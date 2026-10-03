import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import type { HandlerName } from "./index.ts";
import { changeExt } from "src/common/index.ts";

function createRenameHandler(name: HandlerName, formats: FileFormat[]) {
  return class implements FormatHandler {
    public readonly name = name;
    public supportedFormats = formats;
    public ready = false;

    async init() {
      this.ready = true;
    }

    async doConvert(
      inputFiles: FileData[],
      inputFormat: FileFormat,
      outputFormat: FileFormat,
    ): Promise<FileData[]> {
      return inputFiles.map((file) => ({
        ...file,
        name: changeExt(file.name, outputFormat.extension),
      }));
    }
  };
}

/// handler for renaming various aliased zip files
export const renameZipHandler = createRenameHandler("renameZip", [
  CommonFormats.ZIP.builder("zip").to(),
  CommonFormats.DOCX.builder("docx").from(),
  CommonFormats.XLSX.builder("xlsx").from(),
  CommonFormats.PPTX.builder("pptx").from(),
  CommonFormats.ODT.builder("odt").lossless().from(),
  CommonFormats.ODP.builder("odp").lossless().from(),
  CommonFormats.ODS.builder("ods").lossless().from(),
  CommonFormats.XPI.builder("xpi").lossless().from(),
  CommonFormats.LOVE.builder("love").from(),
  CommonFormats.OSZ.builder("osz").from(),
  CommonFormats.OSK.builder("osk").from(),
  CommonFormats.APWORLD.builder("apworld").from(),
  CommonFormats.JAR.builder("jar").lossless().from(),
  CommonFormats.APK.builder("apk").lossless().from(),
  CommonFormats.SB3.builder("sb3").from(),
  CommonFormats.IPA.builder("ipa").from(),
  CommonFormats.APP.builder("app").from(),
  CommonFormats.CBZ.builder("cbz").lossless().from(),
]);
/// handler for renaming text-based formats
export const renameTxtHandler = createRenameHandler("renameTxt", [
  CommonFormats.TEXT.builder("text").to(),
  CommonFormats.JSON.builder("json").from(),
  CommonFormats.XML.builder("xml").from(),
  CommonFormats.YML.builder("yaml").from(),
]);
/// handler for renaming json-based formats
export const renameJsonHandler = createRenameHandler("renameJson", [
  CommonFormats.JSON.builder("json").to(),
  CommonFormats.HAR.builder("har").from(),
  CommonFormats.PISKEL.builder("piskel").lossless().from(),
]);
/// handler for renaming tar-based formats
export const renameTarHandler = createRenameHandler("renameTar", [
  CommonFormats.TAR.builder("tar").to(),
  CommonFormats.CBT.builder("cbt").lossless().from(),
]);
/// handler for renaming rar-based formats
export const renameRarHandler = createRenameHandler("renameRar", [
  CommonFormats.RAR.builder("rar").to(),
  CommonFormats.CBR.builder("cbr").lossless().from(),
]);
/// handler for renaming 7z-based formats
export const rename7zHandler = createRenameHandler("rename7z", [
  CommonFormats.SZ.builder("7z").to(),
  CommonFormats.CB7.builder("cb7").lossless().from(),
]);
