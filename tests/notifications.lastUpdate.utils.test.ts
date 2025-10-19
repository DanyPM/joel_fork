import { describe, expect, test } from "@jest/globals";
import { getLatestSourceDate } from "../notifications/lastUpdate.utils.ts";
import { JORFSearchItem } from "../entities/JORFSearchResponse.ts";

function createRecord(date: string, overrides: Partial<JORFSearchItem> = {}) {
  return {
    source_date: date,
    source_id: "id-" + date,
    source_name: "JORF",
    type_ordre: "nomination",
    nom: "Doe",
    prenom: "John",
    organisations: [],
    ...overrides
  } as JORFSearchItem;
}

describe("getLatestSourceDate", () => {
  test("returns null when there are no records", () => {
    expect(getLatestSourceDate([])).toBeNull();
  });

  test("returns the most recent publication date", () => {
    const records = [
      createRecord("2024-01-01"),
      createRecord("2023-12-12"),
      createRecord("2024-05-10"),
      createRecord("2024-03-05")
    ];

    const result = getLatestSourceDate(records);
    expect(result).not.toBeNull();
    expect(result?.toISOString().startsWith("2024-05-10")).toBe(true);
  });

  test("ignores ordering of incoming records", () => {
    const records = [
      createRecord("2024-02-02"),
      createRecord("2024-02-04"),
      createRecord("2024-02-03")
    ];

    const result = getLatestSourceDate(records);
    expect(result).not.toBeNull();
    expect(result?.toISOString().startsWith("2024-02-04")).toBe(true);
  });
});
