import { describe, expect, it } from "@jest/globals";
import { ErrorMessages } from "../entities/ErrorMessages.ts";

const expectedEntries: Array<[keyof typeof ErrorMessages, string]> = [
  [
    "MONGODB_URI_NOT_SET",
    "MONGODB_URI is not set. Please set it in your .env file"
  ],
  [
    "TELEGRAM_BOT_TOKEN_NOT_SET",
    "BOT_TOKEN is not set. Please set it in your .env file"
  ],
  [
    "WHATSAPP_ENV_NOT_SET",
    "WHATSAPP_ENV variables are not set. Please set it in your .env file"
  ],
  [
    "SIGNAL_ENV_NOT_SET",
    "SIGNAL_ENV variables are not set. Please set it in your .env file"
  ]
];

describe("ErrorMessages enum", () => {
  it("exposes all expected error messages", () => {
    expect(Object.keys(ErrorMessages).sort()).toEqual(
      expectedEntries.map(([key]) => key).sort()
    );
  });

  it("matches the documented message strings", () => {
    for (const [key, expectedMessage] of expectedEntries) {
      expect(ErrorMessages[key]).toBe(expectedMessage);
    }
  });
});
