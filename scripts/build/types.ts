export type SourceRequirement = {
  name: string;
  url: `https://${string}.tar.gz`; // only tar gz for now
  hash: [Bun.SupportedCryptoAlgorithms, string];
  patches?: string[];
};

export type AssembleSubrecipeRequirement = {
  name: string;
  assemble: string;
};

export type PrebuildSubrecipeRequirement = {
  name: string;
  prebuild: string;
  image: `${string}@sha256:${string}`;
};

export type SubrecipeRequirement = AssembleSubrecipeRequirement | PrebuildSubrecipeRequirement;

export type Requirement = SourceRequirement | SubrecipeRequirement;

export type RequirementsConfig = Requirement[];

export function isSubrecipe(requirement: Requirement): requirement is SubrecipeRequirement {
  return "assemble" in requirement || "prebuild" in requirement;
}

export function isPrebuilt(requirement: Requirement): requirement is PrebuildSubrecipeRequirement {
  return "prebuild" in requirement;
}
