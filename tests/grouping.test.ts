import { describe, expect, it } from "@jest/globals";
import {
  groupRecordsBy,
  orderGroupedEntries,
  formatGroupedRecords,
  createFieldGrouping,
  createReferenceGrouping,
  NotificationGroupingConfig,
  LeafFormatter
} from "../notifications/grouping.ts";
import { JORFSearchItem } from "../entities/JORFSearchResponse.ts";

describe("notifications/grouping", () => {
  const mockRecords: JORFSearchItem[] = [
    {
      nom: "Dupont",
      prenom: "Jean",
      source_date: "2023-01-15",
      source_id: "JORF001",
      source_name: "JORF",
      type_ordre: "nomination",
      organisations: [{ nom: "Ministère A", wikidata_id: "Q123" }]
    },
    {
      nom: "Martin",
      prenom: "Marie",
      source_date: "2023-01-15",
      source_id: "JORF001",
      source_name: "JORF",
      type_ordre: "promotion",
      organisations: [{ nom: "Ministère A", wikidata_id: "Q123" }]
    },
    {
      nom: "Bernard",
      prenom: "Paul",
      source_date: "2023-02-20",
      source_id: "JORF002",
      source_name: "JORF",
      type_ordre: "nomination",
      organisations: [{ nom: "Ministère B", wikidata_id: "Q456" }]
    }
  ];

  describe("groupRecordsBy", () => {
    it("groups records by a single field", () => {
      const config: NotificationGroupingConfig = {
        getGroupId: (record) => record.source_id
      };

      const result = groupRecordsBy(mockRecords, config);

      expect(result.size).toBe(2);
      expect(result.get("JORF001")).toHaveLength(2);
      expect(result.get("JORF002")).toHaveLength(1);
    });

    it("groups records with array return values", () => {
      const config: NotificationGroupingConfig = {
        getGroupId: (record) =>
          record.organisations?.map((org) => org.wikidata_id ?? "") ?? []
      };

      const result = groupRecordsBy(mockRecords, config);

      expect(result.get("Q123")).toHaveLength(2);
      expect(result.get("Q456")).toHaveLength(1);
    });

    it("uses fallback label for records without group id", () => {
      const config: NotificationGroupingConfig = {
        getGroupId: () => null,
        fallbackLabel: "Non classé"
      };

      const result = groupRecordsBy(mockRecords, config);

      expect(result.size).toBe(1);
      expect(result.get("Non classé")).toHaveLength(3);
    });

    it("filters out empty string group ids", () => {
      const config: NotificationGroupingConfig = {
        getGroupId: (record) => (record.nom === "Dupont" ? "" : record.nom)
      };

      const result = groupRecordsBy(mockRecords, config);

      expect(result.has("")).toBe(false);
      expect(result.get("Martin")).toHaveLength(1);
      expect(result.get("Bernard")).toHaveLength(1);
    });

    it("handles records with no valid group ids and no fallback", () => {
      const config: NotificationGroupingConfig = {
        getGroupId: () => null
      };

      const result = groupRecordsBy(mockRecords, config);

      expect(result.size).toBe(0);
    });

    it("trims whitespace from group ids", () => {
      const config: NotificationGroupingConfig = {
        getGroupId: () => "  Test Group  "
      };

      const result = groupRecordsBy(mockRecords, config);

      expect(result.has("Test Group")).toBe(true);
      expect(result.has("  Test Group  ")).toBe(false);
    });
  });

  describe("orderGroupedEntries", () => {
    it("returns entries in original order when no sort function provided", () => {
      const groupedMap = new Map([
        ["C", [mockRecords[0]]],
        ["A", [mockRecords[1]]],
        ["B", [mockRecords[2]]]
      ]);

      const result = orderGroupedEntries(groupedMap);

      expect(result[0][0]).toBe("C");
      expect(result[1][0]).toBe("A");
      expect(result[2][0]).toBe("B");
    });

    it("applies custom sort function when provided", () => {
      const groupedMap = new Map([
        ["C", [mockRecords[0]]],
        ["A", [mockRecords[1]]],
        ["B", [mockRecords[2]]]
      ]);

      const sortFn = (groupIds: string[]) => [...groupIds].sort();
      const result = orderGroupedEntries(groupedMap, sortFn);

      expect(result[0][0]).toBe("A");
      expect(result[1][0]).toBe("B");
      expect(result[2][0]).toBe("C");
    });

    it("handles empty map", () => {
      const groupedMap = new Map<string, JORFSearchItem[]>();
      const result = orderGroupedEntries(groupedMap);

      expect(result).toEqual([]);
    });
  });

  describe("formatGroupedRecords", () => {
    const leafFormatter: LeafFormatter = (records) => {
      return records.map((r) => `- ${r.nom}`).join("\n") + "\n";
    };

    const separatorSelector = (level: number) => {
      return level === 0 ? "\n---\n" : "\n";
    };

    it("formats simple grouped records", () => {
      const config: NotificationGroupingConfig = {
        getGroupId: (record) => record.source_id,
        formatGroupTitle: ({ groupId }) => `📰 ${groupId}\n`
      };

      const groupedMap = groupRecordsBy(mockRecords, config);
      const result = formatGroupedRecords(
        groupedMap,
        config,
        false,
        leafFormatter,
        separatorSelector
      );

      expect(result).toContain("📰 JORF001");
      expect(result).toContain("📰 JORF002");
      expect(result).toContain("- Dupont");
      expect(result).toContain("- Martin");
      expect(result).toContain("- Bernard");
    });

    it("uses default title format when formatGroupTitle not provided", () => {
      const config: NotificationGroupingConfig = {
        getGroupId: (record) => record.type_ordre
      };

      const groupedMap = groupRecordsBy(mockRecords, config);
      const result = formatGroupedRecords(
        groupedMap,
        config,
        false,
        leafFormatter,
        separatorSelector
      );

      expect(result).toContain("👉 nomination");
      expect(result).toContain("👉 promotion");
    });

    it("returns empty string for empty grouped map", () => {
      const config: NotificationGroupingConfig = {
        getGroupId: (record) => record.source_id
      };

      const emptyMap = new Map<string, JORFSearchItem[]>();
      const result = formatGroupedRecords(
        emptyMap,
        config,
        false,
        leafFormatter,
        separatorSelector
      );

      expect(result).toBe("");
    });

    it("applies separators between groups but not after last", () => {
      const config: NotificationGroupingConfig = {
        getGroupId: (record) => record.source_id,
        formatGroupTitle: ({ groupId }) => `${groupId}\n`
      };

      const groupedMap = groupRecordsBy(mockRecords, config);
      const result = formatGroupedRecords(
        groupedMap,
        config,
        false,
        leafFormatter,
        separatorSelector
      );

      const separatorCount = (result.match(/\n---\n/g) || []).length;
      expect(separatorCount).toBe(1); // One separator between two groups
    });

    it("handles nested subgrouping", () => {
      const subConfig: NotificationGroupingConfig = {
        getGroupId: (record) => record.type_ordre,
        formatGroupTitle: ({ groupId }) => `  - ${groupId}\n`
      };

      const config: NotificationGroupingConfig = {
        getGroupId: (record) => record.source_id,
        formatGroupTitle: ({ groupId }) => `📰 ${groupId}\n`,
        subGrouping: subConfig
      };

      const groupedMap = groupRecordsBy(mockRecords, config);
      const result = formatGroupedRecords(
        groupedMap,
        config,
        false,
        leafFormatter,
        separatorSelector
      );

      expect(result).toContain("📰 JORF001");
      expect(result).toContain("  - nomination");
      expect(result).toContain("  - promotion");
    });
  });

  describe("createFieldGrouping", () => {
    it("creates basic field grouping config", () => {
      const config = createFieldGrouping((record) => record.nom);

      expect(config.getGroupId(mockRecords[0])).toBe("Dupont");
      expect(config.fallbackLabel).toBeUndefined();
    });

    it("creates field grouping with options", () => {
      const config = createFieldGrouping((record) => record.nom, {
        fallbackLabel: "Unknown",
        omitOrganisationNames: true
      });

      expect(config.fallbackLabel).toBe("Unknown");
      expect(config.omitOrganisationNames).toBe(true);
    });

    it("creates field grouping with custom title formatter", () => {
      const titleFormatter = ({ groupId }: { groupId: string }) =>
        `Custom: ${groupId}`;
      const config = createFieldGrouping((record) => record.nom, {
        formatGroupTitle: titleFormatter
      });

      expect(config.formatGroupTitle).toBe(titleFormatter);
    });
  });

  describe("createReferenceGrouping", () => {
    it("creates reference grouping by source_id", () => {
      const config = createReferenceGrouping();

      expect(config.getGroupId(mockRecords[0])).toBe("JORF001");
      expect(config.getGroupId(mockRecords[2])).toBe("JORF002");
    });

    it("formats group title with date and link", () => {
      const config = createReferenceGrouping();
      const title = config.formatGroupTitle!({
        groupId: "JORF001",
        markdownLinkEnabled: true,
        records: [mockRecords[0]]
      });

      expect(title).toContain("📰");
      expect(title).toContain("JORF");
      expect(title).toContain("2023");
      expect(title).toContain("[cliquez ici]");
    });

    it("formats title without markdown when disabled", () => {
      const config = createReferenceGrouping();
      const title = config.formatGroupTitle!({
        groupId: "JORF001",
        markdownLinkEnabled: false,
        records: [mockRecords[0]]
      });

      expect(title).toContain("📰");
      expect(title).not.toContain("[cliquez ici]");
      expect(title).toContain("https://");
    });

    it("sorts groups by date (most recent first)", () => {
      const config = createReferenceGrouping();
      const groupedMap = new Map([
        ["JORF001", [mockRecords[0]]],
        ["JORF002", [mockRecords[2]]]
      ]);

      const sortedIds = config.sortGroupIds!(
        ["JORF001", "JORF002"],
        groupedMap
      );

      // JORF002 is from 2023-02-20, JORF001 is from 2023-01-15
      expect(sortedIds[0]).toBe("JORF002");
      expect(sortedIds[1]).toBe("JORF001");
    });

    it("uses custom formatGroupTitle when provided", () => {
      const customFormatter = ({ groupId }: { groupId: string }) =>
        `Custom ${groupId}`;
      const config = createReferenceGrouping({
        formatGroupTitle: customFormatter
      });

      const title = config.formatGroupTitle!({
        groupId: "JORF001",
        markdownLinkEnabled: true,
        records: [mockRecords[0]]
      });

      expect(title).toBe("Custom JORF001");
    });
  });
});
