import { join } from "path";
import { mkdir, readdir, rm } from "fs/promises";
import { $ } from "bun";
import type { ArgsDef, ParsedArgs } from "citty";
import { assembleAll } from "./assemble";
import {
  CACHE_DIR,
  PACK_IMAGE,
  findPrebuilts,
  loadRequirements,
  prebuiltPath,
  subrecipeScope,
  type Scope,
} from "./common";
import { hashFile, hashInputs } from "./hash";
import {
  isPrebuilt,
  isSubrecipe,
  type PrebuildSubrecipeRequirement,
  type RequirementsConfig,
} from "./types";

const PLATFORM = "linux/amd64";

export const prebuildArgs = {
  verbose: { type: "boolean", description: "Be louder" },
  force: { type: "boolean", description: "Rebuild, even if the inputs didn't change" },
} as const satisfies ArgsDef;

export type PrebuildArgs = ParsedArgs<typeof prebuildArgs>;

function dockerRun(image: string, mounts: Record<string, string>, env: Record<string, string>) {
  const args = ["run", "--rm", "--network=none", `--platform=${PLATFORM}`];
  const uid = process.getuid?.();
  const gid = process.getgid?.();
  if (uid !== undefined && gid !== undefined) args.push(`--user=${uid}:${gid}`);
  for (const [host, container] of Object.entries(mounts)) args.push("-v", `${host}:${container}`);
  for (const [key, value] of Object.entries({
    HOME: "/tmp",
    SOURCE_DATE_EPOCH: "0",
    TZ: "UTC",
    LC_ALL: "C",
    ...env,
  })) {
    args.push("-e", `${key}=${value}`);
  }
  return (command: string[]) => $`docker ${args} ${image} ${command}`;
}

async function prebuild(
  requirement: PrebuildSubrecipeRequirement,
  scope: Scope,
  args: PrebuildArgs,
) {
  const inputs = await hashInputs(requirement, scope);
  const existing = await findPrebuilts(requirement, scope);
  if (!args.force && existing.some((prebuilt) => prebuilt.inputs === inputs)) {
    if (args.verbose) console.log(`Prebuilt ${requirement.name} is up to date.`);
    return;
  }

  const sub = subrecipeScope(scope, requirement.name);
  await assembleAll(await loadRequirements(sub.recipeDir), sub, { verbose: args.verbose });

  const tmp = join(CACHE_DIR, `prebuild-${crypto.randomUUID()}`);
  const buildDir = join(tmp, "build");
  const outDir = join(tmp, "out");
  await mkdir(outDir, { recursive: true });

  try {
    // the build gets its own copy of the sources, so it can build in-tree
    await $`cp -R ${sub.outDir} ${buildDir}`;

    console.log(`Prebuilding ${requirement.name} in ${requirement.image}...`);
    await dockerRun(
      requirement.image,
      { [sub.recipeDir]: "/recipe:ro", [buildDir]: "/build", [outDir]: "/out" },
      { OUT_DIR: "/out" },
    )(["sh", "-euc", `cd /build && exec sh -eu "/recipe/$1"`, "sh", requirement.prebuild]);

    if (!(await readdir(outDir)).length) {
      throw new Error(`Prebuild script for ${requirement.name} produced no output.`);
    }

    await dockerRun(
      PACK_IMAGE,
      { [tmp]: "/pack" },
      {},
    )([
      "sh",
      "-euc",
      `cd /pack && tar --sort=name --mtime=@0 --owner=0 --group=0 --numeric-owner \
        --mode=a+rX,u+w,go-w --format=gnu -cf - out | gzip -9n > out.tar.gz`,
    ]);

    const tarball = await Bun.file(join(tmp, "out.tar.gz")).bytes();
    for (const { path } of existing) await rm(path);
    await Bun.write(prebuiltPath(requirement, scope, inputs), tarball);
    console.log(`Prebuilt ${requirement.name} (sha256 ${hashFile("sha256", tarball)}).`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

export async function prebuildAll(
  requirements: RequirementsConfig,
  scope: Scope,
  args: PrebuildArgs,
) {
  // one at a time, builds are heavy
  for (const requirement of requirements) {
    if (!isSubrecipe(requirement)) continue;
    const sub = subrecipeScope(scope, requirement.name);
    await prebuildAll(await loadRequirements(sub.recipeDir), sub, args);
    if (isPrebuilt(requirement)) await prebuild(requirement, scope, args);
  }
}
