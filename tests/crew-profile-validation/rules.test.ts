import { describe, expect, it } from "vitest";
import { calendarToday, validateCrewDob, validateCrewProfile, validateProfileEmail, validateRecruitmentDate } from "../../shared/v2/crew-pool/profileValidation";
import { validateMobileNumber } from "../../client/src/modules/recruitment/countryDialingCodes";

describe("Existing B1–B3 rules", () => {
  it.each([
    ["",""],["2026-11-17",""],["2026-11-16",""],
    ["2026-11-18","future"],["2026-02-30","valid Date"],["bad","valid Date"],["0000-01-01","valid Date"],
  ])("validates recruitment date %s against the calendar day", (value,message)=>{
    const result=validateRecruitmentDate(value,"2026-11-17");
    message?expect(result).toContain(message):expect(result).toBe("");
  });
  it("rejects future recruitment in shared B1 saves without tightening other sections",()=>{
    const values={firstName:"Crew",recruitmentDate:"2026-11-18"};
    expect(validateCrewProfile(values,["B1"],{today:"2026-11-17"}).recruitmentDate).toContain("future");
    expect(validateCrewProfile(values,["B2"],{today:"2026-11-17"})).toEqual({});
  });
  it.each([
    ["", ""], ["2008-11-17", ""], ["2008-11-18", "at least 18"],
    ["1990-01-01", ""], ["2027-01-01", "future"], ["2008-02-30", "valid date"],
  ])("checks DOB %s by calendar day", (dob, expected) => {
    const result = validateCrewDob(dob, "2026-11-17");
    expected ? expect(result).toContain(expected) : expect(result).toBe("");
  });
  it("handles leap dates without accepting a birthday early", () => {
    expect(validateCrewDob("2006-03-01", "2024-02-29")).toContain("18");
    expect(validateCrewDob("2008-02-29", "2026-02-28")).toContain("18");
    expect(validateCrewDob("2008-02-29", "2026-03-01")).toBe("");
    expect(calendarToday(new Date(2026, 10, 17, 0, 0))).toBe("2026-11-17");
  });
  it.each(["bad", "two words@example.com", "test@host"])("rejects email %s", email => {
    expect(validateProfileEmail(email)).not.toBe("");
  });
  it("keeps optional fields optional and scopes independent saves", () => {
    expect(validateCrewProfile({ firstName: "Crew" }, ["B1"])).toEqual({});
    expect(validateCrewProfile({ dateOfBirth: "2020-01-01" }, ["B2"])).toEqual({});
    expect(validateCrewProfile({}, ["B2", "B3"])).toEqual({});
  });
  it("preserves required names and recruitment date without extra rules", () => {
    expect(validateCrewProfile({firstName:" "}, ["B1"], {requireRecruitmentDate:true}))
      .toHaveProperty("recruitmentDate");
    expect(validateCrewProfile({firstName:" "}, ["B1"])).toHaveProperty("firstName");
  });
  it("uses the exact existing country-dependent mobile rules", () => {
    expect(validateCrewProfile({countryOfResidence:"INDIA", mobile:"+91 123", email:"bad"}, ["B2"], {mobileValidator:validateMobileNumber}))
      .toMatchObject({ mobile: expect.stringContaining("10 digits"), email: expect.any(String) });
    expect(validateCrewProfile({countryOfResidence:"INDIA", mobile:"+91 9876543210"}, ["B2"], {mobileValidator:validateMobileNumber})).toEqual({});
  });
  it("preserves Married-only spouse requirements and NOK email", () => {
    expect(validateCrewProfile({maritalStatus:"Married", nokEmail:"bad", spouseDateOfBirth:"2099-01-01"},["B3"]))
      .toMatchObject({spouseFirstName:expect.any(String),spouseFamilyName:expect.any(String),spouseDateOfBirth:expect.any(String),nokEmail:expect.any(String)});
    expect(validateCrewProfile({maritalStatus:"Single",spouseDateOfBirth:"2099-01-01"},["B3"])).toEqual({});
  });
});
