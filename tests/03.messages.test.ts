import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from "@jest/globals";
import axios from "axios";
import umami from "../utils/umami.ts";
import { sendTelegramMessage } from "../entities/TelegramSession.ts";
import {
  sendWhatsAppMessage
} from "../entities/WhatsAppSession.ts";
import { sendSignalAppMessage } from "../entities/SignalSession.ts";
import type { WhatsAppAPI } from "whatsapp-api-js/middleware/express";
import { Interactive, Text } from "whatsapp-api-js/messages";
import type { SignalCli } from "signal-sdk";

const originalBotToken = process.env.BOT_TOKEN;
const originalWhatsappPhoneId = process.env.WHATSAPP_PHONE_ID;

describe("Message delivery helpers", () => {
  beforeEach(() => {
    jest.spyOn(umami, "log").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();

    if (originalBotToken === undefined) delete process.env.BOT_TOKEN;
    else process.env.BOT_TOKEN = originalBotToken;

    if (originalWhatsappPhoneId === undefined)
      delete process.env.WHATSAPP_PHONE_ID;
    else process.env.WHATSAPP_PHONE_ID = originalWhatsappPhoneId;
  });

  it("splits Telegram messages and only attaches the keyboard on the final chunk", async () => {
    process.env.BOT_TOKEN = "123:abc";

    const axiosSpy = jest
      .spyOn(axios, "post")
      .mockResolvedValue({ data: {} } as never);

    const keyboard = [[{ text: "Choisir", desc: "ignored" }]];
    const message = "a".repeat(3001);

    const sent = await sendTelegramMessage(42, message, keyboard);

    expect(sent).toBe(true);
    expect(axiosSpy).toHaveBeenCalledTimes(2);
    const firstPayload = axiosSpy.mock.calls[0]?.[1] as
      | Record<string, unknown>
      | undefined;
    expect(firstPayload?.reply_markup).toBeUndefined();

    const lastPayload = axiosSpy.mock.calls[1]?.[1] as {
      parse_mode: string;
      reply_markup: { keyboard: Array<Array<{ text: string }>> };
    };
    expect(lastPayload.parse_mode).toBe("Markdown");
    expect(lastPayload.reply_markup.keyboard).toEqual([[{ text: "Choisir" }]]);
  });

  it("does not send a WhatsApp interactive keyboard when forceNoKeyboard is true", async () => {
    process.env.WHATSAPP_PHONE_ID = "987654";

    const sendMessage = jest.fn().mockResolvedValue({});
    const fakeApi = { sendMessage } as unknown as WhatsAppAPI;

    const keyboard = [[{ text: "Menu" }]];

    const sent = await sendWhatsAppMessage(fakeApi, 336699, "Bonjour", {
      keyboard,
      forceNoKeyboard: true
    });

    expect(sent).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    const payload = sendMessage.mock.calls[0]?.[2];
    expect(payload).toBeInstanceOf(Text);
  });

  it("splits long WhatsApp messages and attaches the keyboard only to the last part", async () => {
    process.env.WHATSAPP_PHONE_ID = "987654";

    const sendMessage = jest.fn().mockResolvedValue({});
    const fakeApi = { sendMessage } as unknown as WhatsAppAPI;

    const keyboard = [[{ text: "Menu" }]];
    const message = "a".repeat(1024);

    const sent = await sendWhatsAppMessage(fakeApi, 336699, message, {
      keyboard
    });

    expect(sent).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[0]?.[2]).toBeInstanceOf(Text);
    expect(sendMessage.mock.calls[1]?.[2]).toBeInstanceOf(Interactive);
  });

  it("splits Signal messages according to the API limit", async () => {
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    const fakeSignal = { sendMessage } as unknown as SignalCli;

    const message = "a".repeat(2001);

    const sent = await sendSignalAppMessage(fakeSignal, 336699, message);

    expect(sent).toBe(true);
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[0]).toEqual(["+336699", expect.any(String)]);
    expect(sendMessage.mock.calls[0]?.[1]).toHaveLength(2000);
    expect(sendMessage.mock.calls[1]?.[1]).toHaveLength(1);
  });
});
