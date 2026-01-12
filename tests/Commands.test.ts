import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { commands } from "../commands/Commands.ts";

describe("commands/Commands", () => {
  describe("commands array", () => {
    it("exports a non-empty commands array", () => {
      expect(commands).toBeDefined();
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it("all commands have regex and action properties", () => {
      commands.forEach((command, index) => {
        expect(command.regex).toBeInstanceOf(RegExp);
        expect(typeof command.action).toBe("function");
      });
    });

    describe("command regex patterns", () => {
      it("start command matches /start and Bonjour", () => {
        const startCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("start")
        );
        expect(startCommand).toBeDefined();
        expect(startCommand!.regex.test("/start")).toBe(true);
        expect(startCommand!.regex.test("Bonjour John")).toBe(true);
        expect(startCommand!.regex.test("bonjour test")).toBe(true); // case insensitive
      });

      it("search command matches Rechercher and Recherche", () => {
        const searchCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("Recherche")
        );
        expect(searchCommand).toBeDefined();
        expect(searchCommand!.regex.test("Rechercher")).toBe(true);
        expect(searchCommand!.regex.test("Recherche")).toBe(true);
        expect(searchCommand!.regex.test("rechercher")).toBe(true); // case insensitive
      });

      it("list command matches suivis variations", () => {
        const listCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("Mes suivis")
        );
        expect(listCommand).toBeDefined();
        expect(listCommand!.regex.test("🧐 Mes suivis")).toBe(true);
        expect(listCommand!.regex.test("Suivis")).toBe(true);
        expect(listCommand!.regex.test("Suivi")).toBe(true);
      });

      it("manual follow command matches SuivreN variations", () => {
        const followCommands = commands.filter(
          (cmd) =>
            cmd.regex.test("SuivreN") ||
            cmd.regex.test("Suivre N") ||
            cmd.regex.test("🕵️ Forcer le suivi de")
        );
        expect(followCommands.length).toBeGreaterThan(0);

        const someCommand = followCommands[0];
        expect(
          someCommand.regex.test("SuivreN Jean Dupont") ||
            someCommand.regex.test("Suivre N Jean Dupont")
        ).toBe(true);
      });

      it("function follow command matches SuivreF variations", () => {
        const functionCommands = commands.filter((cmd) =>
          cmd.regex.toString().includes("SuivreF")
        );
        expect(functionCommands.length).toBeGreaterThan(0);

        const someCommand = functionCommands[0];
        expect(someCommand.regex.test("SuivreF ambassadeur")).toBe(true);
      });

      it("organisation follow command matches SuivreO variations", () => {
        const orgCommands = commands.filter((cmd) =>
          cmd.regex.toString().includes("SuivreO")
        );
        expect(orgCommands.length).toBeGreaterThan(0);

        const someCommand = orgCommands[0];
        expect(someCommand.regex.test("SuivreO Q12345")).toBe(true);
      });

      it("history command matches Historique patterns", () => {
        const historyCommands = commands.filter((cmd) =>
          cmd.regex.toString().includes("Historique")
        );
        expect(historyCommands.length).toBeGreaterThan(0);

        // Should match variations
        expect(
          historyCommands.some((cmd) => cmd.regex.test("Historique Jean Dupont"))
        ).toBe(true);
        expect(
          historyCommands.some((cmd) =>
            cmd.regex.test("Historique de Jean Dupont")
          )
        ).toBe(true);
        expect(
          historyCommands.some((cmd) =>
            cmd.regex.test("Historique complet de Jean Dupont")
          )
        ).toBe(true);
      });

      it("delete profile command matches delete variations", () => {
        const deleteCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("supprimer")
        );
        expect(deleteCommand).toBeDefined();
        expect(deleteCommand!.regex.test("/supprimerCompte")).toBe(true);
        expect(deleteCommand!.regex.test("supprimerCompte")).toBe(true);
        expect(deleteCommand!.regex.test("supprimer")).toBe(true);
        expect(deleteCommand!.regex.test("delete")).toBe(true);
      });

      it("export/import commands match exact keywords", () => {
        const exportCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("export")
        );
        const importCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("import")
        );

        expect(exportCommand).toBeDefined();
        expect(importCommand).toBeDefined();

        expect(exportCommand!.regex.test("/export")).toBe(true);
        expect(exportCommand!.regex.test("Exporter")).toBe(true);
        expect(exportCommand!.regex.test("Export")).toBe(true);

        expect(importCommand!.regex.test("/import")).toBe(true);
        expect(importCommand!.regex.test("Importer")).toBe(true);
        expect(importCommand!.regex.test("Import")).toBe(true);
      });

      it("stats and build commands match variations", () => {
        const statsCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("stats")
        );
        const buildCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("build")
        );

        expect(statsCommand).toBeDefined();
        expect(buildCommand).toBeDefined();

        expect(statsCommand!.regex.test("/stats")).toBe(true);
        expect(statsCommand!.regex.test("stats")).toBe(true);

        expect(buildCommand!.regex.test("/build")).toBe(true);
        expect(buildCommand!.regex.test("build")).toBe(true);
      });

      it("ENA/INSP command matches secret variations", () => {
        const enaCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("ENA")
        );
        expect(enaCommand).toBeDefined();
        expect(enaCommand!.regex.test("/secret")).toBe(true);
        expect(enaCommand!.regex.test("/ENA")).toBe(true);
        expect(enaCommand!.regex.test("/INSP")).toBe(true);
        expect(enaCommand!.regex.test("ENA")).toBe(true);
        expect(enaCommand!.regex.test("INSP")).toBe(true);
      });

      it("textAlert command matches /textAlert", () => {
        const textAlertCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("textAlert")
        );
        expect(textAlertCommand).toBeDefined();
        expect(textAlertCommand!.regex.test("/textAlert")).toBe(true);
        expect(textAlertCommand!.regex.test("/textAlert test")).toBe(true);
      });

      it("notification viewing command matches pattern", () => {
        const notifCommand = commands.find((cmd) =>
          cmd.regex.toString().includes("Voir mes notifications")
        );
        expect(notifCommand).toBeDefined();
        expect(notifCommand!.regex.test("Voir mes notifications")).toBe(true);
      });
    });

    describe("command priority and matching", () => {
      it("more specific commands come before general ones", () => {
        // "Historique complet de" should come before "Historique de"
        const historyCompleteIndex = commands.findIndex((cmd) =>
          cmd.regex.toString().includes("Historique complet")
        );
        const historyOfIndex = commands.findIndex(
          (cmd) =>
            cmd.regex.toString().includes("Historique de") &&
            !cmd.regex.toString().includes("complet")
        );

        if (historyCompleteIndex !== -1 && historyOfIndex !== -1) {
          expect(historyCompleteIndex).toBeLessThan(historyOfIndex);
        }
      });

      it("forced follow command comes before general follow", () => {
        const forcedFollowIndex = commands.findIndex((cmd) =>
          cmd.regex.toString().includes("Forcer le suivi")
        );
        const generalFollowIndex = commands.findIndex(
          (cmd) =>
            cmd.regex.toString().includes("Suivre") &&
            !cmd.regex.toString().includes("Forcer")
        );

        if (forcedFollowIndex !== -1 && generalFollowIndex !== -1) {
          expect(forcedFollowIndex).toBeLessThan(generalFollowIndex);
        }
      });
    });

    describe("command uniqueness", () => {
      it("each command has a unique purpose (no exact duplicate regexes)", () => {
        const regexStrings = commands.map((cmd) => cmd.regex.toString());
        const uniqueRegexStrings = new Set(regexStrings);

        expect(uniqueRegexStrings.size).toBe(regexStrings.length);
      });
    });
  });
});
