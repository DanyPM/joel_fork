import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { Types } from "mongoose";
import { notifyFunctionTagsUpdates } from "../notifications/functionTagNotifications.ts";
import { notifyOrganisationsUpdates } from "../notifications/organisationNotifications.ts";
import { notifyPeopleUpdates } from "../notifications/peopleNotifications.ts";
import { notifyNameMentionUpdates } from "../notifications/nameNotifications.ts";
import * as Session from "../entities/Session.ts";
import {
  ExternalMessageOptions,
  MessageSendingOptionsExternal
} from "../entities/Session.ts";
import umami from "../utils/umami.ts";
import User from "../models/User.ts";
import Organisation from "../models/Organisation.ts";
import People from "../models/People.ts";
import { FunctionTags } from "../entities/FunctionTags.ts";
import { JORFSearchItem } from "../entities/JORFSearchResponse.ts";
import { IOrganisation, IPeople, IUser, MessageApp } from "../types.ts";

function createLeanQueryMock<T>(result: T) {
  return {
    lean: jest.fn().mockResolvedValue(result)
  } as unknown;
}

function createCollationLeanQueryMock<T>(result: T) {
  const query: { collation: jest.Mock; lean: jest.Mock } = {
    collation: jest.fn(),
    lean: jest.fn()
  };
  query.collation.mockReturnValue(query);
  query.lean.mockResolvedValue(result);
  return query as unknown;
}

let sendMessageSpy: jest.SpyInstance<
  Promise<boolean>,
  [MessageApp, number, string, MessageSendingOptionsExternal?]
>;

beforeEach(() => {
  sendMessageSpy = jest
    .spyOn(Session, "sendMessage")
    .mockResolvedValue(true);
  jest.spyOn(umami, "log").mockResolvedValue();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("notification deliveries", () => {
  const messageOptions = {} as ExternalMessageOptions;

  test("updates function follows when messages are delivered", async () => {
    const userId = new Types.ObjectId();
    const userDocument = {
      _id: userId,
      messageApp: "Telegram",
      chatId: 101,
      followedFunctions: [
        {
          functionTag: FunctionTags["Ministre"],
          lastUpdate: new Date("2024-06-01")
        }
      ],
      schemaVersion: 2
    } as unknown as IUser;

    const userFindSpy = jest
      .spyOn(User, "find")
      .mockReturnValue(createLeanQueryMock([userDocument]) as never);

    const updateSpy = jest
      .spyOn(User, "updateOne")
      .mockResolvedValue({} as never);

    const record: JORFSearchItem = {
      source_date: "2024-06-15",
      source_id: "JORF-FCT-1",
      source_name: "JORF",
      type_ordre: "nomination",
      nom: "Doe",
      prenom: "Jane",
      organisations: [],
      ministre: "Ministère"
    } as JORFSearchItem;

    await notifyFunctionTagsUpdates([record], ["Telegram"], messageOptions);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    const [filter, operation] = updateSpy.mock.calls[0];
    expect(filter).toMatchObject({
      _id: userId,
      "followedFunctions.functionTag": FunctionTags["Ministre"]
    });

    const latestUpdate = (operation as { $set: Record<string, Date> }).$set[
      "followedFunctions.$.lastUpdate"
    ];
    expect(latestUpdate).toBeInstanceOf(Date);
    expect(latestUpdate.toISOString().startsWith("2024-06-15")).toBe(true);

    userFindSpy.mockRestore();
    updateSpy.mockRestore();
  });

  test("updates organisation follows when notifications succeed", async () => {
    const userId = new Types.ObjectId();
    const organisationId = "Q123";

    const userDocument = {
      _id: userId,
      messageApp: "Telegram",
      chatId: 42,
      followedOrganisations: [
        { wikidataId: organisationId, lastUpdate: new Date("2024-01-01") }
      ],
      schemaVersion: 2
    } as unknown as IUser;

    const orgDocument = {
      wikidataId: organisationId,
      nom: "Ministère de la Culture"
    } as unknown as IOrganisation;

    const userFindSpy = jest
      .spyOn(User, "find")
      .mockReturnValue(createLeanQueryMock([userDocument]) as never);

    const organisationFindSpy = jest
      .spyOn(Organisation, "find")
      .mockReturnValue(createLeanQueryMock([orgDocument]) as never);

    const updateSpy = jest
      .spyOn(User, "updateOne")
      .mockResolvedValue({} as never);

    const record: JORFSearchItem = {
      source_date: "2024-05-20",
      source_id: "JORF-ORG-1",
      source_name: "JORF",
      type_ordre: "nomination",
      nom: "Doe",
      prenom: "Jane",
      organisations: [
        {
          nom: "Ministère de la Culture",
          wikidata_id: organisationId
        }
      ]
    } as JORFSearchItem;

    await notifyOrganisationsUpdates([record], ["Telegram"], messageOptions);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    const [filter, operation] = updateSpy.mock.calls[0];
    expect(filter).toMatchObject({
      _id: userId,
      "followedOrganisations.wikidataId": organisationId
    });

    const latestUpdate = (operation as { $set: Record<string, Date> }).$set[
      "followedOrganisations.$.lastUpdate"
    ];
    expect(latestUpdate).toBeInstanceOf(Date);
    expect(latestUpdate.toISOString().startsWith("2024-05-20")).toBe(true);

    userFindSpy.mockRestore();
    organisationFindSpy.mockRestore();
    updateSpy.mockRestore();
  });

  test("updates people follows when WhatsApp deliveries succeed", async () => {
    const peopleId = new Types.ObjectId();
    const userId = new Types.ObjectId();

    const userDocument = {
      _id: userId,
      messageApp: "Telegram",
      chatId: 7,
      followedPeople: [
        {
          peopleId,
          lastUpdate: new Date("2024-01-10")
        }
      ],
      schemaVersion: 2
    } as unknown as IUser;

    const peopleDocument = {
      _id: peopleId,
      nom: "Doe",
      prenom: "Jane"
    } as unknown as IPeople;

    const userFindSpy = jest
      .spyOn(User, "find")
      .mockReturnValue(createLeanQueryMock([userDocument]) as never);

    const peopleFindSpy = jest.spyOn(People, "find");
    const peopleQuery = createCollationLeanQueryMock([peopleDocument]);
    peopleFindSpy.mockReturnValue(peopleQuery as never);

    const updateSpy = jest
      .spyOn(User, "updateOne")
      .mockResolvedValue({} as never);

    const record: JORFSearchItem = {
      source_date: "2024-04-02",
      source_id: "JORF-PEO-1",
      source_name: "JORF",
      type_ordre: "nomination",
      nom: "Doe",
      prenom: "Jane",
      organisations: []
    } as JORFSearchItem;

    await notifyPeopleUpdates([record], ["Telegram"], messageOptions);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    const [filter, operation] = updateSpy.mock.calls[0];
    expect(filter).toMatchObject({
      _id: userId,
      "followedPeople.peopleId": peopleId
    });

    const latestUpdate = (operation as { $set: Record<string, Date> }).$set[
      "followedPeople.$.lastUpdate"
    ];
    expect(latestUpdate).toBeInstanceOf(Date);
    expect(latestUpdate.toISOString().startsWith("2024-04-02")).toBe(true);

    userFindSpy.mockRestore();
    peopleFindSpy.mockRestore();
    updateSpy.mockRestore();
  });

  test("moves manual name follows to people follows with a fresh lastUpdate", async () => {
    jest.useFakeTimers();
    const frozenNow = new Date("2024-07-01T12:00:00Z");
    jest.setSystemTime(frozenNow);

    const userId = new Types.ObjectId();

    const userDocument = {
      _id: userId,
      messageApp: "Telegram",
      chatId: 55,
      followedNames: ["Jane Doe"],
      followedPeople: [],
      schemaVersion: 2
    } as unknown as IUser;

    const userFindSpy = jest
      .spyOn(User, "find")
      .mockReturnValue(createLeanQueryMock([userDocument]) as never);

    const updateSpy = jest
      .spyOn(User, "updateOne")
      .mockResolvedValue({} as never);

    const peopleId = new Types.ObjectId();
    const findOrCreateSpy = jest
      .spyOn(People, "findOrCreate")
      .mockResolvedValue({
        _id: peopleId,
        nom: "Doe",
        prenom: "Jane"
      } as unknown as IPeople);

    const record: JORFSearchItem = {
      source_date: "2024-06-30",
      source_id: "JORF-NAME-1",
      source_name: "JORF",
      type_ordre: "nomination",
      nom: "Doe",
      prenom: "Jane",
      organisations: []
    } as JORFSearchItem;

    await notifyNameMentionUpdates([record], ["Telegram"], messageOptions);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    expect(findOrCreateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    const [, operation] = updateSpy.mock.calls[0];
    const pushClause = (operation as {
      $push: {
        followedPeople: { $each: { peopleId: Types.ObjectId; lastUpdate: Date }[] };
      };
      $pull: { followedNames: { $in: string[] } };
    }).$push.followedPeople.$each[0];

    expect(pushClause.peopleId).toEqual(peopleId);
    expect(pushClause.lastUpdate).toBeInstanceOf(Date);
    expect(pushClause.lastUpdate.getTime()).toBe(frozenNow.getTime());

    const pullClause = (operation as { $pull: { followedNames: { $in: string[] } } }).$pull
      .followedNames.$in;
    expect(pullClause).toEqual(["Jane Doe"]);

    userFindSpy.mockRestore();
    updateSpy.mockRestore();
    findOrCreateSpy.mockRestore();
  });
});
