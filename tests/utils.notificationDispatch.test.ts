import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Types } from "mongoose";
import type { MessageApp } from "../types.ts";

type NotificationTask<T> = import("../utils/notificationDispatch.ts").NotificationTask<T>;

const limiterMocks: jest.Mock[] = [];
const pLimitMock = jest.fn(() => {
  const limiter = jest.fn(async (fn: () => Promise<void> | void) => fn());
  limiterMocks.push(limiter);
  return limiter;
});

await jest.unstable_mockModule("p-limit", () => ({
  default: pLimitMock
}));

await jest.unstable_mockModule("../entities/TelegramSession.ts", () => ({
  TELEGRAM_API_SENDING_CONCURRENCY: 2
}));

await jest.unstable_mockModule("../entities/WhatsAppSession.ts", () => ({
  WHATSAPP_API_SENDING_CONCURRENCY: 3
}));

await jest.unstable_mockModule("../entities/SignalSession.ts", () => ({
  SIGNAL_API_SENDING_CONCURRENCY: 1
}));

const { dispatchTasksToMessageApps } = await import("../utils/notificationDispatch.ts");

describe("dispatchTasksToMessageApps", () => {
  beforeEach(() => {
    limiterMocks.length = 0;
    pLimitMock.mockClear();
  });

  it("groups tasks per message app, sorts by record count, and applies concurrency limits", async () => {
    const taskFactory = (
      messageApp: MessageApp,
      recordCount: number
    ): NotificationTask<string> => ({
      userId: new Types.ObjectId(),
      messageApp,
      chatId: `chat-${messageApp}-${recordCount}`,
      updatedRecordsMap: new Map(),
      recordCount
    });

    const tasks: NotificationTask<string>[] = [
      taskFactory("Signal", 1),
      taskFactory("Telegram", 4),
      taskFactory("WhatsApp", 3),
      taskFactory("Telegram", 2),
      taskFactory("Signal", 5)
    ];

    const perAppOrder = new Map<MessageApp, number[]>();
    const taskHandler = jest.fn(async (task: NotificationTask<string>) => {
      const sequence = perAppOrder.get(task.messageApp) ?? [];
      sequence.push(task.recordCount);
      perAppOrder.set(task.messageApp, sequence);
    });

    await dispatchTasksToMessageApps(tasks, taskHandler);

    expect(tasks.map((task) => task.recordCount)).toEqual([5, 4, 3, 2, 1]);

    expect(perAppOrder.get("Signal")).toEqual([5, 1]);
    expect(perAppOrder.get("Telegram")).toEqual([4, 2]);
    expect(perAppOrder.get("WhatsApp")).toEqual([3]);

    expect(taskHandler).toHaveBeenCalledTimes(tasks.length);

    expect(pLimitMock.mock.calls).toEqual([[1], [2], [3]]);

    expect(limiterMocks).toHaveLength(3);
    expect(limiterMocks[0].mock.calls).toHaveLength(2); // Signal has two tasks
    expect(limiterMocks[1].mock.calls).toHaveLength(2); // Telegram has two tasks
    expect(limiterMocks[2].mock.calls).toHaveLength(1); // WhatsApp has one task
  });
});
