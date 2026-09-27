import type { RequirementsConfig } from "../../scripts/build/types";

export default [
  {
    name: "libopenmpt",
    url: "https://lib.openmpt.org/files/libopenmpt/src/libopenmpt-0.8.9+release.makefile.tar.gz",
    hash: ["sha256", "9273b88b67973cc69e54d748ab1b749399d6d07695f1c37d0c59f88b4106074f"],
  },
] satisfies RequirementsConfig;
