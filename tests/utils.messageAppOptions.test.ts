import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from "@jest/globals";
import { ErrorMessages } from "../entities/ErrorMessages.ts";
import { WHATSAPP_API_VERSION } from "../entities/WhatsAppSession.ts";
import type { WhatsAppAPI } from "whatsapp-api-js/middleware/express";
import type { SignalCli } from "signal-sdk";

const mockWhatsAppAPI = jest
  .fn((config: Record<string, unknown>) => ({
    ...config,
    kind: "whatsAppAPI"
  }) as unknown as WhatsAppAPI);

const mockSignalConnect = jest.fn().mockResolvedValue(undefined);
const mockSignalCli = jest
  .fn((batPath: string, phone: string) => ({
    connect: mockSignalConnect,
    batPath,
    phone
  }) as unknown as SignalCli);

await jest.unstable_mockModule("whatsapp-api-js/middleware/express", () => ({
  WhatsAppAPI: mockWhatsAppAPI
}));

await jest.unstable_mockModule("signal-sdk", () => ({
  SignalCli: mockSignalCli
}));

const {
  parseEnabledMessageApps,
  resolveExternalMessageOptions
} = await import("../utils/messageAppOptions.ts");

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("parseEnabledMessageApps", () => {
  it("throws when the env var is missing", () => {
    delete process.env.ENABLED_APPS;
    expect(() => parseEnabledMessageApps()).toThrow(
      "ENABLED_APPS env var not set"
    );
  });

  it("filters unsupported apps and logs a warning", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const enabled = parseEnabledMessageApps('["Telegram", "Fax"]');

    expect(enabled).toEqual(["Telegram"]);
    expect(warnSpy).toHaveBeenCalledWith("Ignoring unsupported apps: Fax");

    warnSpy.mockRestore();
  });
});

describe("resolveExternalMessageOptions", () => {
  it("throws if WhatsApp configuration is missing", async () => {
    await expect(
      resolveExternalMessageOptions(["WhatsApp"])
    ).rejects.toThrow(ErrorMessages.WHATSAPP_ENV_NOT_SET);
  });

  it("throws if Signal configuration is missing", async () => {
    await expect(
      resolveExternalMessageOptions(["Signal"], {})
    ).rejects.toThrow(ErrorMessages.SIGNAL_ENV_NOT_SET);
  });

  it("creates messaging clients when env vars are provided", async () => {
    process.env.WHATSAPP_USER_TOKEN = "token";
    process.env.WHATSAPP_APP_SECRET = "secret";
    process.env.WHATSAPP_VERIFY_TOKEN = "verify";
    process.env.SIGNAL_BAT_PATH = "/bin/signal";
    process.env.SIGNAL_PHONE_NUMBER = "+33123456789";

    const result = await resolveExternalMessageOptions([
      "WhatsApp",
      "Signal"
    ]);

    expect(mockWhatsAppAPI).toHaveBeenCalledWith({
      token: "token",
      appSecret: "secret",
      webhookVerifyToken: "verify",
      v: WHATSAPP_API_VERSION
    });
    expect(result.whatsAppAPI).toEqual({
      token: "token",
      appSecret: "secret",
      webhookVerifyToken: "verify",
      v: WHATSAPP_API_VERSION,
      kind: "whatsAppAPI"
    });

    expect(mockSignalCli).toHaveBeenCalledWith(
      "/bin/signal",
      "+33123456789"
    );
    expect(mockSignalConnect).toHaveBeenCalledTimes(1);
    expect(result.signalCli).toEqual({
      connect: mockSignalConnect,
      batPath: "/bin/signal",
      phone: "+33123456789"
    });
  });

  it("reuses provided messaging clients", async () => {
    const existing = {
      whatsAppAPI: { ready: true } as unknown as WhatsAppAPI,
      signalCli: { connect: jest.fn() } as unknown as SignalCli
    };

    const result = await resolveExternalMessageOptions([
      "WhatsApp",
      "Signal"
    ], existing);

    expect(result).toBe(existing);
    expect(mockWhatsAppAPI).not.toHaveBeenCalled();
    expect(mockSignalCli).not.toHaveBeenCalled();
  });
});
