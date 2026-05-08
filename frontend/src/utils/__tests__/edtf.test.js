import { describe, it, expect } from "vitest";

import { toEDTF, toISO8601 } from "../edtf";

describe("toEDTF", () => {
  it("formats exact_year as a plain year", () => {
    expect(toEDTF({ time_type: "exact_year", year: 1965 })).toBe("1965");
  });

  it("formats approximate_year with the EDTF '~' suffix", () => {
    expect(toEDTF({ time_type: "approximate_year", year: 1965 })).toBe("1965~");
  });

  it("formats decade as the EDTF 'X' form", () => {
    expect(toEDTF({ time_type: "decade", year: 1960 })).toBe("196X");
    expect(toEDTF({ time_type: "decade", year: 1875 })).toBe("187X");
  });

  it("formats year_range as start/end", () => {
    expect(
      toEDTF({ time_type: "year_range", year_start: 1950, year_end: 1975 })
    ).toBe("1950/1975");
  });

  it("formats exact_date without a time as YYYY-MM-DD", () => {
    expect(
      toEDTF({ time_type: "exact_date", date_value: "1965-04-12" })
    ).toBe("1965-04-12");
  });

  it("formats exact_date with a time as YYYY-MM-DDTHH:MM", () => {
    expect(
      toEDTF({
        time_type: "exact_date",
        date_value: "1965-04-12",
        time_value: "14:30",
      })
    ).toBe("1965-04-12T14:30");
  });

  it("returns undefined for missing required fields", () => {
    expect(toEDTF({ time_type: "exact_year" })).toBeUndefined();
    expect(toEDTF({ time_type: "year_range", year_start: 1950 })).toBeUndefined();
    expect(toEDTF({ time_type: "exact_date" })).toBeUndefined();
    expect(toEDTF({ time_type: "unknown", year: 1900 })).toBeUndefined();
  });
});

describe("toISO8601", () => {
  it("renders approximate_year as the bare year (lossy)", () => {
    expect(toISO8601({ time_type: "approximate_year", year: 1965 })).toBe("1965");
  });

  it("renders a decade as a closed ISO 8601 interval", () => {
    expect(toISO8601({ time_type: "decade", year: 1960 })).toBe("1960/1969");
    expect(toISO8601({ time_type: "decade", year: 1875 })).toBe("1870/1879");
  });

  it("renders year_range identically to EDTF", () => {
    expect(
      toISO8601({ time_type: "year_range", year_start: 1950, year_end: 1975 })
    ).toBe("1950/1975");
  });

  it("renders exact_date and exact_year unchanged", () => {
    expect(toISO8601({ time_type: "exact_year", year: 1965 })).toBe("1965");
    expect(
      toISO8601({ time_type: "exact_date", date_value: "1965-04-12" })
    ).toBe("1965-04-12");
    expect(
      toISO8601({
        time_type: "exact_date",
        date_value: "1965-04-12",
        time_value: "14:30",
      })
    ).toBe("1965-04-12T14:30");
  });
});
