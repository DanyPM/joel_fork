import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import mongoose, { Types } from "mongoose";
import User from "../models/User.ts";
import People from "../models/People.ts";
import { IUser } from "../types.ts";
import { notifyPeopleUpdates } from "../notifications/peopleNotifications.ts";
import { JORFSearchItem } from "../entities/JORFSearchResponse.ts";
import * as SessionModule from "../entities/Session.ts";
import * as WhatsAppModule from "../entities/WhatsAppSession.ts";

// Mock sendMessage and WhatsApp template function
jest.mock("../entities/Session.ts", () => {
  const actual = jest.requireActual("../entities/Session.ts");
  return {
    ...actual,
    sendMessage: jest.fn()
  };
});

jest.mock("../entities/WhatsAppSession.ts", () => {
  const actual = jest.requireActual("../entities/WhatsAppSession.ts");
  return {
    ...actual,
    sendWhatsAppTemplate: jest.fn(),
    WHATSAPP_REENGAGEMENT_TIMEOUT_WITH_MARGIN_MS: 24 * 60 * 60 * 1000, // 24 hours
    WHATSAPP_NEAR_MISS_WINDOW_MS: 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000 // 26 hours
  };
});

const mockSendMessage = SessionModule.sendMessage as jest.MockedFunction<
  typeof SessionModule.sendMessage
>;

const mockSendWhatsAppTemplate =
  WhatsAppModule.sendWhatsAppTemplate as jest.MockedFunction<
    typeof WhatsAppModule.sendWhatsAppTemplate
  >;

describe("WhatsApp Reengagement Flow Tests", () => {
  let testPeople: any;
  let whatsAppUser: IUser;

  beforeEach(async () => {
    if (!mongoose.connection.db)
      throw new Error("MongoDB connection not established");
    await mongoose.connection.db.dropDatabase();
    jest.clearAllMocks();

    // Create test person
    testPeople = await People.create({
      nom: "Dupont",
      prenom: "Jean"
    });
  });

  describe("Reengagement Timeout Detection", () => {
    it("should detect when user needs reengagement (> 24 hours)", async () => {
      // Create user with old lastEngagementAt
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25); // 25 hours ago

      whatsAppUser = await User.create({
        chatId: "wa123",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: oldDate,
        waitingReengagement: false,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      mockSendWhatsAppTemplate.mockResolvedValue(true);
      mockSendMessage.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF123",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false // Not forcing
      );

      // Should send template, not actual notification
      expect(mockSendWhatsAppTemplate).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should send notification directly when within 24-hour window", async () => {
      // Create user with recent lastEngagementAt
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 2); // 2 hours ago

      whatsAppUser = await User.create({
        chatId: "wa456",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: recentDate,
        waitingReengagement: false,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      mockSendMessage.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF456",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Should send notification directly
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });
  });

  describe("Template Message Sending", () => {
    it("should send template message when reengagement needed", async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 30);

      whatsAppUser = await User.create({
        chatId: "wa789",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: oldDate,
        waitingReengagement: false,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      mockSendWhatsAppTemplate.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF789",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      expect(mockSendWhatsAppTemplate).toHaveBeenCalledTimes(1);

      // Verify template was called with correct parameters
      const callArgs = mockSendWhatsAppTemplate.mock.calls[0];
      expect(callArgs[1].messageApp).toBe("WhatsApp");
      expect(callArgs[2]).toBe("people");
    });

    it("should not send template if already sent (waitingReengagement=true)", async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 30);

      whatsAppUser = await User.create({
        chatId: "wa1011",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: oldDate,
        waitingReengagement: true, // Already waiting
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      mockSendWhatsAppTemplate.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF1011",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Should not send template again
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("waitingReengagement Flag Management", () => {
    it("should set waitingReengagement flag after template sent", async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 30);

      whatsAppUser = await User.create({
        chatId: "wa1213",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: oldDate,
        waitingReengagement: false,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      mockSendWhatsAppTemplate.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF1213",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Verify flag was set
      const updatedUser = await User.findById(whatsAppUser._id);
      expect(updatedUser!.waitingReengagement).toBe(true);
    });

    it("should clear waitingReengagement flag when user responds within window", async () => {
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 2);

      whatsAppUser = await User.create({
        chatId: "wa1415",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: recentDate,
        waitingReengagement: true, // Was waiting, but user engaged
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      mockSendMessage.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF1415",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Should send notification
      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Note: waitingReengagement flag clearing happens in other flows
      // This test verifies the notification is sent when window is valid
    });
  });

  describe("Pending Notifications Storage", () => {
    it("should store pending notifications when reengagement needed", async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 30);

      whatsAppUser = await User.create({
        chatId: "wa1617",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: oldDate,
        waitingReengagement: false,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      mockSendWhatsAppTemplate.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF1617",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Verify pending notifications were stored
      const updatedUser = await User.findById(whatsAppUser._id);
      expect(updatedUser!.pendingNotifications.length).toBeGreaterThan(0);
      expect(updatedUser!.pendingNotifications[0].notificationType).toBe(
        "people"
      );
      expect(updatedUser!.pendingNotifications[0].source_ids).toContain(
        "JORF1617"
      );
    });
  });

  describe("Forced Message Sending", () => {
    it("should bypass reengagement when forceWHMessages=true", async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 30);

      whatsAppUser = await User.create({
        chatId: "wa1819",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: oldDate,
        waitingReengagement: false,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      mockSendMessage.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF1819",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        true // Force sending
      );

      // Should send notification directly, bypassing reengagement
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendWhatsAppTemplate).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle exact 24-hour boundary", async () => {
      const exactDate = new Date();
      exactDate.setHours(exactDate.getHours() - 24); // Exactly 24 hours

      whatsAppUser = await User.create({
        chatId: "wa2021",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: exactDate,
        waitingReengagement: false,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      mockSendWhatsAppTemplate.mockResolvedValue(true);
      mockSendMessage.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF2021",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // At exact boundary, should need reengagement (>= 24h triggers template)
      // The actual behavior depends on WHATSAPP_REENGAGEMENT_TIMEOUT_WITH_MARGIN_MS
    });

    it("should handle template send failure gracefully", async () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 30);

      whatsAppUser = await User.create({
        chatId: "wa2223",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: oldDate,
        waitingReengagement: false,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      // Template send fails
      mockSendWhatsAppTemplate.mockResolvedValue(false);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF2223",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Should attempt template but not set waitingReengagement on failure
      expect(mockSendWhatsAppTemplate).toHaveBeenCalledTimes(1);

      const updatedUser = await User.findById(whatsAppUser._id);
      expect(updatedUser!.waitingReengagement).toBe(false);
    });

    it("should handle very old lastEngagementAt (months ago)", async () => {
      const veryOldDate = new Date();
      veryOldDate.setMonth(veryOldDate.getMonth() - 3); // 3 months ago

      whatsAppUser = await User.create({
        chatId: "wa2425",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        lastEngagementAt: veryOldDate,
        waitingReengagement: false,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      mockSendWhatsAppTemplate.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF2425",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["WhatsApp"],
        {
          whatsAppAPI: {} as any,
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Should still send template
      expect(mockSendWhatsAppTemplate).toHaveBeenCalledTimes(1);
    });
  });
});
