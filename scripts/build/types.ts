export type SourceRequirement = {
  name: string;
  url: `https://${string}.tar.gz`; // only tar gz for now
  hash: [Bun.SupportedCryptoAlgorithms, string];
  patches?: string[];
};

export type SubrecipeRequirement = {
  name: string;
  assemble: string;
};

export type Requirement = SourceRequirement | SubrecipeRequirement;

export type RequirementsConfig = Requirement[];

export function isSubrecipe(requirement: Requirement): requirement is SubrecipeRequirement {
  return "assemble" in requirement;
}
