import { describe, expect, it } from "vitest";
import {
  defaultEffectivenessOptions,
  EffectivenessConfigurationError,
  effectivenessSelectValue,
  getEffectivenessScore,
  readEffectivenessOptions,
  validateEffectivenessOptions,
  validateEffectivenessSelections,
  validateStoredEffectivenessConfiguration,
} from "@shared/appraisal-effectiveness";

describe("configurable appraisal effectiveness ratings", () => {
  it("uses custom numeric labels for scoring while preserving stable option IDs", () => {
    const options = readEffectivenessOptions(JSON.stringify({ effectivenessOptions: [
      { id: "rating-a", label: " 6- Outstanding " },
      { id: "rating-b", label: "2- Needs improvement" },
    ] }))!;
    expect(options[0]).toEqual({ id: "rating-a", label: "6- Outstanding" });
    expect(effectivenessSelectValue("rating-a", options)).toBe("rating-a");
    expect(getEffectivenessScore("rating-a", options)).toBe(6);
    const renamedOptions = options.map(option => option.id === "rating-a"
      ? { ...option, label: "7- Exceptional" } : option);
    expect(effectivenessSelectValue("rating-a", renamedOptions)).toBe("rating-a");
    expect(getEffectivenessScore("rating-a", renamedOptions)).toBe(7);
  });

  it("accepts saved legacy aliases when a form now declares the matching default options", () => {
    const options = defaultEffectivenessOptions();
    expect(effectivenessSelectValue("5-exceeded-expectations", options)).toBe("5-exceeds-expectations");
    expect(effectivenessSelectValue("4-fully-met-target", options)).toBe("4-meets-expectations");
    expect(getEffectivenessScore("5-exceeded-expectations", options)).toBe(5);
    expect(getEffectivenessScore("4-fully-met-target", options)).toBe(4);
    expect(() => validateEffectivenessSelections({
      trainings: [{ evaluation: "5-exceeded-expectations" }],
      targets: [{ evaluation: "4-fully-met-target" }],
      competenceAssessments: [{ effectiveness: "3-somewhat-meets-expectations" }],
      behaviouralAssessments: [{ effectiveness: "2-below-expectations" }],
    }, options)).not.toThrow();
  });

  it("preserves historical scoring and selections for configurations without custom options", () => {
    const options = readEffectivenessOptions({ competenceAssessment: [] });
    expect(options).toBeNull();
    expect(getEffectivenessScore("5-exceeds-expectations", options)).toBe(5);
    expect(getEffectivenessScore("unknown-historical-value", options)).toBe(0);
    expect(effectivenessSelectValue("4-fully-met-target", options)).toBe("4-fully-met-target");
    expect(() => validateEffectivenessSelections({
      trainings: [{ evaluation: "unknown-historical-value" }],
    }, options)).not.toThrow();
  });

  it.each([
    ["empty options", []],
    ["duplicate IDs", [{ id: "same", label: "5- Good" }, { id: "same", label: "4- Fair" }]],
    ["missing stable ID", [{ id: " ", label: "5- Good" }]],
    ["nonnumeric rating", [{ id: "a", label: "Excellent" }]],
    ["zero rating", [{ id: "a", label: "0- None" }]],
  ])("rejects %s", (_name, options) => {
    expect(() => validateEffectivenessOptions(options)).toThrow(EffectivenessConfigurationError);
  });

  it("rejects a saved selection belonging to another form version", () => {
    const options = [{ id: "current-rating", label: "6- Outstanding" }];
    expect(() => validateEffectivenessSelections({
      targets: [{ evaluation: "previous-rating" }],
    }, options)).toThrow(EffectivenessConfigurationError);
    expect(getEffectivenessScore("previous-rating", options)).toBe(0);
    expect(() => validateEffectivenessSelections({
      targets: [{ evaluation: "current-rating" }, { evaluation: "" }],
    }, options)).not.toThrow();
  });

  it("accepts nullable unrated values read from persisted appraisal rows", () => {
    expect(() => validateEffectivenessSelections({
      trainings: [{ evaluation: null }],
      targets: [{ evaluation: null }],
      competenceAssessments: [{ effectiveness: null }],
      behaviouralAssessments: [{ effectiveness: null }],
    }, defaultEffectivenessOptions())).not.toThrow();
  });

  it("distinguishes an unavailable configuration from an explicit legacy configuration", () => {
    expect(() => readEffectivenessOptions(null)).toThrow(EffectivenessConfigurationError);
    expect(() => readEffectivenessOptions("invalid JSON")).toThrow(EffectivenessConfigurationError);
    expect(() => readEffectivenessOptions({ effectivenessOptions: null })).toThrow(EffectivenessConfigurationError);
    expect(() => validateStoredEffectivenessConfiguration(null)).not.toThrow();
    expect(() => validateStoredEffectivenessConfiguration({ unrelatedLegacySetting: true })).not.toThrow();
    expect(() => validateStoredEffectivenessConfiguration({ effectivenessOptions: [] }))
      .toThrow(EffectivenessConfigurationError);
  });
});
