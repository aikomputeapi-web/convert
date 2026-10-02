import { type FileData, type FileFormat, type FormatHandler } from "../FormatHandler.ts";
import CommonFormats from "src/CommonFormats.ts";

class cssHandler implements FormatHandler {
  public name: string = "css";
  public supportedFormats?: FileFormat[];
  public ready: boolean = false;
  public offload: boolean = true;

  async init() {
    this.supportedFormats = [
      CommonFormats.CSS.builder("css").lossless().fromTo(),
      CommonFormats.LESS.builder("less").from(),
      CommonFormats.SCSS.builder("scss").from(),
    ];
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];
    for (const file of inputFiles) {
      const source = new TextDecoder().decode(file.bytes);
      const basename = file.name.split(".").slice(0, -1).join(".");
      let css: string;
      if (inputFormat.internal === "less") {
        const [{ default: createLess }, { default: createFileManager }, { default: PluginLoader }] =
          await Promise.all([
            // @ts-ignore
            import("less/lib/less/index.js"),
            // @ts-ignore
            import("less/lib/less-browser/file-manager.js"),
            // @ts-ignore
            import("less/lib/less-browser/plugin-loader.js"),
          ]);
        const less = createLess();
        less.PluginLoader = PluginLoader;
        less.FileManager = createFileManager({}, less.logger);
        less.environment.addFileManager(new less.FileManager());
        const { css: compiled } = await less.render(source);
        css = compiled;
      } else if (inputFormat.internal === "scss") {
        const sass = await import("sass");
        const result = sass.compileString(source, { url: new URL(`file://${file.name}`) });
        css = result.css;
      } else {
        css = source;
      }

      outputFiles.push({
        name: `${basename}.${outputFormat.internal}`,
        bytes: new TextEncoder().encode(css),
      });
    }
    return outputFiles;
  }
}

export default cssHandler;
