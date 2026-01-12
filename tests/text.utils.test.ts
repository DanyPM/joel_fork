import { describe, expect, it } from "@jest/globals";
import {
  sanitizeUserInput,
  splitText,
  containsNumber,
  parseIntAnswers,
  escapeRegExp,
  removeSpecialCharacters,
  normalizeFrenchText,
  levenshteinDistance,
  fuzzyIncludes,
  fuzzyIncludesNormalized,
  trimStrings,
  markdown2plainText,
  markdown2WHMarkdown,
  markdown2html,
  convertToCSV
} from "../utils/text.utils.ts";

describe("text.utils", () => {
  describe("sanitizeUserInput", () => {
    it("strips characters commonly used in injection payloads", () => {
      const raw = "<script>$ne {drop: 1}</script> Salut";
      const sanitized = sanitizeUserInput(raw);
      expect(sanitized).toBe("scriptne drop: 1/script Salut");
    });

    it("removes control characters while keeping the message legible", () => {
      const raw = "Hello\u0000\u0008World$gt";
      const sanitized = sanitizeUserInput(raw);
      expect(sanitized).toBe("HelloWorldgt");
    });

    it("removes all injection and control characters", () => {
      const input = "<>`{}[]$\u0000\u001F\u007F";
      const result = sanitizeUserInput(input);
      expect(result).toBe("");
    });
  });

  describe("splitText", () => {
    it("forces a split when the \\split command is present", () => {
      const result = splitText("Hello\\splitWorld", 100);
      expect(result).toEqual(["Hello", "World"]);
    });

    it("removes the \\split command from the output", () => {
      const result = splitText("Part 1 \\split Part 2", 100);
      expect(result).toEqual(["Part 1 ", " Part 2"]);
      const recombined = result.join("");
      expect(recombined).toBe("Part 1  Part 2");
      expect(recombined).not.toContain("\\split");
    });

    it("continues to respect the max length within each forced segment", () => {
      const result = splitText("AAAAAAAAAA\\splitBBBBBBBBBB", 4);
      expect(result).toEqual(["AAAA", "AAAA", "AA", "BBBB", "BBBB", "BB"]);
    });

    it("handles consecutive split commands without creating empty chunks", () => {
      const result = splitText("First\\split\\splitSecond", 100);
      expect(result).toEqual(["First", "Second"]);
    });

    it("splits text at max length when no split command present", () => {
      const text = "A".repeat(50);
      const result = splitText(text, 20);
      expect(result.length).toBe(3);
      expect(result[0].length).toBe(20);
      expect(result[1].length).toBe(20);
      expect(result[2].length).toBe(10);
    });

    it("splits at whitespace when possible", () => {
      const text = "Hello World This Is A Test";
      const result = splitText(text, 15);
      expect(result.every((chunk) => chunk.length <= 15)).toBe(true);
    });

    it("returns original text in array when max is invalid", () => {
      const text = "Hello World";
      expect(splitText(text, 0)).toEqual([text]);
      expect(splitText(text, -5)).toEqual([text]);
      expect(splitText(text, Infinity)).toEqual([text]);
    });
  });

  describe("containsNumber", () => {
    it("returns true when string contains a number", () => {
      expect(containsNumber("Hello123")).toBe(true);
      expect(containsNumber("1")).toBe(true);
      expect(containsNumber("abc456def")).toBe(true);
    });

    it("returns false when string contains no numbers", () => {
      expect(containsNumber("Hello")).toBe(false);
      expect(containsNumber("")).toBe(false);
      expect(containsNumber("abc def")).toBe(false);
    });
  });

  describe("parseIntAnswers", () => {
    it("parses comma-separated integers", () => {
      expect(parseIntAnswers("1,2,3", 10)).toEqual([1, 2, 3]);
    });

    it("parses space-separated integers", () => {
      expect(parseIntAnswers("1 2 3", 10)).toEqual([1, 2, 3]);
    });

    it("filters out numbers above max allowed value", () => {
      expect(parseIntAnswers("1,2,15,3", 10)).toEqual([1, 2, 3]);
    });

    it("removes duplicates", () => {
      expect(parseIntAnswers("1,2,2,3,1", 10)).toEqual([1, 2, 3]);
    });

    it("handles undefined input", () => {
      expect(parseIntAnswers(undefined, 10)).toEqual([]);
    });

    it("filters out invalid numbers", () => {
      expect(parseIntAnswers("1,abc,2,xyz,3", 10)).toEqual([1, 2, 3]);
    });

    it("handles mixed separators", () => {
      expect(parseIntAnswers("1,2-3;4:5", 10)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("escapeRegExp", () => {
    it("escapes regex special characters", () => {
      expect(escapeRegExp(".*+?^${}()|[]\\")).toBe(
        "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\"
      );
    });

    it("leaves normal text unchanged", () => {
      expect(escapeRegExp("Hello World")).toBe("Hello World");
    });

    it("escapes mixed content", () => {
      expect(escapeRegExp("test[0-9]+")).toBe("test\\[0-9\\]\\+");
    });
  });

  describe("removeSpecialCharacters", () => {
    it("removes regex special characters", () => {
      expect(removeSpecialCharacters(".*+?^${}()|[]\\")).toBe("");
    });

    it("leaves normal text unchanged", () => {
      expect(removeSpecialCharacters("Hello World")).toBe("Hello World");
    });

    it("removes special chars from mixed content", () => {
      expect(removeSpecialCharacters("test[0-9]+")).toBe("test0-9");
    });
  });

  describe("normalizeFrenchText", () => {
    it("removes French accents", () => {
      expect(normalizeFrenchText("café")).toBe("cafe");
      expect(normalizeFrenchText("élève")).toBe("eleve");
    });

    it("converts to lowercase", () => {
      expect(normalizeFrenchText("BONJOUR")).toBe("bonjour");
    });

    it("replaces œ and æ", () => {
      expect(normalizeFrenchText("œuf")).toBe("oeuf");
      expect(normalizeFrenchText("cæcum")).toBe("caecum");
    });

    it("normalizes spaces and removes extra whitespace", () => {
      expect(normalizeFrenchText("  hello   world  ")).toBe("hello world");
    });

    it("removes special characters", () => {
      expect(normalizeFrenchText("hello-world!")).toBe("hello world");
    });
  });

  describe("levenshteinDistance", () => {
    it("returns 0 for identical strings", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
    });

    it("calculates correct distance for single character difference", () => {
      expect(levenshteinDistance("hello", "hallo")).toBe(1);
    });

    it("calculates correct distance for multiple differences", () => {
      expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    });

    it("handles empty strings", () => {
      expect(levenshteinDistance("", "")).toBe(0);
      expect(levenshteinDistance("hello", "")).toBe(5);
      expect(levenshteinDistance("", "world")).toBe(5);
    });
  });

  describe("fuzzyIncludes", () => {
    it("matches exact substrings", () => {
      expect(fuzzyIncludes("hello world", "hello")).toBe(true);
      expect(fuzzyIncludes("hello world", "world")).toBe(true);
    });

    it("matches with French accents normalized", () => {
      expect(fuzzyIncludes("café crème", "cafe creme")).toBe(true);
    });

    it("matches words in order with gaps", () => {
      expect(
        fuzzyIncludes(
          "corps des ingénieurs de l'armement",
          "ingénieurs armement"
        )
      ).toBe(true);
      expect(
        fuzzyIncludes(
          "recrutement exceptionnel au corps des ingénieurs de l'armement",
          "corps armement"
        )
      ).toBe(true);
    });

    it("matches full phrase", () => {
      expect(
        fuzzyIncludes(
          "recrutement des enseignants contractuels du primaire",
          "enseignants contractuels"
        )
      ).toBe(true);
    });

    it("rejects unrelated phrases", () => {
      expect(
        fuzzyIncludes(
          "recrutement des enseignants contractuels du primaire",
          "ingénieurs armement"
        )
      ).toBe(false);
    });

    it("returns false for empty needle", () => {
      expect(fuzzyIncludes("some text", "")).toBe(false);
    });

    it("handles exact matches", () => {
      expect(fuzzyIncludes("hello world", "hello")).toBe(true);
    });
  });

  describe("fuzzyIncludesNormalized", () => {
    it("returns true for exact substring match", () => {
      expect(fuzzyIncludesNormalized("hello world", "world")).toBe(true);
    });

    it("returns false for empty needle", () => {
      expect(fuzzyIncludesNormalized("hello", "")).toBe(false);
    });

    it("handles ordered word matching with gaps", () => {
      const haystack = "corps des ingenieurs de l armement";
      const needle = "ingenieurs armement";
      expect(fuzzyIncludesNormalized(haystack, needle)).toBe(true);
    });
  });

  describe("trimStrings", () => {
    it("trims primitive strings", () => {
      expect(trimStrings("  hello  ")).toBe("hello");
    });

    it("trims strings in arrays", () => {
      expect(trimStrings(["  hello  ", "  world  "])).toEqual([
        "hello",
        "world"
      ]);
    });

    it("trims strings in objects", () => {
      expect(trimStrings({ name: "  John  ", age: 30 })).toEqual({
        name: "John",
        age: 30
      });
    });

    it("trims nested structures", () => {
      const input = {
        name: "  John  ",
        items: ["  item1  ", "  item2  "],
        nested: { value: "  test  " }
      };
      const expected = {
        name: "John",
        items: ["item1", "item2"],
        nested: { value: "test" }
      };
      expect(trimStrings(input)).toEqual(expected);
    });

    it("preserves non-string types", () => {
      expect(trimStrings(42)).toBe(42);
      expect(trimStrings(true)).toBe(true);
      expect(trimStrings(null)).toBe(null);
    });
  });

  describe("markdown2plainText", () => {
    it("removes emojis from text", () => {
      const input = "Hello 😀 World 🎉";
      const result = markdown2plainText(input);
      expect(result).not.toContain("😀");
      expect(result).not.toContain("🎉");
    });

    it("removes markdown formatting characters", () => {
      const input = "*bold* _italic_";
      const result = markdown2plainText(input);
      expect(result).toBe("bold italic");
    });

    it("removes accents from French text", () => {
      const input = "café élève";
      const result = markdown2plainText(input);
      expect(result).toBe("cafe eleve");
    });

    it("handles special character replacements", () => {
      const input = "æ œ ß";
      const result = markdown2plainText(input);
      expect(result).toBe("ae oe ss");
    });
  });

  describe("markdown2WHMarkdown", () => {
    it("converts markdown links to WhatsApp format", () => {
      const input = "[Google](https://google.com)";
      const result = markdown2WHMarkdown(input);
      expect(result).toBe("*Google*\nhttps://google.com");
    });

    it("handles multiple links", () => {
      const input = "[Link1](https://one.com) and [Link2](https://two.com)";
      const result = markdown2WHMarkdown(input);
      expect(result).toContain("*Link1*\nhttps://one.com");
      expect(result).toContain("*Link2*\nhttps://two.com");
    });

    it("leaves non-link text unchanged", () => {
      const input = "Just plain text";
      const result = markdown2WHMarkdown(input);
      expect(result).toBe("Just plain text");
    });
  });

  describe("markdown2html", () => {
    it("converts markdown links to HTML", () => {
      const input = "[Google](https://google.com)";
      const result = markdown2html(input);
      expect(result).toBe(
        '<a href="https://google.com" rel="noopener noreferrer">Google</a>'
      );
    });

    it("converts bold markdown to HTML", () => {
      const input = "*bold text*";
      const result = markdown2html(input);
      expect(result).toBe("<strong>bold text</strong>");
    });

    it("converts italic markdown to HTML", () => {
      const input = "_italic text_";
      const result = markdown2html(input);
      expect(result).toBe("<em>italic text</em>");
    });

    it("converts newlines to br tags", () => {
      const input = "Line 1\nLine 2";
      const result = markdown2html(input);
      expect(result).toBe("Line 1<br />Line 2");
    });

    it("handles mixed formatting", () => {
      const input = "*bold* _italic_ [link](https://test.com)";
      const result = markdown2html(input);
      expect(result).toContain("<strong>bold</strong>");
      expect(result).toContain("<em>italic</em>");
      expect(result).toContain('<a href="https://test.com"');
    });
  });

  describe("convertToCSV", () => {
    it("converts array of objects to CSV", () => {
      const data = [
        { name: "John", age: 30 },
        { name: "Jane", age: 25 }
      ] as never[];
      const result = convertToCSV(data);
      expect(result).toBe("name,age\nJohn,30\nJane,25");
    });

    it("returns null for empty array", () => {
      const result = convertToCSV([]);
      expect(result).toBeNull();
    });

    it("handles single element array", () => {
      const data = [{ name: "John", age: 30 }] as never[];
      const result = convertToCSV(data);
      expect(result).toBe("name,age\nJohn,30");
    });
  });
});
