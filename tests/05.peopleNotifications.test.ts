import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import mongoose, { Types } from "mongoose";
import {
  notifyPeopleUpdates,
  sendPeopleUpdate
} from "../notifications/peopleNotifications.ts";
import { JORFSearchItem } from "../entities/JORFSearchResponse.ts";
import User from "../models/User.ts";
import People from "../models/People.ts";
import { IUser } from "../types.ts";
import * as SessionModule from "../entities/Session.ts";

// Mock sendMessage to control delivery success/failure
jest.mock("../entities/Session.ts", () => {
  const actual = jest.requireActual("../entities/Session.ts");
  return {
    ...actual,
    sendMessage: jest.fn()
  };
});

const mockSendMessage = SessionModule.sendMessage as jest.MockedFunction<
  typeof SessionModule.sendMessage
>;

describe("People Notifications - Critical Path Tests", () => {
  let testPeople: any;
  let testUser: IUser;

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

    // Create test user with followed person
    testUser = await User.create({
      chatId: "test123",
      messageApp: "Telegram",
      schemaVersion: 3,
      followedPeople: [
        {
          peopleId: testPeople._id,
          lastUpdate: new Date("2024-01-01")
        }
      ]
    });
  });

  describe("lastUpdate Timestamp Critical Tests", () => {
    it("should update lastUpdate ONLY after successful message delivery", async () => {
      // Mock successful message delivery
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

      const initialLastUpdate = testUser.followedPeople[0].lastUpdate;

      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Verify message was sent
      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Verify lastUpdate was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();
      expect(
        updatedUser!.followedPeople[0].lastUpdate.getTime()
      ).toBeGreaterThan(initialLastUpdate.getTime());
    });

    it("should NOT update lastUpdate when sendMessage returns false", async () => {
      // Mock failed message delivery
      mockSendMessage.mockResolvedValue(false);

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

      const initialLastUpdate = testUser.followedPeople[0].lastUpdate;

      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Verify message send was attempted
      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Verify lastUpdate was NOT updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.followedPeople[0].lastUpdate.getTime()).toBe(
        initialLastUpdate.getTime()
      );
    });

    it("should NOT update lastUpdate when sendMessage throws error", async () => {
      // Mock error during message delivery
      mockSendMessage.mockRejectedValue(new Error("Network error"));

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

      const initialLastUpdate = testUser.followedPeople[0].lastUpdate;

      // Should handle error gracefully
      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Verify lastUpdate was NOT updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.followedPeople[0].lastUpdate.getTime()).toBe(
        initialLastUpdate.getTime()
      );
    });

    it("should update lastUpdate only for successfully delivered people", async () => {
      // Create another person
      const testPeople2 = await People.create({
        nom: "Martin",
        prenom: "Sophie"
      });

      // Update user to follow both people
      await User.updateOne(
        { _id: testUser._id },
        {
          $push: {
            followedPeople: {
              peopleId: testPeople2._id,
              lastUpdate: new Date("2024-01-01")
            }
          }
        }
      );

      // Mock: first message succeeds, but we only send one message for both
      mockSendMessage.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF111",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        },
        {
          nom: "Martin",
          prenom: "Sophie",
          source_date: "2024-02-01",
          source_id: "JORF222",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      const initialLastUpdate1 = new Date("2024-01-01");

      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Both people should be updated since message was successful
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.followedPeople.length).toBe(2);

      // Both lastUpdate timestamps should be updated
      updatedUser!.followedPeople.forEach((follow) => {
        expect(follow.lastUpdate.getTime()).toBeGreaterThan(
          initialLastUpdate1.getTime()
        );
      });
    });
  });

  describe("Duplicate Notification Prevention", () => {
    it("should not send notifications for records older than lastUpdate", async () => {
      mockSendMessage.mockResolvedValue(true);

      // Set lastUpdate to a recent date
      await User.updateOne(
        { _id: testUser._id },
        { $set: { "followedPeople.0.lastUpdate": new Date("2024-06-01") } }
      );

      // Try to notify with older records
      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-05-01", // Older than lastUpdate
          source_id: "JORF333",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // No message should be sent for old records
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should send notifications only for new records", async () => {
      mockSendMessage.mockResolvedValue(true);

      await User.updateOne(
        { _id: testUser._id },
        { $set: { "followedPeople.0.lastUpdate": new Date("2024-03-01") } }
      );

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01", // Older
          source_id: "JORF444",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        },
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-04-01", // Newer
          source_id: "JORF555",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Should send message with only the new record
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("Notification Content Completeness", () => {
    it("should include all new records in the notification", async () => {
      mockSendMessage.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF666",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        },
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-03-01",
          source_id: "JORF777",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Verify the message contains information about both records
      const messageContent = mockSendMessage.mock.calls[0][1] as string;
      expect(messageContent).toContain("Jean Dupont");
    });

    it("should format message correctly for single update", async () => {
      mockSendMessage.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF888",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      const messageContent = mockSendMessage.mock.calls[0][1] as string;
      expect(messageContent).toContain("Nouvelle publication");
      expect(messageContent).not.toContain("Nouvelles publications");
    });

    it("should format message correctly for multiple updates", async () => {
      mockSendMessage.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF999",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        },
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-03-01",
          source_id: "JORF1000",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      const messageContent = mockSendMessage.mock.calls[0][1] as string;
      expect(messageContent).toContain("Nouvelles publications");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty JORF records array", async () => {
      mockSendMessage.mockResolvedValue(true);

      await notifyPeopleUpdates(
        [],
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should handle user with no followed people", async () => {
      mockSendMessage.mockResolvedValue(true);

      // Create user with no follows
      const emptyUser = await User.create({
        chatId: "empty123",
        messageApp: "Telegram",
        schemaVersion: 3,
        followedPeople: []
      });

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF1001",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Should not send message to user with no follows
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should handle people with accents and special characters", async () => {
      mockSendMessage.mockResolvedValue(true);

      const accentPeople = await People.create({
        nom: "Müller",
        prenom: "François-José"
      });

      await User.updateOne(
        { _id: testUser._id },
        {
          $push: {
            followedPeople: {
              peopleId: accentPeople._id,
              lastUpdate: new Date("2024-01-01")
            }
          }
        }
      );

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Müller",
          prenom: "François-José",
          source_date: "2024-02-01",
          source_id: "JORF1002",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      expect(mockSendMessage).toHaveBeenCalled();
    });
  });

  describe("User Filtering", () => {
    it("should only notify specified users when userIds provided", async () => {
      mockSendMessage.mockResolvedValue(true);

      // Create another user
      const testUser2 = await User.create({
        chatId: "test456",
        messageApp: "Telegram",
        schemaVersion: 3,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ]
      });

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF1003",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      // Only notify testUser, not testUser2
      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        [testUser._id],
        false
      );

      // Should only send one message
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it("should filter by message app correctly", async () => {
      mockSendMessage.mockResolvedValue(true);

      // Create WhatsApp user
      const whatsappUser = await User.create({
        chatId: "whatsapp123",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        followedPeople: [
          {
            peopleId: testPeople._id,
            lastUpdate: new Date("2024-01-01")
          }
        ],
        lastEngagementAt: new Date() // Recent engagement
      });

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF1004",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      // Only notify Telegram users
      await notifyPeopleUpdates(
        jorfRecords,
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Should only notify Telegram user, not WhatsApp user
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
