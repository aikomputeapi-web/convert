import { join } from "path";
import { mkdir, rm, stat } from "fs/promises";
import { $ } from "bun";
import type { ArgsDef } from "citty";
import {
  CACHE_DIR,
  extractTarball,
  findPrebuilts,
  loadRequirements,
  subrecipeScope,
  type Scope,
} from "./common";
import { hashFile, hashInputs, listFiles, updateHash } from "./hash";
import {
  isPrebuilt,
  isSubrecipe,
  type AssembleSubrecipeRequirement,
  type PrebuildSubrecipeRequirement,
  type Requirement,
  type RequirementsConfig,
  type SourceRequirement,
} from "./types";

const TARBALLS_DIR = join(CACHE_DIR, "tarballs");

await mkdir(TARBALLS_DIR, { recursive: true });

async function fetchFile(path: string, url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch: ${res.status} ${res.statusText}`);
  const file = await res.bytes();
  await Bun.write(path, file);
  return file;
}

export const assembleArgs = {
  verbose: { type: "boolean", description: "Be louder" },
  force: { type: "boolean", description: "Reassemble, even if it looks the same" },
  refetch: { type: "boolean", description: "Redownload everything" },
} as const satisfies ArgsDef;

export type AssembleArgs = { verbose?: boolean; force?: boolean; refetch?: boolean };

function hashPath(requirement: Requirement, scope: Scope) {
  return join(scope.stateDir, "out-hashes", requirement.name);
}

async function hashRequirement(requirement: Requirement, scope: Scope) {
  const hash = new Bun.CryptoHasher("sha256");

  updateHash(hash, await hashInputs(requirement, scope));

  if (isPrebuilt(requirement)) {
    for (const { path } of await findPrebuilts(requirement, scope)) {
      updateHash(hash, path, await Bun.file(path).bytes());
    }
  } else if (isSubrecipe(requirement)) {
    const sub = subrecipeScope(scope, requirement.name);
    for (const subrequirement of await loadRequirements(sub.recipeDir)) {
      updateHash(hash, await Bun.file(hashPath(subrequirement, sub)).text());
    }
  }

  const outPath = join(scope.outDir, requirement.name);
  for (const path of await listFiles(outPath)) {
    const s = await stat(join(outPath, path));
    updateHash(hash, path, String(s.size), String(s.mtimeMs));
  }

  return hash.digest("hex");
}

async function writeHash(requirement: Requirement, scope: Scope) {
  await Bun.write(hashPath(requirement, scope), await hashRequirement(requirement, scope));
}

async function checkHash(requirement: Requirement, scope: Scope): Promise<boolean> {
  try {
    const outHash = (await Bun.file(hashPath(requirement, scope)).text()).trim();
    return outHash === (await hashRequirement(requirement, scope));
  } catch {
    return false;
  }
}

async function assembleSource(requirement: SourceRequirement, scope: Scope, args: AssembleArgs) {
  const tarballPath = join(TARBALLS_DIR, `${requirement.hash[1]}.tar.gz`);

  let tarball;
  if (!args.refetch) {
    try {
      tarball = await Bun.file(tarballPath).bytes();
      const hash = hashFile(requirement.hash[0], tarball);
      if (hash !== requirement.hash[1]) {
        console.warn(`Bad hash for cached ${requirement.name} tarball, refetching.`);
        tarball = undefined;
      }
    } catch {
      tarball = undefined;
    }
  }

  if (tarball && args.verbose) console.log(`Using cached tarball for ${requirement.name}.`);
  if (!tarball) {
    console.log(`Fetching file ${requirement.url}...`);
    tarball = await fetchFile(tarballPath, requirement.url);
    console.log(`Got sources for ${requirement.name}.`);
  }

  const hash = hashFile(requirement.hash[0], tarball);
  if (hash !== requirement.hash[1]) {
    throw new Error(
      `Requirement claimed a ${requirement.hash[0]} hash of ${requirement.hash[1]}, but the source hashes to ${hash}!`,
    );
  }

  const outPath = join(scope.outDir, requirement.name);
  await extractTarball(outPath, tarball);

  const recipePath = join(scope.recipeDir, requirement.name);
  for (const patch of requirement.patches || []) {
    await $`patch -p1 -i ${join(recipePath, patch)}`.cwd(outPath);
  }
}

/** Expects the subrecipe's own requirements to already be assembled. */
async function assembleSubrecipe(requirement: AssembleSubrecipeRequirement, scope: Scope) {
  const sub = subrecipeScope(scope, requirement.name);
  const outPath = join(scope.outDir, requirement.name);
  await rm(outPath, { recursive: true, force: true });
  await mkdir(outPath, { recursive: true });

  await $`bun run ${join(sub.recipeDir, requirement.assemble)}`
    .cwd(sub.outDir)
    .env({ ...process.env, OUT_DIR: outPath });
}

async function assemblePrebuilt(requirement: PrebuildSubrecipeRequirement, scope: Scope) {
  const inputs = await hashInputs(requirement, scope);
  const prebuilts = await findPrebuilts(requirement, scope);

  let prebuilt = prebuilts.find((prebuilt) => prebuilt.inputs === inputs);
  if (!prebuilt) {
    if (prebuilts.length !== 1) {
      throw new Error(
        `${requirement.name} needs exactly one prebuilt, found ${prebuilts.length}. Run \`bun run build:prebuild ${requirement.name}\`.`,
      );
    }
    prebuilt = prebuilts[0];
    console.warn(
      `Prebuilt ${requirement.name} is stale, run \`bun run build:prebuild ${requirement.name}\` to update it.`,
    );
  }

  await extractTarball(join(scope.outDir, requirement.name), await Bun.file(prebuilt.path).bytes());
}

async function assembleRequirementChecked(
  requirement: Requirement,
  scope: Scope,
  args: AssembleArgs,
) {
  if (isSubrecipe(requirement) && !isPrebuilt(requirement)) {
    const sub = subrecipeScope(scope, requirement.name);
    await assembleAll(await loadRequirements(sub.recipeDir), sub, args);
  }

  if (!args.force && !args.refetch && (await checkHash(requirement, scope))) {
    if (args.verbose) console.log(`${requirement.name} is up to date.`);
    return;
  }

  if (isPrebuilt(requirement)) await assemblePrebuilt(requirement, scope);
  else if (isSubrecipe(requirement)) await assembleSubrecipe(requirement, scope);
  else await assembleSource(requirement, scope, args);

  await writeHash(requirement, scope);
  if (args.verbose) console.log(`Assembled ${requirement.name}.`);
}

export async function assembleAll(
  requirements: RequirementsConfig,
  scope: Scope,
  args: AssembleArgs,
) {
  await mkdir(scope.outDir, { recursive: true });

  const results = await Promise.allSettled(
    requirements.map((requirement) => assembleRequirementChecked(requirement, scope, args)),
  );

  const failures = results.flatMap((result, i) =>
    result.status === "rejected" ? [{ name: requirements[i].name, reason: result.reason }] : [],
  );
  for (const { name, reason } of failures) {
    console.error(`Failed to assemble ${name}:`, reason);
  }
  if (failures.length) {
    throw new Error(`${failures.length} of ${results.length} requirements failed to assemble.`);
  }
}
