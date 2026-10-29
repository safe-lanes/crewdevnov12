export interface EffectivenessOption {
  id: string;
  label: string;
}

export class EffectivenessConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EffectivenessConfigurationError";
  }
}

export class AppraisalRatingVersionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppraisalRatingVersionError";
  }
}

export const DEFAULT_EFFECTIVENESS_OPTIONS: readonly EffectivenessOption[] = [
  { id: "5-exceeds-expectations", label: "5- Exceeded Expectations" },
  { id: "4-meets-expectations", label: "4- Meets Expectations" },
  { id: "3-somewhat-meets-expectations", label: "3- Somewhat Meets Expectations" },
  { id: "2-below-expectations", label: "2- Below Expectations" },
  { id: "1-significantly-below-expectations", label: "1- Significantly Below Expectations" },
];

export function defaultEffectivenessOptions(): EffectivenessOption[] {
  return DEFAULT_EFFECTIVENESS_OPTIONS.map(option => ({ ...option }));
}

export function parseEffectivenessScore(label: string): number {
  const match = /^(\d+)(?:\s*[-–—]\s*.*)?$/.exec(label.trim());
  const score = match ? Number(match[1]) : NaN;
  if (!Number.isSafeInteger(score) || score < 1) {
    throw new EffectivenessConfigurationError(
      "Each rating must start with a positive whole number that can be " +
      "represented accurately, for example: 6- Outstanding."
    );
  }
  return score;
}

export function validateEffectivenessOptions(value: unknown): EffectivenessOption[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new EffectivenessConfigurationError("At least one effectiveness option is required.");
  }
  const ids = new Set<string>();
  return value.map(item => {
    if (
      !item || typeof item !== "object" ||
      typeof item.id !== "string" || !item.id.trim() || item.id !== item.id.trim() ||
      typeof item.label !== "string" || !item.label.trim()
    ) {
      throw new EffectivenessConfigurationError(
        "Each effectiveness option must have a valid ID and label."
      );
    }
    if (ids.has(item.id)) {
      throw new EffectivenessConfigurationError("Effectiveness option IDs must be unique.");
    }
    ids.add(item.id);
    parseEffectivenessScore(item.label);
    return { id: item.id, label: item.label.trim() };
  });
}

/** Only a valid configuration object lacking the field is legacy. */
export function readEffectivenessOptions(configuration: unknown): EffectivenessOption[] | null {
  let parsed = configuration;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      throw new EffectivenessConfigurationError("The form configuration could not be read.");
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new EffectivenessConfigurationError("The form configuration is unavailable or invalid.");
  }
  if (!Object.prototype.hasOwnProperty.call(parsed, "effectivenessOptions")) return null;
  return validateEffectivenessOptions(
    (parsed as Record<string, unknown>).effectivenessOptions
  );
}

/** Preserve shared Admin endpoints' handling of unrelated legacy configuration. */
export function validateStoredEffectivenessConfiguration(configuration: unknown): void {
  let parsed = configuration;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return;
    }
  }
  if (
    !parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
    !Object.prototype.hasOwnProperty.call(parsed, "effectivenessOptions")
  ) return;
  validateEffectivenessOptions((parsed as Record<string, unknown>).effectivenessOptions);
}

const legacyScores: Record<string, number> = {
  "5-exceeds-expectations": 5,
  "4-meets-expectations": 4,
  "3-somewhat-meets-expectations": 3,
  "2-below-expectations": 2,
  "1-significantly-below-expectations": 1,
};

const aliases = new Map<string, string>();
const oldAdminValue = (label: string) =>
  label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
for (const option of DEFAULT_EFFECTIVENESS_OPTIONS) {
  aliases.set(option.id, option.id);
  aliases.set(oldAdminValue(option.label), option.id);
}
aliases.set("5-exceeded-expectations", "5-exceeds-expectations");
aliases.set("5--exceeds-expectations", "5-exceeds-expectations");
[
  "5-exceeded-set-target",
  "4-fully-met-target",
  "3-missed-target-small-margin",
  "2-missed-target-significant-margin",
  "1-failed-to-achieve-target",
].forEach((id, index) => {
  aliases.set(id, DEFAULT_EFFECTIVENESS_OPTIONS[index].id);
});

export function resolveEffectivenessOption(
  value: string,
  options: readonly EffectivenessOption[],
): EffectivenessOption | undefined {
  const exact = options.find(option => option.id === value);
  if (exact) return exact;
  const canonical = aliases.get(value);
  return canonical ? options.find(option => option.id === canonical) : undefined;
}

export function effectivenessSelectValue(
  value: string,
  options: readonly EffectivenessOption[] | null,
): string {
  if (!value || options === null) return value;
  return resolveEffectivenessOption(value, options)?.id ?? value;
}

export function getEffectivenessScore(
  value: string,
  options: readonly EffectivenessOption[] | null,
): number {
  if (options === null) return legacyScores[value] ?? 0;
  const option = resolveEffectivenessOption(value, options);
  return option ? parseEffectivenessScore(option.label) : 0;
}

export interface EffectivenessSelections {
  trainings?: readonly { evaluation?: string | null }[];
  targets?: readonly { evaluation?: string | null }[];
  competenceAssessments?: readonly { effectiveness?: string | null }[];
  behaviouralAssessments?: readonly { effectiveness?: string | null }[];
}

export function validateEffectivenessSelections(
  data: EffectivenessSelections,
  options: readonly EffectivenessOption[] | null,
): void {
  if (options === null) return;
  const values = [
    ...(data.trainings ?? []).map(row => row.evaluation),
    ...(data.targets ?? []).map(row => row.evaluation),
    ...(data.competenceAssessments ?? []).map(row => row.effectiveness),
    ...(data.behaviouralAssessments ?? []).map(row => row.effectiveness),
  ];
  if (values.some(value => !!value && !resolveEffectivenessOption(value, options))) {
    throw new EffectivenessConfigurationError(
      "An effectiveness selection is not available in this form version. " +
      "Please select a valid rating."
    );
  }
}
