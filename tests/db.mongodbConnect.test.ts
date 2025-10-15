import { describe, expect, it, beforeEach, afterEach, jest } from "@jest/globals";
import { ErrorMessages } from "../entities/ErrorMessages.ts";

const connectMock = jest.fn();

await jest.unstable_mockModule("mongoose", () => ({
  default: { connect: connectMock },
  connect: connectMock
}));

const { mongodbConnect } = await import("../db.ts");

const ORIGINAL_ENV = process.env.MONGODB_URI;

describe("mongodbConnect", () => {
  beforeEach(() => {
    connectMock.mockClear();
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = ORIGINAL_ENV;
    }
  });

  it("throws when MONGODB_URI is missing", async () => {
    delete process.env.MONGODB_URI;

    await expect(mongodbConnect()).rejects.toThrow(
      ErrorMessages.MONGODB_URI_NOT_SET
    );
    expect(connectMock).not.toHaveBeenCalled();
  });

  it("connects using the provided URI", async () => {
    const uri = "mongodb://example.test/database";
    process.env.MONGODB_URI = uri;
    connectMock.mockResolvedValueOnce(undefined);

    await expect(mongodbConnect()).resolves.toBeUndefined();
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(connectMock).toHaveBeenCalledWith(uri);
  });
});
