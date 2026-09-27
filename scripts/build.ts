import { defineCommand, runMain } from "citty";
import { ROOT_SCOPE, assembleAll, assembleArgs, loadRequirements } from "./build/assemble";

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

const main = defineCommand({
  meta: { name: "convert-build", description: "The convert build system" },
  subCommands: { assemble },
});

await runMain(main);
