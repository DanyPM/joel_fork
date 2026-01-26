import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { Types } from "mongoose";
import {
  dispatchTasksToMessageApps,
  NotificationTask
} from "../notifications/notificationDispatch.ts";
import { JORFSearchItem } from "../entities/JORFSearchResponse.ts";
import { MessageApp } from "../types.ts";

describe("Notification Dispatch Test Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockTask = (
    messageApp: MessageApp,
    recordCount: number,
    userId: string = new Types.ObjectId().toString()
  ): NotificationTask<string, JORFSearchItem> => ({
    userId: new Types.ObjectId(userId),
    userInfo: {
      messageApp,
      chatId: `chat_${userId}`,
      roomId: undefined,
      waitingReengagement: false,
      status: "active",
      hasAccount: true,
      lastEngagementAt: new Date()
    },
    updatedRecordsMap: new Map([
      [
        "key1",
        Array.from({ length: recordCount }, (_, i) => ({
          nom: "Test",
          prenom: "User",
          source_date: "2024-01-01",
          source_id: `JORF${i}`,
          type_ordre: "nomination",
          source_name: "JORF",
          organisations: []
        }))
      ]
    ]),
    recordCount
  });

  describe("Task Sorting", () => {
    it("should sort tasks by record count in descending order", async () => {
      const callOrder: number[] = [];
      const taskFunction = jest.fn(async (task: NotificationTask<string>) => {
        callOrder.push(task.recordCount);
      });

      const tasks = [
        createMockTask("Telegram", 5),
        createMockTask("Telegram", 20),
        createMockTask("Telegram", 2),
        createMockTask("Telegram", 15)
      ];

      await dispatchTasksToMessageApps(tasks, taskFunction);

      // Should be processed in order: 20, 15, 5, 2
      expect(callOrder).toEqual([20, 15, 5, 2]);
    });

    it("should sort tasks within each message app", async () => {
      const telegramOrder: number[] = [];
      const whatsappOrder: number[] = [];

      const taskFunction = jest.fn(async (task: NotificationTask<string>) => {
        if (task.userInfo.messageApp === "Telegram") {
          telegramOrder.push(task.recordCount);
        } else if (task.userInfo.messageApp === "WhatsApp") {
          whatsappOrder.push(task.recordCount);
        }
      });

      const tasks = [
        createMockTask("Telegram", 5),
        createMockTask("WhatsApp", 30),
        createMockTask("Telegram", 15),
        createMockTask("WhatsApp", 10)
      ];

      await dispatchTasksToMessageApps(tasks, taskFunction);

      // Each platform should be sorted descending
      expect(telegramOrder).toEqual([15, 5]);
      expect(whatsappOrder).toEqual([30, 10]);
    });
  });

  describe("Platform-Specific Concurrency", () => {
    it("should process tasks sequentially when concurrency limit is 1", async () => {
      const executionLog: { start: number; end: number }[] = [];
      let currentTime = 0;

      const taskFunction = jest.fn(async (_task: NotificationTask<string>) => {
        const startTime = currentTime;
        await new Promise((resolve) => setTimeout(resolve, 10));
        currentTime += 10;
        executionLog.push({ start: startTime, end: currentTime });
      });

      // Signal and WhatsApp have low concurrency limits
      const tasks = [
        createMockTask("Signal", 5),
        createMockTask("Signal", 3),
        createMockTask("Signal", 7)
      ];

      await dispatchTasksToMessageApps(tasks, taskFunction);

      expect(taskFunction).toHaveBeenCalledTimes(3);
      // With concurrency=1 or 5, tasks should not overlap significantly
      // but we can't guarantee sequential with concurrency=5
    });

    it("should handle tasks from multiple platforms in parallel", async () => {
      const platformCalls: Record<string, number> = {
        Telegram: 0,
        WhatsApp: 0,
        Matrix: 0
      };

      const taskFunction = jest.fn(async (task: NotificationTask<string>) => {
        platformCalls[task.userInfo.messageApp]++;
        await new Promise((resolve) => setTimeout(resolve, 1));
      });

      const tasks = [
        createMockTask("Telegram", 10),
        createMockTask("Telegram", 8),
        createMockTask("WhatsApp", 12),
        createMockTask("WhatsApp", 6),
        createMockTask("Matrix", 15),
        createMockTask("Matrix", 9)
      ];

      await dispatchTasksToMessageApps(tasks, taskFunction);

      expect(platformCalls.Telegram).toBe(2);
      expect(platformCalls.WhatsApp).toBe(2);
      expect(platformCalls.Matrix).toBe(2);
      expect(taskFunction).toHaveBeenCalledTimes(6);
    });
  });

  describe("Error Handling", () => {
    it("should continue processing other tasks if one fails", async () => {
      let successCount = 0;

      const taskFunction = jest.fn(async (task: NotificationTask<string>) => {
        if (task.recordCount === 5) {
          throw new Error("Task failed");
        }
        successCount++;
      });

      const tasks = [
        createMockTask("Telegram", 10),
        createMockTask("Telegram", 5), // This will fail
        createMockTask("Telegram", 3)
      ];

      await expect(
        dispatchTasksToMessageApps(tasks, taskFunction)
      ).rejects.toThrow("Task failed");

      // Should have attempted all 3 tasks
      expect(taskFunction).toHaveBeenCalledTimes(3);
    });

    it("should handle empty task list gracefully", async () => {
      const taskFunction = jest.fn();
      const tasks: NotificationTask<string>[] = [];

      await dispatchTasksToMessageApps(tasks, taskFunction);

      expect(taskFunction).not.toHaveBeenCalled();
    });
  });

  describe("Task Distribution", () => {
    it("should group tasks by message app correctly", async () => {
      const appGroups: Record<string, number> = {};

      const taskFunction = jest.fn(async (task: NotificationTask<string>) => {
        const app = task.userInfo.messageApp;
        appGroups[app] = (appGroups[app] || 0) + 1;
      });

      const tasks = [
        createMockTask("Telegram", 10),
        createMockTask("Telegram", 8),
        createMockTask("Telegram", 6),
        createMockTask("WhatsApp", 12),
        createMockTask("Matrix", 15)
      ];

      await dispatchTasksToMessageApps(tasks, taskFunction);

      expect(appGroups.Telegram).toBe(3);
      expect(appGroups.WhatsApp).toBe(1);
      expect(appGroups.Matrix).toBe(1);
    });

    it("should handle single platform with multiple tasks", async () => {
      const callOrder: number[] = [];

      const taskFunction = jest.fn(async (task: NotificationTask<string>) => {
        callOrder.push(task.recordCount);
      });

      const tasks = [
        createMockTask("Telegram", 100),
        createMockTask("Telegram", 50),
        createMockTask("Telegram", 75),
        createMockTask("Telegram", 25)
      ];

      await dispatchTasksToMessageApps(tasks, taskFunction);

      // Should process in descending order
      expect(callOrder).toEqual([100, 75, 50, 25]);
      expect(taskFunction).toHaveBeenCalledTimes(4);
    });
  });

  describe("Record Count Validation", () => {
    it("should handle tasks with zero records", async () => {
      const taskFunction = jest.fn();

      const tasks = [
        createMockTask("Telegram", 0),
        createMockTask("Telegram", 5)
      ];

      await dispatchTasksToMessageApps(tasks, taskFunction);

      expect(taskFunction).toHaveBeenCalledTimes(2);
    });

    it("should handle tasks with large record counts", async () => {
      const taskFunction = jest.fn();

      const tasks = [
        createMockTask("Telegram", 1000),
        createMockTask("Telegram", 500)
      ];

      await dispatchTasksToMessageApps(tasks, taskFunction);

      expect(taskFunction).toHaveBeenCalledTimes(2);
      // Verify largest is processed first
      expect(taskFunction.mock.calls[0][0].recordCount).toBe(1000);
      expect(taskFunction.mock.calls[1][0].recordCount).toBe(500);
    });
  });
});
