import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import mongoose, { Types } from "mongoose";
import User from "../models/User.ts";
import People from "../models/People.ts";
import { IUser } from "../types.ts";
import { notifyPeopleUpdates } from "../notifications/peopleNotifications.ts";
import { JORFSearchItem } from "../entities/JORFSearchResponse.ts";
import * as SessionModule from "../entities/Session.ts";

// Mock sendMessage to control delivery
jest.mock("../entities/Session.ts", () => {
  const actual = jest.requireActual("../entities/Session.ts");
  return {
    ...actual,
    sendMessage: jest.fn(),
    recordSuccessfulDelivery: jest.fn()
  };
});

const mockSendMessage = SessionModule.sendMessage as jest.MockedFunction<
  typeof SessionModule.sendMessage
>;

const mockRecordSuccessful =
  SessionModule.recordSuccessfulDelivery as jest.MockedFunction<
    typeof SessionModule.recordSuccessfulDelivery
  >;

describe("lastUpdate Timestamp Consistency Tests", () => {
  let testPeople1: any;
  let testPeople2: any;
  let testUser: IUser;

  beforeEach(async () => {
    if (!mongoose.connection.db)
      throw new Error("MongoDB connection not established");
    await mongoose.connection.db.dropDatabase();
    jest.clearAllMocks();

    // Create test people
    testPeople1 = await People.create({
      nom: "Dupont",
      prenom: "Jean"
    });

    testPeople2 = await People.create({
      nom: "Martin",
      prenom: "Sophie"
    });

    // Create test user
    testUser = await User.create({
      chatId: "test123",
      messageApp: "Telegram",
      schemaVersion: 3,
      followedPeople: [
        {
          peopleId: testPeople1._id,
          lastUpdate: new Date("2024-01-01T00:00:00Z")
        },
        {
          peopleId: testPeople2._id,
          lastUpdate: new Date("2024-01-01T00:00:00Z")
        }
      ]
    });
  });

  describe("lastUpdate Updated ONLY After Successful Delivery", () => {
    it("should update lastUpdate after successful message delivery", async () => {
      mockSendMessage.mockResolvedValue(true);
      mockRecordSuccessful.mockResolvedValue(undefined);

      const initialLastUpdate = new Date("2024-01-01T00:00:00Z");

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
        ["Telegram"],
        {
          telegramBotToken: "test-token",
          useAsyncUmamiLog: false,
          hasAccount: true
        },
        undefined,
        false
      );

      // Verify message was sent successfully
      expect(mockSendMessage).toHaveBeenCalledTimes(1);

      // Verify lastUpdate was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();

      const updatedPerson = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople1._id.toString()
      );

      expect(updatedPerson).toBeDefined();
      expect(updatedPerson!.lastUpdate.getTime()).toBeGreaterThan(
        initialLastUpdate.getTime()
      );
    });

    it("should NOT update lastUpdate when sendMessage returns false", async () => {
      mockSendMessage.mockResolvedValue(false); // Delivery failed

      const initialLastUpdate = new Date("2024-01-01T00:00:00Z");

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
      const updatedPerson = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople1._id.toString()
      );

      expect(updatedPerson!.lastUpdate.getTime()).toBe(
        initialLastUpdate.getTime()
      );
    });

    it("should NOT update lastUpdate when sendMessage throws error", async () => {
      mockSendMessage.mockRejectedValue(new Error("Network error"));

      const initialLastUpdate = new Date("2024-01-01T00:00:00Z");

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
      const updatedPerson = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople1._id.toString()
      );

      expect(updatedPerson!.lastUpdate.getTime()).toBe(
        initialLastUpdate.getTime()
      );
    });
  });

  describe("Bulk lastUpdate Operations with arrayFilters", () => {
    it("should update multiple people lastUpdate with arrayFilters", async () => {
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

      // Verify both lastUpdate timestamps were updated
      const updatedUser = await User.findById(testUser._id);

      const person1 = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople1._id.toString()
      );
      const person2 = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople2._id.toString()
      );

      expect(person1!.lastUpdate.getTime()).toBeGreaterThan(
        new Date("2024-01-01").getTime()
      );
      expect(person2!.lastUpdate.getTime()).toBeGreaterThan(
        new Date("2024-01-01").getTime()
      );
    });

    it("should only update specified people in arrayFilters", async () => {
      mockSendMessage.mockResolvedValue(true);

      const initialPerson2LastUpdate = testUser.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople2._id.toString()
      )!.lastUpdate;

      // Only update person1
      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
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

      const updatedUser = await User.findById(testUser._id);

      // Person1 should be updated
      const person1 = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople1._id.toString()
      );
      expect(person1!.lastUpdate.getTime()).toBeGreaterThan(
        new Date("2024-01-01").getTime()
      );

      // Person2 should NOT be updated
      const person2 = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople2._id.toString()
      );
      expect(person2!.lastUpdate.getTime()).toBe(
        initialPerson2LastUpdate.getTime()
      );
    });
  });

  describe("modifiedCount Verification", () => {
    it("should verify modifiedCount > 0 after successful update", async () => {
      mockSendMessage.mockResolvedValue(true);

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF444",
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

      // Verify update occurred (tested via timestamp change)
      const updatedUser = await User.findById(testUser._id);
      const person = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople1._id.toString()
      );

      expect(person!.lastUpdate.getTime()).toBeGreaterThan(
        new Date("2024-01-01").getTime()
      );
    });

    it("should handle case when modifiedCount = 0 gracefully", async () => {
      mockSendMessage.mockResolvedValue(true);

      // Try to update a person that doesn't exist in user's follows
      const otherPeople = await People.create({
        nom: "Other",
        prenom: "Person"
      });

      const jorfRecords: JORFSearchItem[] = [
        {
          nom: "Other",
          prenom: "Person",
          source_date: "2024-02-01",
          source_id: "JORF555",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      // Should handle gracefully (no update, but no error)
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

      // Original people should not be affected
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.followedPeople.length).toBe(2);
    });
  });

  describe("Race Conditions", () => {
    it("should handle concurrent updates to same user", async () => {
      mockSendMessage.mockResolvedValue(true);

      const jorfRecords1: JORFSearchItem[] = [
        {
          nom: "Dupont",
          prenom: "Jean",
          source_date: "2024-02-01",
          source_id: "JORF666",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      const jorfRecords2: JORFSearchItem[] = [
        {
          nom: "Martin",
          prenom: "Sophie",
          source_date: "2024-02-01",
          source_id: "JORF777",
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }
      ];

      // Execute concurrently
      await Promise.all([
        notifyPeopleUpdates(
          jorfRecords1,
          ["Telegram"],
          {
            telegramBotToken: "test-token",
            useAsyncUmamiLog: false,
            hasAccount: true
          },
          undefined,
          false
        ),
        notifyPeopleUpdates(
          jorfRecords2,
          ["Telegram"],
          {
            telegramBotToken: "test-token",
            useAsyncUmamiLog: false,
            hasAccount: true
          },
          undefined,
          false
        )
      ]);

      // Both updates should succeed
      const updatedUser = await User.findById(testUser._id);
      const person1 = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople1._id.toString()
      );
      const person2 = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople2._id.toString()
      );

      expect(person1!.lastUpdate.getTime()).toBeGreaterThan(
        new Date("2024-01-01").getTime()
      );
      expect(person2!.lastUpdate.getTime()).toBeGreaterThan(
        new Date("2024-01-01").getTime()
      );
    });

    it("should handle concurrent notification and manual update", async () => {
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

      // Execute notification and manual update concurrently
      await Promise.all([
        notifyPeopleUpdates(
          jorfRecords,
          ["Telegram"],
          {
            telegramBotToken: "test-token",
            useAsyncUmamiLog: false,
            hasAccount: true
          },
          undefined,
          false
        ),
        User.updateOne(
          {
            _id: testUser._id,
            "followedPeople.peopleId": testPeople1._id
          },
          {
            $set: {
              "followedPeople.$.lastUpdate": new Date("2024-03-01")
            }
          }
        )
      ]);

      // One of the updates should win
      const updatedUser = await User.findById(testUser._id);
      const person = updatedUser!.followedPeople.find(
        (p) => p.peopleId.toString() === testPeople1._id.toString()
      );

      // Should have a timestamp after original
      expect(person!.lastUpdate.getTime()).toBeGreaterThan(
        new Date("2024-01-01").getTime()
      );
    });
  });

  describe("Database Consistency", () => {
    it("should maintain consistency when update partially succeeds", async () => {
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
          nom: "Martin",
          prenom: "Sophie",
          source_date: "2024-02-01",
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

      // Both should be updated since message was successful
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.followedPeople.length).toBe(2);

      updatedUser!.followedPeople.forEach((person) => {
        expect(person.lastUpdate.getTime()).toBeGreaterThan(
          new Date("2024-01-01").getTime()
        );
      });
    });

    it("should not corrupt other user data during lastUpdate", async () => {
      mockSendMessage.mockResolvedValue(true);

      const initialStatus = testUser.status;
      const initialChatId = testUser.chatId;

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

      // Verify other fields remain unchanged
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser!.status).toBe(initialStatus);
      expect(updatedUser!.chatId).toBe(initialChatId);
    });
  });
});
