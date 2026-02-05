import { describe, expect, it, beforeEach } from "@jest/globals";
import mongoose, { Types } from "mongoose";
import User from "../models/User.ts";
import { IUser, JORFReference, NotificationType } from "../types.ts";

describe("Pending Notifications Management Tests", () => {
  let testUser: IUser;

  beforeEach(async () => {
    if (!mongoose.connection.db)
      throw new Error("MongoDB connection not established");
    await mongoose.connection.db.dropDatabase();

    // Create test user
    testUser = await User.create({
      chatId: "test123",
      messageApp: "Telegram",
      schemaVersion: 3,
      followedPeople: []
    });
  });

  describe("insertPendingNotifications", () => {
    it("should insert pending notifications correctly", async () => {
      const notificationSources = new Map<JORFReference, number>([
        ["JORF123", 5],
        ["JORF456", 3]
      ]);

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        notificationSources
      );

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.pendingNotifications.length).toBe(1);

      const notification = updatedUser!.pendingNotifications[0];
      expect(notification.notificationType).toBe("people");
      expect(notification.source_ids).toEqual(["JORF123", "JORF456"]);
      expect(notification.items_nb).toBe(8); // 5 + 3
      expect(notification.insertDate).toBeInstanceOf(Date);
    });

    it("should prevent duplicate source_ids across notifications", async () => {
      // Insert first batch
      const firstBatch = new Map<JORFReference, number>([
        ["JORF123", 5],
        ["JORF456", 3]
      ]);

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        firstBatch
      );

      // Insert second batch with some duplicates
      const secondBatch = new Map<JORFReference, number>([
        ["JORF123", 2], // Duplicate
        ["JORF789", 4] // New
      ]);

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        secondBatch
      );

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.pendingNotifications.length).toBe(2);

      // Second notification should only contain JORF789
      const secondNotification = updatedUser!.pendingNotifications[1];
      expect(secondNotification.source_ids).toEqual(["JORF789"]);
      expect(secondNotification.items_nb).toBe(4);
    });

    it("should be idempotent - multiple calls with same data don't duplicate", async () => {
      const notificationSources = new Map<JORFReference, number>([
        ["JORF123", 5],
        ["JORF456", 3]
      ]);

      // Insert same data twice
      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        notificationSources
      );

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        notificationSources
      );

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();

      // Should have 1 notification with original data (first insert)
      // Second insert should be skipped as duplicates
      expect(updatedUser!.pendingNotifications.length).toBe(1);
      expect(updatedUser!.pendingNotifications[0].source_ids).toEqual([
        "JORF123",
        "JORF456"
      ]);
    });

    it("should handle empty notification sources gracefully", async () => {
      const emptyMap = new Map<JORFReference, number>();

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        emptyMap
      );

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.pendingNotifications.length).toBe(0);
    });

    it("should handle different notification types separately", async () => {
      const peopleSources = new Map<JORFReference, number>([["JORF123", 5]]);
      const orgSources = new Map<JORFReference, number>([["JORF456", 3]]);
      const functionSources = new Map<JORFReference, number>([["JORF789", 2]]);

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        peopleSources
      );

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "organisation",
        orgSources
      );

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "function",
        functionSources
      );

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.pendingNotifications.length).toBe(3);

      const types = updatedUser!.pendingNotifications.map(
        (n) => n.notificationType
      );
      expect(types).toContain("people");
      expect(types).toContain("organisation");
      expect(types).toContain("function");
    });

    it("should calculate items_nb correctly from notification sources", async () => {
      const notificationSources = new Map<JORFReference, number>([
        ["JORF123", 10],
        ["JORF456", 15],
        ["JORF789", 7]
      ]);

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        notificationSources
      );

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser).not.toBeNull();
      expect(updatedUser!.pendingNotifications[0].items_nb).toBe(32); // 10+15+7
    });

    it("should handle user not found gracefully", async () => {
      const fakeUserId = new Types.ObjectId();
      const notificationSources = new Map<JORFReference, number>([
        ["JORF123", 5]
      ]);

      // Should not throw, just log error
      await User.insertPendingNotifications(
        fakeUserId,
        "Telegram",
        "people",
        notificationSources
      );

      // Verify no user was created
      const user = await User.findById(fakeUserId);
      expect(user).toBeNull();
    });
  });

  describe("Pending Notifications Retrieval", () => {
    it("should retrieve all pending notifications for a user", async () => {
      // Insert multiple notifications
      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        new Map([["JORF123", 5]])
      );

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "organisation",
        new Map([["JORF456", 3]])
      );

      const user = await User.findById(testUser._id);
      expect(user).not.toBeNull();
      expect(user!.pendingNotifications.length).toBe(2);
    });

    it("should maintain insertion order of pending notifications", async () => {
      const firstInsertDate = new Date();
      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        new Map([["JORF123", 5]])
      );

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "organisation",
        new Map([["JORF456", 3]])
      );

      const user = await User.findById(testUser._id);
      expect(user).not.toBeNull();
      expect(user!.pendingNotifications.length).toBe(2);

      // First notification should have earlier insertDate
      expect(
        user!.pendingNotifications[0].insertDate.getTime()
      ).toBeLessThanOrEqual(user!.pendingNotifications[1].insertDate.getTime());
    });
  });

  describe("Pending Notifications Clearing", () => {
    it("should clear all pending notifications", async () => {
      // Insert notifications
      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        new Map([["JORF123", 5]])
      );

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "organisation",
        new Map([["JORF456", 3]])
      );

      // Clear all notifications
      await User.updateOne(
        { _id: testUser._id },
        { $set: { pendingNotifications: [] } }
      );

      const user = await User.findById(testUser._id);
      expect(user).not.toBeNull();
      expect(user!.pendingNotifications.length).toBe(0);
    });

    it("should clear pending notifications after successful trigger", async () => {
      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        new Map([["JORF123", 5]])
      );

      // Simulate successful trigger
      await User.updateOne(
        { _id: testUser._id },
        { $set: { pendingNotifications: [], waitingReengagement: false } }
      );

      const user = await User.findById(testUser._id);
      expect(user).not.toBeNull();
      expect(user!.pendingNotifications.length).toBe(0);
      expect(user!.waitingReengagement).toBe(false);
    });
  });

  describe("Pending Notifications Persistence", () => {
    it("should persist pending notifications across queries", async () => {
      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        new Map([["JORF123", 5]])
      );

      // First query
      const user1 = await User.findById(testUser._id);
      expect(user1!.pendingNotifications.length).toBe(1);

      // Second query (simulating app restart)
      const user2 = await User.findById(testUser._id);
      expect(user2!.pendingNotifications.length).toBe(1);
      expect(user2!.pendingNotifications[0].source_ids).toEqual(["JORF123"]);
    });

    it("should preserve all notification metadata", async () => {
      const beforeInsert = new Date();

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        new Map([
          ["JORF123", 5],
          ["JORF456", 3]
        ])
      );

      const user = await User.findById(testUser._id);
      const notification = user!.pendingNotifications[0];

      expect(notification.notificationType).toBe("people");
      expect(notification.source_ids).toHaveLength(2);
      expect(notification.items_nb).toBe(8);
      expect(notification.insertDate.getTime()).toBeGreaterThanOrEqual(
        beforeInsert.getTime()
      );
    });
  });

  describe("Multiple Users Scenarios", () => {
    it("should handle pending notifications for multiple users independently", async () => {
      const user2 = await User.create({
        chatId: "test456",
        messageApp: "WhatsApp",
        schemaVersion: 3,
        followedPeople: []
      });

      // Insert for user1
      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        new Map([["JORF123", 5]])
      );

      // Insert for user2
      await User.insertPendingNotifications(
        user2._id,
        "WhatsApp",
        "organisation",
        new Map([["JORF456", 3]])
      );

      const updatedUser1 = await User.findById(testUser._id);
      const updatedUser2 = await User.findById(user2._id);

      expect(updatedUser1!.pendingNotifications.length).toBe(1);
      expect(updatedUser1!.pendingNotifications[0].notificationType).toBe(
        "people"
      );

      expect(updatedUser2!.pendingNotifications.length).toBe(1);
      expect(updatedUser2!.pendingNotifications[0].notificationType).toBe(
        "organisation"
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle very large source_ids arrays", async () => {
      const largeMap = new Map<JORFReference, number>();
      for (let i = 0; i < 100; i++) {
        largeMap.set(`JORF${i}`, 1);
      }

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        largeMap
      );

      const user = await User.findById(testUser._id);
      expect(user!.pendingNotifications[0].source_ids.length).toBe(100);
      expect(user!.pendingNotifications[0].items_nb).toBe(100);
    });

    it("should handle notifications with zero items_nb from sources", async () => {
      const zeroMap = new Map<JORFReference, number>([
        ["JORF123", 0],
        ["JORF456", 0]
      ]);

      await User.insertPendingNotifications(
        testUser._id,
        "Telegram",
        "people",
        zeroMap
      );

      const user = await User.findById(testUser._id);
      expect(user!.pendingNotifications.length).toBe(1);
      expect(user!.pendingNotifications[0].items_nb).toBe(0);
    });

    it("should handle all notification types", async () => {
      const notificationTypes: NotificationType[] = [
        "people",
        "organisation",
        "function",
        "name",
        "meta"
      ];

      for (const type of notificationTypes) {
        await User.insertPendingNotifications(
          testUser._id,
          "Telegram",
          type,
          new Map([[`JORF_${type}`, 1]])
        );
      }

      const user = await User.findById(testUser._id);
      expect(user!.pendingNotifications.length).toBe(5);

      const types = user!.pendingNotifications.map((n) => n.notificationType);
      notificationTypes.forEach((type) => {
        expect(types).toContain(type);
      });
    });
  });
});
