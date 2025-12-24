import { describe, expect, it } from "@jest/globals";
import {
  dateToFrenchString,
  dateToString,
  JORFtoDate,
  getISOWeek,
  daysBetweenCalendar
} from "../utils/date.utils.ts";

describe("date.utils", () => {
  describe("dateToFrenchString", () => {
    it("converts ISO date to French format", () => {
      const result = dateToFrenchString("2021-08-25T00:00:00.000Z");
      expect(result).toContain("2021");
      expect(result).toContain("25");
      // Month name will be in French
    });

    it("handles different dates", () => {
      const result = dateToFrenchString("2023-01-01T00:00:00.000Z");
      expect(result).toContain("2023");
      expect(result).toContain("1");
    });
  });

  describe("dateToString", () => {
    it("formats date in YMD format", () => {
      const date = new Date(2023, 0, 15); // January 15, 2023
      const result = dateToString(date, "YMD");
      expect(result).toBe("2023-01-15");
    });

    it("formats date in DMY format", () => {
      const date = new Date(2023, 0, 15); // January 15, 2023
      const result = dateToString(date, "DMY");
      expect(result).toBe("15-01-2023");
    });

    it("pads single-digit days and months", () => {
      const date = new Date(2023, 0, 5); // January 5, 2023
      expect(dateToString(date, "YMD")).toBe("2023-01-05");
      expect(dateToString(date, "DMY")).toBe("05-01-2023");
    });

    it("does not mutate the original date", () => {
      const originalDate = new Date(2023, 0, 15);
      const originalTime = originalDate.getTime();
      dateToString(originalDate, "YMD");
      expect(originalDate.getTime()).toBe(originalTime);
    });
  });

  describe("JORFtoDate", () => {
    it("converts JORF date string to Date object", () => {
      const result = JORFtoDate("2023-03-15");
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(2); // March is month 2 (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it("handles different dates", () => {
      const result = JORFtoDate("2021-12-25");
      expect(result.getFullYear()).toBe(2021);
      expect(result.getMonth()).toBe(11); // December is month 11
      expect(result.getDate()).toBe(25);
    });

    it("handles dates with leading zeros", () => {
      const result = JORFtoDate("2023-01-05");
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(5);
    });
  });

  describe("getISOWeek", () => {
    it("calculates ISO week number for middle of year", () => {
      const date = new Date(2023, 5, 15); // June 15, 2023
      const result = getISOWeek(date);
      expect(result).toMatch(/^2023-W\d{1,2}$/);
    });

    it("handles week 1", () => {
      const date = new Date(2023, 0, 2); // January 2, 2023
      const result = getISOWeek(date);
      expect(result).toContain("2023");
      expect(result).toContain("W");
    });

    it("handles last week of year", () => {
      const date = new Date(2023, 11, 30); // December 30, 2023
      const result = getISOWeek(date);
      expect(result).toMatch(/^202[34]-W\d{1,2}$/); // Could be 2023 or 2024 depending on ISO week
    });

    it("returns consistent format", () => {
      const date = new Date(2023, 6, 15);
      const result = getISOWeek(date);
      expect(result).toMatch(/^\d{4}-W\d{1,2}$/);
    });

    it("does not mutate the original date", () => {
      const originalDate = new Date(2023, 5, 15);
      const originalTime = originalDate.getTime();
      getISOWeek(originalDate);
      expect(originalDate.getTime()).toBe(originalTime);
    });
  });

  describe("daysBetweenCalendar", () => {
    it("calculates days between same date as 0", () => {
      const date = new Date(2023, 5, 15);
      expect(daysBetweenCalendar(date, date)).toBe(0);
    });

    it("calculates days between consecutive dates", () => {
      const date1 = new Date(2023, 5, 15);
      const date2 = new Date(2023, 5, 16);
      expect(daysBetweenCalendar(date1, date2)).toBe(1);
    });

    it("calculates negative days for reverse order", () => {
      const date1 = new Date(2023, 5, 16);
      const date2 = new Date(2023, 5, 15);
      expect(daysBetweenCalendar(date1, date2)).toBe(-1);
    });

    it("calculates days across months", () => {
      const date1 = new Date(2023, 0, 31); // Jan 31
      const date2 = new Date(2023, 1, 1); // Feb 1
      expect(daysBetweenCalendar(date1, date2)).toBe(1);
    });

    it("calculates days across years", () => {
      const date1 = new Date(2022, 11, 31); // Dec 31, 2022
      const date2 = new Date(2023, 0, 1); // Jan 1, 2023
      expect(daysBetweenCalendar(date1, date2)).toBe(1);
    });

    it("ignores time components", () => {
      const date1 = new Date(2023, 5, 15, 10, 30, 0);
      const date2 = new Date(2023, 5, 16, 22, 45, 30);
      expect(daysBetweenCalendar(date1, date2)).toBe(1);
    });

    it("calculates days for dates far apart", () => {
      const date1 = new Date(2023, 0, 1);
      const date2 = new Date(2023, 11, 31);
      expect(daysBetweenCalendar(date1, date2)).toBe(364);
    });
  });
});
