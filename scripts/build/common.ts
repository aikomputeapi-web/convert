import { join } from "path";
import { mkdir, readdir, rm, rename } from "fs/promises";
import type { PrebuildSubrecipeRequirement, RequirementsConfig } from "./types";

const OUT_DIR = join(import.meta.dir, "../../built");
export const CACHE_DIR = join(import.meta.dir, "../../.cache/convert-build");
const RECIPE_DIR = join(import.meta.dir, "../../recipe");
const PREBUILT_DIR = join(import.meta.dir, "../../prebuilt");

export const PREBUILD_VERSION = 1;

export const PACK_IMAGE =
  "debian:bookworm-slim@sha256:3783cc01769c7b2b1b83a5c5ad96c815348e28ed7da68e2e3687004faa906251";

export type Scope = {
  recipeDir: string;
  outDir: string;
  stateDir: string;
  prebuiltDir: string;
};

export const ROOT_SCOPE: Scope = {
  recipeDir: RECIPE_DIR,
  outDir: OUT_DIR,
  stateDir: CACHE_DIR,
  prebuiltDir: PREBUILT_DIR,
};

export function subrecipeScope(scope: Scope, name: string): Scope {
  const stateDir = join(scope.stateDir, "subrecipes", name);
  return {
    recipeDir: join(scope.recipeDir, name),
    outDir: join(stateDir, "requirements"),
    stateDir,
    prebuiltDir: join(scope.prebuiltDir, name),
  };
}

export async function loadRequirements(recipeDir: string): Promise<RequirementsConfig> {
  const configPath = join(recipeDir, "requirements.config.ts");
  if (!(await Bun.file(configPath).exists())) return [];
  return (await import(configPath)).default;
}

export function prebuiltPath(
  requirement: PrebuildSubrecipeRequirement,
  scope: Scope,
  inputs: string,
) {
  return join(scope.prebuiltDir, `${requirement.name}-${inputs}.tar.gz`);
}

export async function findPrebuilts(requirement: PrebuildSubrecipeRequirement, scope: Scope) {
  const pattern = new RegExp(`^${RegExp.escape(requirement.name)}-([0-9a-f]{64})\\.tar\\.gz$`);
  let entries: string[];
  try {
    entries = await readdir(scope.prebuiltDir);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const inputs = pattern.exec(entry)?.[1];
    return inputs ? [{ path: join(scope.prebuiltDir, entry), inputs }] : [];
  });
}

export async function extractTarball(outPath: string, tarball: Uint8Array) {
  const tmp = join(CACHE_DIR, `tmp-${crypto.randomUUID()}`);
  await mkdir(tmp, { recursive: true });
  await rm(outPath, { recursive: true, force: true });

  const archive = new Bun.Archive(tarball);
  await archive.extract(tmp);

  const [inner] = await readdir(tmp);
  await rename(join(tmp, inner), outPath);
  await rm(tmp, { recursive: true });
}
