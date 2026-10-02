import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import parseXML from "built/envelope/parseXML.js";
import * as yaml from "yaml";
import { parse, unparse } from "papaparse";

/// Converts things to JSON
export class toJsonHandler implements FormatHandler {
  public readonly name = "toJson";
  public supportedFormats = [
    CommonFormats.CSV.builder("csv").from(),
    CommonFormats.XML.builder("xml").from(),
    CommonFormats.YML.builder("yaml").from(),
    CommonFormats.JSONL.builder("jsonl").from(),
    CommonFormats.JSON.builder("json").lossless().to(),
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
    return inputFiles.map((file) => {
      const name = file.name.split(".").slice(0, -1).join(".") + ".json";
      const text = new TextDecoder().decode(file.bytes).trim();
      let object: any;
      switch (inputFormat.mime) {
        case "text/csv":
          ({ data: object } = parse(text, {
            header: true,
            skipEmptyLines: true,
          }));
          break;
        case "application/xml":
          object = parseXML(text);
          break;
        case "application/yaml":
          object = yaml.parse(text);
          break;
        case "application/jsonl":
          object = text
            .split("\n")
            .filter((l) => l.trim())
            .map((l) => JSON.parse(l));
          break;
        default:
          throw new Error("Unreachable");
      }
      return {
        name: name,
        bytes: new TextEncoder().encode(JSON.stringify(object)),
      };
    });
  }
}

function xmlEscape(str: string): string {
  return str
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
    .replaceAll("&", "&amp;");
}

/// Converts to things from JSON
export class fromJsonHandler {
  public readonly name = "fromJson";
  public ready = false;
  public supportedFormats = [
    CommonFormats.CSV.builder("csv").to(),
    CommonFormats.XML.builder("xml").to(),
    CommonFormats.YML.builder("yaml").to(),
    CommonFormats.JSONL.builder("jsonl").to(),
    CommonFormats.JSON.builder("json").from(),
  ];

  async init() {
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    return inputFiles.map((file) => {
      const name = file.name.split(".").slice(0, -1).join(".") + "." + outputFormat.extension;
      let object = JSON.parse(new TextDecoder().decode(file.bytes));
      let text = "";
      switch (outputFormat.mime) {
        case "text/csv": {
          // hell
          if (!Array.isArray(object) && object && typeof object === "object") {
            object = Object.entries(object).map(([key, value]) => ({
              _key: key,
              ...(value && typeof value === "object" && !Array.isArray(value)
                ? value
                : { _value: value }),
            }));
          }
          if (!Array.isArray(object)) {
            object = [object];
          }
          object = object
            .map((r: any) => (r && typeof r === "object" ? r : { _value: r }))
            .map((r: any) => {
              for (const [key, value] of Object.entries(r)) {
                r[key] = value && typeof value === "object" ? JSON.stringify(value) : value;
              }
              return r;
            });
          const columns = [...new Set(object.flatMap((r: any) => Object.keys(r)))] as string[];
          if (columns.length) text = unparse(object, { columns: columns, header: true });
          else text = "";
          break;
        }
        case "application/xml": {
          function write(value: any, tagName: string | null = null) {
            if (tagName != null) tagName = xmlEscape(tagName);
            if (typeof value !== "object") {
              const str = xmlEscape(typeof value === "string" ? value : JSON.stringify(value));
              if (tagName != null) text += `<${tagName}>${str}</${tagName}>`;
              else text += str;
              return;
            }
            if (Array.isArray(value)) {
              tagName ??= "Array";
              text += `<${tagName}>`;
              for (const item of value) {
                write(item, "Item");
              }
              text += `</${tagName}>`;
              return;
            }
            const isXMLTag = typeof value._tag === "string" && Array.isArray(value._children); // is serialized XML tag
            if (isXMLTag) tagName ??= value._tag;
            tagName ??= "Object";
            text += `<${tagName}>`;
            for (const [k, v] of Object.entries(value)) {
              if (isXMLTag && (k === "_tag" || k === "_children")) continue;
              write(v, k);
            }
            if (isXMLTag) {
              for (const child of value._children) {
                write(child);
              }
            }
            text += `</${tagName}>`;
          }
          write(object);
          break;
        }
        case "application/yaml":
          text = yaml.stringify(object);
          break;
        case "application/jsonl":
          if (Array.isArray(object))
            text = object.map((r: any) => JSON.stringify(r)).join("\n") + "\n";
          else text = JSON.stringify(object);
          break;
        default:
          throw new Error("Unreachable");
      }
      return {
        name: name,
        bytes: new TextEncoder().encode(text),
      };
    });
  }
}
