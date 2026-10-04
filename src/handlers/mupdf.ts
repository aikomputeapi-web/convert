import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";
import { DocumentWriter, Document, Buffer, Matrix } from "mupdf";
import { changeExt } from "src/common/index.ts";

class mupdfHandler implements FormatHandler {
  public readonly name = "mupdf";
  // theres 0 ways to query it, so we have this big ass list
  public supportedFormats = [
    CommonFormats.PDF.builder("pdf").fromTo(),
    CommonFormats.EPUB.builder("epub").from(),
    CommonFormats.MOBI.builder("mobi").from(),
    CommonFormats.FB2.builder("fb2").from(),
    CommonFormats.DOCX.builder("docx").from(),
    CommonFormats.XLSX.builder("xlsx").from(),
    CommonFormats.PPTX.builder("pptx").from(),
    CommonFormats.HWPX.builder("hwpx").from(),
    CommonFormats.MD.builder("md").from(),
    CommonFormats.CBZ.builder("cbz").fromTo(),
    CommonFormats.CBT.builder("cbt").from(),
    // most images should go through imagemagick but it doesnt have some
    CommonFormats.JXR.builder("jxr").from(),
    CommonFormats.JBIG2.builder("jbig2").from(),
    CommonFormats.PNG.builder("png").to(),
    CommonFormats.JPEG.builder("jpeg").to(),
    CommonFormats.PNM.builder("pnm").to(),
    CommonFormats.PGM.builder("pgm").to(),
    CommonFormats.PPM.builder("ppm").to(),
    CommonFormats.PAM.builder("pam").to(),
    CommonFormats.PBM.builder("pbm").to(),
    CommonFormats.PKM.builder("pkm").fromTo(),
    CommonFormats.PCL.builder("pcl").to(),
    CommonFormats.PCLM.builder("pclm").fromTo(),
    CommonFormats.PS.builder("ps").to(),
    CommonFormats.PWG.builder("pwg").to(),
    CommonFormats.SVG.builder("svg").lossless().to(),
    CommonFormats.HTML.builder("html").lossless().from(),
    // html has *more* issues than svg with text positioning, better embed svg
    CommonFormats.XHTML.builder("xhtml").fromTo(),
    CommonFormats.TEXT.builder("text").fromTo(),
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
      const document = Document.openDocument(inputFile.bytes, inputFormat.mime);

      // oxfmt-ignore
      const multipage = ["pdf", "html", "xhtml", "text", "cbz", "ps", "pcl", "pclm", "pwg"]
        .includes(outputFormat.internal);
      let options = "";
      if (outputFormat.internal === "svg") options = "text=text";
      if (outputFormat.internal === "html")
        options = "preserve-whitespace,preserve-spans,preserve-images";

      if (multipage) {
        const buffer = new Buffer();
        const writer = new DocumentWriter(buffer, outputFormat.internal, options);
        for (let i = 0; i < document.countPages(); i++) {
          const page = document.loadPage(i);
          const dev = writer.beginPage(page.getBounds());
          page.run(dev, Matrix.identity);
          writer.endPage();
          page.destroy();
        }
        writer.close();
        outputFiles.push({
          name: changeExt(inputFile.name, outputFormat.extension),
          bytes: new Uint8Array(buffer.asUint8Array()),
        });
        writer.destroy();
        buffer.destroy();
      } else {
        for (let i = 0; i < document.countPages(); i++) {
          const buffer = new Buffer();
          const writer = new DocumentWriter(buffer, outputFormat.internal, options);
          const page = document.loadPage(i);
          const dev = writer.beginPage(page.getBounds());
          page.run(dev, Matrix.identity);
          writer.endPage();
          page.destroy();
          writer.close();
          outputFiles.push({
            name: changeExt(inputFile.name, outputFormat.extension, `_${i + 1}`),
            bytes: new Uint8Array(buffer.asUint8Array()),
          });
          writer.destroy();
          buffer.destroy();
        }
      }

      document.destroy();
    }

    return outputFiles;
  }
}

export default mupdfHandler;
