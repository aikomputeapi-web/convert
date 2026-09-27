import { relative } from "path";
import { defineCommand, runMain } from "citty";
import { assembleAll, assembleArgs } from "./build/assemble";
import {
  ROOT_SCOPE,
  findPrebuilts,
  loadRequirements,
  selectArgs,
  selectRequirements,
  subrecipeScope,
  type Scope,
} from "./build/common";
import { hashInputs } from "./build/hash";
import { prebuildAll, prebuildArgs } from "./build/prebuild";
import { isPrebuilt, isSubrecipe, type RequirementsConfig } from "./build/types";

const assemble = defineCommand({
  meta: { name: "assemble", description: "Prepare requirements for use" },
  args: { ...selectArgs, ...assembleArgs },
  async run({ args }) {
    const start = performance.now();
    const requirements = selectRequirements(
      await loadRequirements(ROOT_SCOPE.recipeDir),
      args._,
      args.all,
    );
    await assembleAll(requirements, ROOT_SCOPE, args);
    const end = performance.now();
    console.log(`Assembled in ${(end - start).toFixed(2)} ms.`);
  },
});

const prebuild = defineCommand({
  meta: { name: "prebuild", description: "Build prebuilt subrecipes in docker" },
  args: { ...selectArgs, ...prebuildArgs },
  async run({ args }) {
    const start = performance.now();
    const requirements = selectRequirements(
      await loadRequirements(ROOT_SCOPE.recipeDir),
      args._,
      args.all,
    );
    const nothing = requirements.filter((requirement) => !isSubrecipe(requirement));
    if (!args.all && nothing.length) {
      throw new Error(`Nothing to prebuild in ${nothing.map(({ name }) => name).join(", ")}.`);
    }
    await prebuildAll(requirements, ROOT_SCOPE, args, args.all ?? false);
    const end = performance.now();
    console.log(`Prebuilt in ${(end - start).toFixed(2)} ms.`);
  },
});

async function checkAll(requirements: RequirementsConfig, scope: Scope) {
  for (const requirement of requirements) {
    if (isPrebuilt(requirement)) {
      const inputs = await hashInputs(requirement, scope);
      const prebuilts = await findPrebuilts(requirement, scope);
      if (!prebuilts.some((prebuilt) => prebuilt.inputs === inputs)) {
        throw new Error(
          `Prebuilt ${requirement.name} is missing or stale, run \`bun run build:prebuild ${requirement.name}\`.`,
        );
      }
      const stale = prebuilts.find((prebuilt) => prebuilt.inputs !== inputs);
      if (stale)
        throw new Error(
          `Found stale prebuilt ${relative(scope.prebuiltDir, stale.path)}, run \`bun run build:prebuild ${requirement.name}\`.`,
        );
    } else if (isSubrecipe(requirement)) {
      const sub = subrecipeScope(scope, requirement.name);
      await checkAll(await loadRequirements(sub.recipeDir), sub);
    }
  }
}

const check = defineCommand({
  meta: { name: "check", description: "Verify everything is up to date" },
  async run() {
    await checkAll(await loadRequirements(ROOT_SCOPE.recipeDir), ROOT_SCOPE);
    console.log("Up to date.");
  },
});

const main = defineCommand({
  meta: { name: "convert-build", description: "The convert build system" },
  subCommands: { assemble, prebuild, check },
});

await runMain(main);
