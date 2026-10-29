import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { appraisalRatings, sectionRating } from "@shared/v2/appraisals/appraisalRatings";

// APD-49: the ratings formula was copied in the form (once for the screen, once
// for what it saved). There is now one copy, shared by the form and the server.

const row = (effectiveness: string | null, weight: number | string | null) => ({ effectiveness, weight });

describe("sectionRating", () => {
  it("is the weighted average of the rated rows, to one decimal place", () => {
    expect(sectionRating([row("5-exceeds-expectations", 50), row("1-significantly-below-expectations", 50)])).toBe("3.0");
    expect(sectionRating([row("4-meets-expectations", 30), row("2-below-expectations", 70)])).toBe("2.6");
    expect(sectionRating([row("3-somewhat-meets-expectations", 100)])).toBe("3.0");
  });

  it("leaves out rows without an effectiveness or a weight", () => {
    expect(sectionRating([
      row("5-exceeds-expectations", 40),
      row(null, 30),
      row("", 30),
      row("1-significantly-below-expectations", 0),
      row("1-significantly-below-expectations", null),
    ])).toBe("5.0");
  });

  it("is null when no row is rated", () => {
    expect(sectionRating([])).toBeNull();
    expect(sectionRating(undefined)).toBeNull();
    expect(sectionRating([row(null, 50), row("", 50)])).toBeNull();
  });

  it("reads a weight sent as text as a number", () => {
    expect(sectionRating([row("5-exceeds-expectations", "50"), row("1-significantly-below-expectations", "50")])).toBe("3.0");
  });

  it("counts an unknown effectiveness with its weight and a rating of 0, as the form always did", () => {
    expect(sectionRating([row("5-exceeds-expectations", 50), row("5--exceeded-expectations", 50)])).toBe("2.5");
  });
});

describe("appraisalRatings", () => {
  const c = [row("4-meets-expectations", 100)];
  const d = [row("2-below-expectations", 100)];

  it("gives each section's rating and their average", () => {
    expect(appraisalRatings({ competenceAssessments: c, behaviouralAssessments: d }))
      .toEqual({ competenceRating: "4.0", behavioralRating: "2.0", overallRating: "3.0" });
  });

  it("leaves an unrated section out of the overall", () => {
    expect(appraisalRatings({ competenceAssessments: c, behaviouralAssessments: [] }))
      .toEqual({ competenceRating: "4.0", behavioralRating: null, overallRating: "4.0" });
    expect(appraisalRatings({ competenceAssessments: [], behaviouralAssessments: d }))
      .toEqual({ competenceRating: null, behavioralRating: "2.0", overallRating: "2.0" });
  });

  it("leaves a section that scores 0 out of the overall", () => {
    expect(appraisalRatings({ competenceAssessments: c, behaviouralAssessments: [row("unknown", 100)] }))
      .toEqual({ competenceRating: "4.0", behavioralRating: "0.0", overallRating: "4.0" });
  });

  it("is all null when nothing is rated", () => {
    expect(appraisalRatings({})).toEqual({ competenceRating: null, behavioralRating: null, overallRating: null });
  });
});

describe("the appraisal form", () => {
  const source = readFileSync(join(__dirname, "../../client/src/modules/crewing/AppraisalForm_v2.tsx"), "utf-8");

  it("has no ratings formula of its own", () => {
    expect(source).not.toMatch(/case\s+"5-exceeds-expectations"/);
  });

  it("sends no ratings: the server derives them", () => {
    expect(source).not.toMatch(/\b(competenceRating|behavioralRating|overallRating)\s*:/);
  });
});
