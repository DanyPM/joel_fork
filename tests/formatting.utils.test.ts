import { describe, expect, it } from "@jest/globals";
import { textTypeOrdre } from "../utils/formatting.utils.ts";
import { TypeOrdre } from "../types.ts";

describe("formatting.utils", () => {
  describe("textTypeOrdre", () => {
    describe("with male gender", () => {
      const sex = "M" as const;

      it("formats nomination correctly", () => {
        const result = textTypeOrdre("nomination" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _nommé_\n");
      });

      it("formats réintégration correctly", () => {
        const result = textTypeOrdre("réintégration" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _réintégré_\n");
      });

      it("formats cessation de fonction correctly", () => {
        const result = textTypeOrdre("cessation de fonction" as TypeOrdre, sex);
        expect(result).toBe("📝 A _cessé ses fonctions_\n");
      });

      it("formats affectation correctly", () => {
        const result = textTypeOrdre("affectation" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _affecté_\n");
      });

      it("formats délégation de signature correctly", () => {
        const result = textTypeOrdre(
          "délégation de signature" as TypeOrdre,
          sex
        );
        expect(result).toBe("📝 A reçu une _délégation de signature_\n");
      });

      it("formats promotion correctly", () => {
        const result = textTypeOrdre("promotion" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _promu_\n");
      });

      it("formats admission correctly", () => {
        const result = textTypeOrdre("admission" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _admis_\n");
      });

      it("formats détachement correctly", () => {
        const result = textTypeOrdre("détachement" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _détaché_\n");
      });

      it("formats élection correctly", () => {
        const result = textTypeOrdre("élection" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _élu_\n");
      });

      it("formats titularisation correctly", () => {
        const result = textTypeOrdre("titularisation" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _titularisé_\n");
      });

      it("formats démission correctly (no gender agreement)", () => {
        const result = textTypeOrdre("démission" as TypeOrdre, sex);
        expect(result).toBe("📝 A _démissionné_\n");
      });
    });

    describe("with female gender", () => {
      const sex = "F" as const;

      it("formats nomination correctly", () => {
        const result = textTypeOrdre("nomination" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _nommée_\n");
      });

      it("formats réintégration correctly", () => {
        const result = textTypeOrdre("réintégration" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _réintégrée_\n");
      });

      it("formats affectation correctly", () => {
        const result = textTypeOrdre("affectation" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _affectée_\n");
      });

      it("formats délégation de signature correctly", () => {
        const result = textTypeOrdre(
          "délégation de signature" as TypeOrdre,
          sex
        );
        expect(result).toBe("📝 A reçue une _délégation de signature_\n");
      });

      it("formats promotion correctly", () => {
        const result = textTypeOrdre("promotion" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _promue_\n");
      });

      it("formats admission correctly", () => {
        const result = textTypeOrdre("admission" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _admise_\n");
      });

      it("formats détachement correctly", () => {
        const result = textTypeOrdre("détachement" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _détachée_\n");
      });

      it("formats élection correctly", () => {
        const result = textTypeOrdre("élection" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _élue_\n");
      });

      it("formats titularisation correctly", () => {
        const result = textTypeOrdre("titularisation" as TypeOrdre, sex);
        expect(result).toBe("📝 A été _titularisée_\n");
      });

      it("formats démission correctly (no gender agreement)", () => {
        const result = textTypeOrdre("démission" as TypeOrdre, sex);
        expect(result).toBe("📝 A _démissionné_\n");
      });
    });

    describe("additional order types", () => {
      it("formats inscription correctly", () => {
        expect(textTypeOrdre("inscription" as TypeOrdre, "M")).toBe(
          "📝 A été _inscrit_\n"
        );
        expect(textTypeOrdre("inscription" as TypeOrdre, "F")).toBe(
          "📝 A été _inscrite_\n"
        );
      });

      it("formats désignation correctly", () => {
        expect(textTypeOrdre("désignation" as TypeOrdre, "M")).toBe(
          "📝 A été _désigné_\n"
        );
        expect(textTypeOrdre("désignation" as TypeOrdre, "F")).toBe(
          "📝 A été _désignée_\n"
        );
      });

      it("formats radiation correctly", () => {
        expect(textTypeOrdre("radiation" as TypeOrdre, "M")).toBe(
          "📝 A été _radié_\n"
        );
        expect(textTypeOrdre("radiation" as TypeOrdre, "F")).toBe(
          "📝 A été _radiée_\n"
        );
      });

      it("formats renouvellement correctly", () => {
        expect(textTypeOrdre("renouvellement" as TypeOrdre, "M")).toBe(
          "📝 A été _renouvelé_\n"
        );
        expect(textTypeOrdre("renouvellement" as TypeOrdre, "F")).toBe(
          "📝 A été _renouvelée_\n"
        );
      });

      it("formats reconduction correctly", () => {
        expect(textTypeOrdre("reconduction" as TypeOrdre, "M")).toBe(
          "📝 A été _reconduit_ dans ses fonctions\n"
        );
        expect(textTypeOrdre("reconduction" as TypeOrdre, "F")).toBe(
          "📝 A été _reconduite_ dans ses fonctions\n"
        );
      });

      it("formats admissibilité correctly (no gender agreement)", () => {
        expect(textTypeOrdre("admissibilité" as TypeOrdre, "M")).toBe(
          "📝 A été _admissible_\n"
        );
        expect(textTypeOrdre("admissibilité" as TypeOrdre, "F")).toBe(
          "📝 A été _admissible_\n"
        );
      });

      it("formats charge correctly", () => {
        expect(textTypeOrdre("charge" as TypeOrdre, "M")).toBe(
          "📝 A été _chargé_ de\n"
        );
        expect(textTypeOrdre("charge" as TypeOrdre, "F")).toBe(
          "📝 A été _chargée_ de\n"
        );
      });

      it("formats intégration correctly", () => {
        expect(textTypeOrdre("intégration" as TypeOrdre, "M")).toBe(
          "📝 A été _intégré_\n"
        );
        expect(textTypeOrdre("intégration" as TypeOrdre, "F")).toBe(
          "📝 A été _intégrée_\n"
        );
      });

      it("formats habilitation correctly", () => {
        expect(textTypeOrdre("habilitation" as TypeOrdre, "M")).toBe(
          "📝 A été _habilité_\n"
        );
        expect(textTypeOrdre("habilitation" as TypeOrdre, "F")).toBe(
          "📝 A été _habilitée_\n"
        );
      });

      it("formats recrutement correctly", () => {
        expect(textTypeOrdre("recrutement" as TypeOrdre, "M")).toBe(
          "📝 A été _recruté_\n"
        );
        expect(textTypeOrdre("recrutement" as TypeOrdre, "F")).toBe(
          "📝 A été _recrutée_\n"
        );
      });

      it("formats disponibilité correctly", () => {
        expect(textTypeOrdre("disponibilité" as TypeOrdre, "M")).toBe(
          "📝 A été _mis en disponibilité_\n"
        );
        expect(textTypeOrdre("disponibilité" as TypeOrdre, "F")).toBe(
          "📝 A été _mise en disponibilité_\n"
        );
      });

      it("formats autorisation correctly", () => {
        expect(textTypeOrdre("autorisation" as TypeOrdre, "M")).toBe(
          "📝 A été _autorisé_\n"
        );
        expect(textTypeOrdre("autorisation" as TypeOrdre, "F")).toBe(
          "📝 A été _autorisée_\n"
        );
      });

      it("formats mutation correctly", () => {
        expect(textTypeOrdre("mutation" as TypeOrdre, "M")).toBe(
          "📝 A été _muté_\n"
        );
        expect(textTypeOrdre("mutation" as TypeOrdre, "F")).toBe(
          "📝 A été _mutée_\n"
        );
      });

      it("formats décoration correctly", () => {
        expect(textTypeOrdre("décoration" as TypeOrdre, "M")).toBe(
          "📝 A été _décoré_\n"
        );
        expect(textTypeOrdre("décoration" as TypeOrdre, "F")).toBe(
          "📝 A été _décorée_\n"
        );
      });

      it("formats default/unknown type correctly", () => {
        const unknownType = "unknown_type" as TypeOrdre;
        expect(textTypeOrdre(unknownType, "M")).toBe(
          "📝 A été _unknown_type_\n"
        );
      });
    });
  });
});
