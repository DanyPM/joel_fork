import { expect } from "@jest/globals";
import mongoose, { Types } from "mongoose";
import User, { USER_SCHEMA_VERSION } from "../models/User.ts";
import { ISession, IUser } from "../types.ts";
import { FunctionTags } from "../entities/FunctionTags.ts";

const userMockChatId = 12346789;

const exampleCurrentFollowedFunctions: IUser["followedFunctions"] = [
  { functionTag: "ambassadeur" as FunctionTags, lastUpdate: new Date() },
  { functionTag: "consul" as FunctionTags, lastUpdate: new Date() }
];

const exampleFollowedNames: IUser["followedNames"] = [
  "Jean Michel",
  "Emmanuel Macron",
  "Jean Luc"
];

const exampleFollowedPeople: IUser["followedPeople"] = [
  { peopleId: new Types.ObjectId(), lastUpdate: new Date() },
  { peopleId: new Types.ObjectId(), lastUpdate: new Date() }
];

const exampleFollowedOrganisations: IUser["followedOrganisations"] = [
  { wikidataId: "123456789", lastUpdate: new Date() },
  { wikidataId: "987654321", lastUpdate: new Date() }
];

const exampleFollowedMeta: IUser["followedMeta"] = [
  {
    metaId: "JORFMETA000000000001",
    granularity: "publication",
    lastUpdate: new Date("2024-01-01T00:00:00.000Z")
  },
  {
    metaId: "JORFMETA000000000002",
    granularity: "tag",
    filters: {
      tags: ["mesure_nominative"],
      ministeres: ["Ministère de la culture"]
    },
    lastUpdate: new Date("2024-02-02T00:00:00.000Z")
  }
];

const MockTelegramSession = {
  chatId: userMockChatId,
  messageApp: "Telegram",
  language_code: "fr",
  user: undefined
} as unknown as ISession;

const legacyUserData_allUndefined = {
  _id: userMockChatId,
  chatId: userMockChatId,
  messageApp: undefined,
  language_code: undefined,
  status: undefined,
  followedPeople: undefined,
  followedFunctions: undefined,
  followedNames: undefined,
  followedOrganisations: undefined,
  followedMeta: undefined,
  schemaVersion: undefined
};

const legacyUserData_withFollows = {
  _id: userMockChatId,
  chatId: userMockChatId,
  messageApp: undefined,
  language_code: "fr",
  status: "active",
  followedPeople: exampleFollowedPeople,
  followedFunctions: exampleCurrentFollowedFunctions,
  followedNames: undefined,
  followedOrganisations: undefined,
  followedMeta: undefined,
  schemaVersion: undefined,
  createAt: Date.now(),
  updatedAt: Date.now()
};

const currentUserData_withFollows = {
  _id: new Types.ObjectId(),
  chatId: userMockChatId,
  messageApp: "Telegram",
  language_code: "en",
  status: "active",
  followedPeople: exampleFollowedPeople,
  followedFunctions: exampleCurrentFollowedFunctions,
  followedNames: exampleFollowedNames,
  followedOrganisations: exampleFollowedOrganisations,
  followedMeta: exampleFollowedMeta,
  lastInteractionDay: Date.now(),
  lastInteractionMonth: Date.now(),
  lastInteractionWeek: Date.now(),
  schemaVersion: 2,
  createAt: Date.now(),
  updatedAt: Date.now()
};

const testUsers = [
  { label: "Legacy user without follows", data: legacyUserData_allUndefined },
  { label: "Legacy user with follows", data: legacyUserData_withFollows },
  { label: "Current user with follows", data: currentUserData_withFollows }
];

describe("User Model Test Suite", () => {
  beforeEach(async () => {
    if (!mongoose.connection.db)
      throw new Error("MongoDB connection not established");
    await mongoose.connection.db.dropDatabase();
  });

  testUsers.map((user) => {
    describe(`Schema Validation: ${user.label}`, () => {
      it("should insert, convert and validate the user data", async () => {
        await User.collection.insertOne(user.data);
        const userFromDB: IUser = await User.findOrCreate(MockTelegramSession);

        expect(userFromDB).not.toBeNull();
        await expect(userFromDB.validate()).resolves.toBeUndefined(); // undefined = validation passed

        const userFromDBLean = userFromDB.toObject();

        // This removes the extra _id mongoose adds when using .toObject with objects as fields
        userFromDBLean.followedPeople = userFromDBLean.followedPeople.map(
          (p) => ({ peopleId: p.peopleId, lastUpdate: p.lastUpdate })
        );

        userFromDBLean.followedOrganisations =
          userFromDBLean.followedOrganisations.map((o) => ({
            wikidataId: o.wikidataId,
            lastUpdate: o.lastUpdate
          }));

        userFromDBLean.followedFunctions = userFromDBLean.followedFunctions.map(
          (f) => ({
            functionTag: f.functionTag,
            lastUpdate: f.lastUpdate
          })
        );

        expect(userFromDBLean.schemaVersion).toBe(USER_SCHEMA_VERSION);

        // User _id should be preserved if we don't upgrade the user from legacy
        if (user.data.schemaVersion != null && user.data.schemaVersion > 1) {
          expect(userFromDBLean._id).toEqual(user.data._id);
        }

        expect(userFromDBLean._id).not.toEqual(user.data.chatId);

        expect(userFromDBLean.status).toEqual(user.data.status ?? "active");

        expect(userFromDBLean.language_code).toEqual(
          user.data.language_code ?? "fr"
        );

        expect(userFromDBLean.messageApp).toBe(
          user.data.messageApp ?? "Telegram"
        );

        expect(userFromDBLean.chatId).toEqual(user.data.chatId);

        expect(userFromDBLean.followedPeople).toEqual(
          user.data.followedPeople ?? []
        );

        const expectedFollowedFunctions: IUser["followedFunctions"] = [];

        for (
          let idx = 0;
          idx < userFromDBLean.followedFunctions.length;
          idx++
        ) {
          expect(userFromDBLean.followedFunctions[idx].functionTag).toEqual(
            expectedFollowedFunctions[idx].functionTag
          );
          expect(
            userFromDBLean.followedFunctions[idx].lastUpdate
          ).toBeDefined();
        }

        expect(userFromDBLean.followedOrganisations).toEqual(
          user.data.followedOrganisations ?? []
        );

        expect(userFromDBLean.followedNames).toEqual(
          user.data.followedNames ?? []
        );

        userFromDBLean.followedMeta = userFromDBLean.followedMeta.map(
          ({ metaId, granularity, filters, lastUpdate }) => ({
            metaId,
            granularity,
            filters,
            lastUpdate
          })
        );

        expect(userFromDBLean.followedMeta).toEqual(
          user.data.followedMeta ?? []
        );
      });
    });
  });
});
