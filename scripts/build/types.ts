type Source = {
  url: `https://${string}`;
  hash: [Bun.SupportedCryptoAlgorithms, string];
  patches?: string[];
};

// all of a source or none of it
type MaybeSource = Source | { [K in keyof Source]?: never };

type Subrecipe<Script> = { name: string } & Script & MaybeSource;

export type SourceRequirement = { name: string } & Source;
export type AssembleRequirement = Subrecipe<{ assemble: string }>;
export type PrebuildRequirement = Subrecipe<{
  prebuild: string;
  image: `${string}@sha256:${string}`;
}>;

export type SubrecipeRequirement = AssembleRequirement | PrebuildRequirement;
export type Requirement = SourceRequirement | SubrecipeRequirement;
export type RequirementsConfig = Requirement[];

export function hasSource(requirement: Requirement): requirement is SourceRequirement {
  return requirement.url !== undefined;
}

export function isSubrecipe(requirement: Requirement): requirement is SubrecipeRequirement {
  return "assemble" in requirement || "prebuild" in requirement;
}

export function isAssembled(requirement: Requirement): requirement is AssembleRequirement {
  return "assemble" in requirement;
}

export function isPrebuilt(requirement: Requirement): requirement is PrebuildRequirement {
  return "prebuild" in requirement;
}
