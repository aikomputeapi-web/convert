import { defineCommand, runMain } from "citty";
import { assembleAll, assembleArgs } from "./build/assemble";
import { ROOT_SCOPE, loadRequirements, selectArgs, selectRequirements } from "./build/common";
import { prebuildAll, prebuildArgs } from "./build/prebuild";
import { isSubrecipe } from "./build/types";

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
    await prebuildAll(requirements, ROOT_SCOPE, args, args.all);
    const end = performance.now();
    console.log(`Prebuilt in ${(end - start).toFixed(2)} ms.`);
  },
});

const main = defineCommand({
  meta: { name: "convert-build", description: "The convert build system" },
  subCommands: { assemble, prebuild },
});

await runMain(main);
