import { jest } from "@jest/globals";
import {
  askFollowUpQuestion,
  clearFollowUp,
  handleFollowUpMessage,
  hasFollowUp
} from "../entities/FollowUpManager";

describe("FollowUpManager", () => {
  const createSession = (chatId = 123) => ({
    messageApp: "Telegram" as const,
    chatId,
    sendMessage: jest.fn().mockResolvedValue(undefined)
  });

  const resetSession = (session) => {
    clearFollowUp(session as any);
  };

  it("stores handlers, context and sends the provided question", async () => {
    const session = createSession();
    resetSession(session);

    const handler = jest.fn().mockResolvedValue(true);
    const options = {
      context: { foo: "bar" },
      messageOptions: { keyboard: [[{ text: "Test" }]] }
    };

    await askFollowUpQuestion(session as any, "Question?", handler, options);

    expect(session.sendMessage).toHaveBeenCalledWith(
      "Question?",
      options.messageOptions
    );
    expect(hasFollowUp(session as any)).toBe(true);

    const handled = await handleFollowUpMessage(session as any, "answer");
    expect(handled).toBe(true);
    expect(handler).toHaveBeenCalledWith(session, "answer", options.context);
  });

  it("skips sending empty questions while retaining the handler", async () => {
    const session = createSession(456);
    resetSession(session);

    const handler = jest.fn().mockResolvedValue(true);
    await askFollowUpQuestion(session as any, "", handler);

    expect(session.sendMessage).not.toHaveBeenCalled();
    expect(hasFollowUp(session as any)).toBe(true);
    clearFollowUp(session as any);
  });

  it("rolls back state when sending the question fails", async () => {
    const session = createSession(789);
    resetSession(session);
    session.sendMessage.mockRejectedValueOnce(new Error("boom"));

    await expect(
      askFollowUpQuestion(session as any, "Will fail", jest.fn())
    ).rejects.toThrow("boom");

    expect(hasFollowUp(session as any)).toBe(false);
  });

  it("returns false when no follow-up is registered", async () => {
    const session = createSession(100);
    resetSession(session);

    const handled = await handleFollowUpMessage(session as any, "ignored");
    expect(handled).toBe(false);
  });

  it("invokes registered handler once and clears state before invocation", async () => {
    const session = createSession(200);
    resetSession(session);

    const handler = jest
      .fn()
      .mockImplementation(async (_session, message, context) => {
        expect(hasFollowUp(session as any)).toBe(false);
        expect(message).toBe("Reply");
        expect(context).toEqual({ tracked: true });
        return true;
      });

    await askFollowUpQuestion(session as any, "Prompt", handler, {
      context: { tracked: true }
    });

    const result = await handleFollowUpMessage(session as any, "Reply");

    expect(result).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(hasFollowUp(session as any)).toBe(false);
  });

  it("can clear follow-ups proactively", async () => {
    const session = createSession(300);
    resetSession(session);

    await askFollowUpQuestion(session as any, "Prompt", jest.fn(), {});
    expect(hasFollowUp(session as any)).toBe(true);

    clearFollowUp(session as any);
    expect(hasFollowUp(session as any)).toBe(false);
  });
});
