import { describe, it, expect } from "vitest";

import {
  formatHistoricalDecade,
  formatHistoricalYear,
  formatHistoricalYearRange,
} from "../year";

describe("formatHistoricalYear", () => {
  it("formats positive years as plain numbers", () => {
    expect(formatHistoricalYear(1453)).toBe("1453");
    expect(formatHistoricalYear(2024)).toBe("2024");
  });

  it("formats negative years with a 'BC' suffix and no minus sign", () => {
    expect(formatHistoricalYear(-44)).toBe("44 BC");
    expect(formatHistoricalYear(-2000)).toBe("2000 BC");
  });

  it("accepts numeric strings", () => {
    expect(formatHistoricalYear("1500")).toBe("1500");
    expect(formatHistoricalYear("-300")).toBe("300 BC");
  });

  it("returns empty string for null, undefined, empty, or non-numeric input", () => {
    expect(formatHistoricalYear(null)).toBe("");
    expect(formatHistoricalYear(undefined)).toBe("");
    expect(formatHistoricalYear("")).toBe("");
    expect(formatHistoricalYear("abc")).toBe("");
    expect(formatHistoricalYear(NaN)).toBe("");
  });

  it("renders zero as '0' (no calendar year zero, treat literally)", () => {
    expect(formatHistoricalYear(0)).toBe("0");
  });
});

describe("formatHistoricalYearRange", () => {
  it("formats AD-only ranges as 'start–end'", () => {
    expect(formatHistoricalYearRange(1400, 1500)).toBe("1400–1500");
  });

  it("collapses BC suffix to one side when both ends are BC", () => {
    expect(formatHistoricalYearRange(-300, -100)).toBe("300–100 BC");
  });

  it("emits both era suffixes when the range crosses BC/AD", () => {
    expect(formatHistoricalYearRange(-100, 50)).toBe("100 BC – 50 AD");
  });

  it("formats reversed cross-era input symmetrically (no raw negative leak)", () => {
    expect(formatHistoricalYearRange(50, -100)).toBe("50 AD – 100 BC");
  });

  it("returns empty string when either end is missing", () => {
    expect(formatHistoricalYearRange(null, 1500)).toBe("");
    expect(formatHistoricalYearRange(1500, null)).toBe("");
    expect(formatHistoricalYearRange("", "")).toBe("");
  });
});

describe("formatHistoricalDecade", () => {
  it("formats AD decades with 's' suffix", () => {
    expect(formatHistoricalDecade(1980)).toBe("1980s");
    expect(formatHistoricalDecade(1875)).toBe("1870s");
  });

  it("formats BC decades with 's BC' suffix and no minus sign", () => {
    expect(formatHistoricalDecade(-50)).toBe("50s BC");
    expect(formatHistoricalDecade(-444)).toBe("450s BC");
  });

  it("returns empty string for missing input", () => {
    expect(formatHistoricalDecade(null)).toBe("");
    expect(formatHistoricalDecade(undefined)).toBe("");
    expect(formatHistoricalDecade("")).toBe("");
  });
});
