import { describe, expect, it } from "@jest/globals";
import {
  JORFtoDate,
  dateTOJORFFormat,
  dateToFrenchString,
  getISOWeek
} from "../utils/date.utils.ts";

describe("dateToFrenchString", () => {
  it("formats ISO strings using French locale", () => {
    expect(dateToFrenchString("2021-08-25T00:00:00.000Z")).toBe("25 août 2021");
  });
});

describe("dateTOJORFFormat", () => {
  it("zeroes time components and returns dd-mm-yyyy", () => {
    const date = new Date("2024-02-18T10:30:00.000Z");
    expect(dateTOJORFFormat(date)).toBe("18-02-2024");
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });
});

describe("JORFtoDate", () => {
  it("parses yyyy-mm-dd strings", () => {
    const date = JORFtoDate("2024-02-18");
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(18);
  });
});

describe("getISOWeek", () => {
  it("returns ISO week notation for year boundaries", () => {
    expect(getISOWeek(new Date("2020-12-31T00:00:00.000Z"))).toBe("2020-W53");
    expect(getISOWeek(new Date("2021-01-04T00:00:00.000Z"))).toBe("2021-W1");
  });
});
