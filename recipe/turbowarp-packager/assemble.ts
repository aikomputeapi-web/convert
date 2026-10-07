import { $ } from "bun";
import { cp } from "fs/promises";
import { join } from "path";

await $`bun ci`;
await $`bun run build-node-prod`;
await cp("dist", process.env.OUT_DIR!, { recursive: true });
await cp(join(import.meta.dir, "packager.d.ts"), `${process.env.OUT_DIR!}/packager.d.ts`);
