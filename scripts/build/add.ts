import { join, relative } from "path";
import ts from "typescript";
import { DOWNLOADS_DIR, ROOT_SCOPE, loadRequirements, subrecipeScope, type Scope } from "./common";
import { hashFile } from "./hash";
import { hasSource, isSubrecipe } from "./types";

// this is crazy
export function insertSource(config: string, name: string, url: string, hash: string) {
  const file = ts.createSourceFile("requirements.config.ts", config, ts.ScriptTarget.Latest, true);
  const exported = file.statements.find(ts.isExportAssignment);
  let expression = exported?.expression;
  while (
    expression &&
    (ts.isSatisfiesExpression(expression) ||
      ts.isAsExpression(expression) ||
      ts.isParenthesizedExpression(expression))
  ) {
    expression = expression.expression;
  }
  if (!expression || !ts.isArrayLiteralExpression(expression)) {
    throw new Error("requirements.config.ts must export an array literal to add a source.");
  }

  const entry = expression.elements.find((element) => {
    if (!ts.isObjectLiteralExpression(element)) return false;
    return element.properties.some(
      (property) =>
        ts.isPropertyAssignment(property) &&
        property.name.getText(file).replace(/^["']|["']$/g, "") === "name" &&
        ts.isStringLiteral(property.initializer) &&
        property.initializer.text === name,
    );
  });
  const properties = `url: ${JSON.stringify(url)},\n    hash: ["sha256", ${JSON.stringify(hash)}],`;
  const container = entry && ts.isObjectLiteralExpression(entry) ? entry : expression;
  const members = ts.isObjectLiteralExpression(container)
    ? container.properties
    : container.elements;
  const last = members.at(-1);
  const comma = last && !members.hasTrailingComma ? "," : "";
  const position = container.end - 1;
  const addition = entry
    ? `\n    ${properties}\n  `
    : `\n  {\n    name: ${JSON.stringify(name)},\n    ${properties}\n  },\n`;
  const before = config.slice(0, position);
  // A missing comma belongs before any trailing comments, immediately after the last member.
  const prefix =
    comma && last ? config.slice(0, last.end) + comma + config.slice(last.end, position) : before;
  return prefix.trimEnd() + addition + config.slice(position);
}

export async function addSource(path: string, url: string, root: Scope = ROOT_SCOPE) {
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || part.includes("\\"))) {
    throw new Error("Pass a requirement name, or subrecipe/name.");
  }
  if (new URL(url).protocol !== "https:") throw new Error("Source URLs must use HTTPS.");

  let scope = root;
  for (const part of parts.slice(0, -1)) {
    const requirement = (await loadRequirements(scope.recipeDir)).find(({ name }) => name === part);
    if (!requirement || !isSubrecipe(requirement)) throw new Error(`${part} is not a subrecipe.`);
    scope = subrecipeScope(scope, part);
  }
  const name = parts.at(-1)!;
  const existing = (await loadRequirements(scope.recipeDir)).find((entry) => entry.name === name);
  if (existing && hasSource(existing)) throw new Error(`${path} already has a source.`);

  const configPath = join(scope.recipeDir, "requirements.config.ts");
  const configFile = Bun.file(configPath);
  const config = (await configFile.exists())
    ? await configFile.text()
    : `import type { RequirementsConfig } from ${JSON.stringify(relative(scope.recipeDir, join(import.meta.dir, "types")).replaceAll("\\", "/"))};\n\nexport default [] satisfies RequirementsConfig;\n`;
  // Check that the file can be edited before downloading anything.
  insertSource(config, name, url, "");
  console.log(`Fetching file ${url}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch: ${response.status} ${response.statusText}`);
  const bytes = await response.bytes();
  const hash = hashFile("sha256", bytes);
  await Bun.write(join(DOWNLOADS_DIR, hash), bytes);
  const updated = insertSource(config, name, url, hash);
  const formatted = Bun.spawnSync(
    ["bun", "x", "--no-install", "oxfmt", "--stdin-filepath", configPath],
    {
      stdin: new TextEncoder().encode(updated),
    },
  );
  if (formatted.exitCode !== 0) throw new Error(formatted.stderr.toString());
  await Bun.write(configPath, formatted.stdout);
  console.log(`Added source for ${path} to ${relative(join(root.recipeDir, ".."), configPath)}.`);
}
