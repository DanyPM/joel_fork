import { describe, expect, it } from "@jest/globals";
import {
  convertToCSV,
  escapeRegExp,
  markdown2WHMarkdown,
  markdown2html,
  markdown2plainText,
  parseIntAnswers,
  removeSpecialCharacters,
  splitText,
  trimStrings
} from "../utils/text.utils.ts";

const sampleObjects = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 }
] as unknown as never[];

describe("splitText", () => {
  it("respects newline and whitespace boundaries when chunking", () => {
    const text = "\nfirst line\nsecond line\nthird";
    expect(splitText(text, 12)).toEqual([
      "first line",
      "second line",
      "third"
    ]);
  });

  it("falls back to hard cuts when necessary", () => {
    expect(splitText("abcdef", 3)).toEqual(["abc", "def"]);
  });

  it("returns the original text when max length is not positive", () => {
    expect(splitText("hello", 0)).toEqual(["hello"]);
  });
});

describe("parseIntAnswers", () => {
  it("parses unique integers and ignores values above the limit", () => {
    expect(parseIntAnswers("1, 2; 2 3 5", 3)).toEqual([1, 2, 3]);
  });

  it("returns an empty array for undefined answers", () => {
    expect(parseIntAnswers(undefined, 5)).toEqual([]);
  });
});

describe("regex helpers", () => {
  it("escapes regexp metacharacters", () => {
    expect(escapeRegExp(".*test?$")).toBe("\\.\\*test\\?\\$");
  });

  it("removes regexp metacharacters", () => {
    expect(removeSpecialCharacters(".*test?$")).toBe("test");
  });
});

describe("convertToCSV", () => {
  it("returns null for empty arrays", () => {
    expect(convertToCSV([] as never[])).toBeNull();
  });

  it("serialises headers and rows for non-empty arrays", () => {
    expect(convertToCSV(sampleObjects)).toBe("name,age\\nAlice,30\\nBob,25");
  });
});

describe("trimStrings", () => {
  it("trims nested strings recursively", () => {
    const payload = {
      name: " Alice ",
      nested: [" Bob ", { inner: " Carol " }],
      untouched: 42
    };

    expect(trimStrings(payload)).toEqual({
      name: "Alice",
      nested: ["Bob", { inner: "Carol" }],
      untouched: 42
    });
  });
});

describe("markdown helpers", () => {
  it("strips markdown formatting, emojis and accents", () => {
    expect(markdown2plainText("Élève *monde*😀"))
      .toBe("Eleve monde");
  });

  it("converts markdown links to WhatsApp friendly format", () => {
    expect(markdown2WHMarkdown("See [docs](https://example.com)"))
      .toBe("See *docs*\\nhttps://example.com");
  });

  it("turns inline markdown into HTML", () => {
    expect(
      markdown2html(
        "Visit [site](https://example.com) and *bold* plus _italic_"
      )
    ).toBe(
      'Visit <a href="https://example.com" rel="noopener noreferrer">site</a> ' +
        "and <strong>bold</strong> plus <em>italic</em>"
    );
  });
});
