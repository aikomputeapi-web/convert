import { defineCommand, runMain } from "citty";
import { assembleAll, assembleArgs } from "./build/assemble";
import { ROOT_SCOPE, loadRequirements } from "./build/common";
import { prebuildAll, prebuildArgs } from "./build/prebuild";

const assemble = defineCommand({
  meta: { name: "assemble", description: "Prepare all requirements for use" },
  args: assembleArgs,
  async run({ args }) {
    const start = performance.now();
    await assembleAll(await loadRequirements(ROOT_SCOPE.recipeDir), ROOT_SCOPE, args);
    const end = performance.now();
    console.log(`Assembled in ${(end - start).toFixed(2)} ms.`);
  },
});

const prebuild = defineCommand({
  meta: { name: "prebuild", description: "Build prebuilt subrecipes in docker" },
  args: prebuildArgs,
  async run({ args }) {
    const start = performance.now();
    await prebuildAll(await loadRequirements(ROOT_SCOPE.recipeDir), ROOT_SCOPE, args);
    const end = performance.now();
    console.log(`Prebuilt in ${(end - start).toFixed(2)} ms.`);
  },
});

const main = defineCommand({
  meta: { name: "convert-build", description: "The convert build system" },
  subCommands: { assemble, prebuild },
});

await runMain(main);
