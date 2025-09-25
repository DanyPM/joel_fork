import {
  ISession,
  IUser,
  IUserFollowedMetaPreference,
  MessageApp
} from "../types.ts";
import { USER_SCHEMA_VERSION } from "../models/User.ts";
import User from "../models/User.ts";
import { IRawUser, LegacyRawUser_V2 } from "../models/LegacyUser.ts";
import { sendTelegramMessage } from "./TelegramSession.ts";
import { sendWhatsAppMessage } from "./WhatsAppSession.ts";
import { WhatsAppAPI } from "whatsapp-api-js/middleware/express";
import { sendSignalAppMessage } from "./SignalSession.ts";
import { SignalCli } from "signal-sdk";
//import { MatrixClient } from "matrix-bot-sdk";
import { Keyboard } from "./Keyboard.ts";

export interface ExternalMessageOptions {
  //matrixClient?: MatrixClient;
  signalCli?: SignalCli;
  whatsAppAPI?: WhatsAppAPI;
  forceNoKeyboard?: boolean;
  keyboard?: Keyboard;
}

export async function loadUser(session: ISession): Promise<IUser | null> {
  if (session.user != null) return null;

  return User.findOne({
    messageApp: session.messageApp,
    chatId: session.chatId
  });

  /*
  if (user == null) {
    const legacyUser = (await User.collection.findOne({
      messageApp: session.messageApp,
      chatId: session.chatId
    })) as IRawUser | null;
    if (legacyUser !== null) {
      await migrateUser(legacyUser);
      // now return the migrated user
      return User.findOne({
        messageApp: session.messageApp,
        chatId: session.chatId
      });
    }
  }
  return user;
   */
}

export async function migrateUser(rawUser: IRawUser): Promise<void> {
  const currentVersion = rawUser.schemaVersion ?? 1;

  if (currentVersion === USER_SCHEMA_VERSION) return;

  let workingVersion = currentVersion;

  if (workingVersion < 3) {
    const legacyUser = rawUser as LegacyRawUser_V2;

    try {
      await User.collection.updateOne(
        { messageApp: legacyUser.messageApp, chatId: legacyUser.chatId },
        { $set: { schemaVersion: 3, chatId: legacyUser.chatId.toString() } }
      );
      workingVersion = 3;
    } catch (err) {
      console.error("Migration failed:", err);
      return;
    }
  }

  if (workingVersion < 4) {
    const legacyUser = rawUser as LegacyRawUser_V2;
    const normalizedMeta: IUserFollowedMetaPreference[] = (
      legacyUser.followedMeta ?? []
    ).map((meta) => ({
      module: meta.metaType ?? "custom",
      granularity: "module",
      identifier: meta.metaType,
      label: meta.metaType,
      filters: [],
      lastUpdate: meta.lastUpdate ?? new Date()
    }));

    try {
      await User.collection.updateOne(
        { messageApp: legacyUser.messageApp, chatId: legacyUser.chatId },
        {
          $set: {
            schemaVersion: USER_SCHEMA_VERSION,
            followedMeta: normalizedMeta
          }
        }
      );
    } catch (err) {
      console.error("Migration failed:", err);
    }
    return;
  }

  throw new Error("Unknown schema version");
}

export async function recordSuccessfulDelivery(
  messageApp: MessageApp,
  chatId: number
): Promise<void> {
  await User.updateOne(
    { messageApp, chatId },
    { $set: { lastMessageReceivedAt: new Date(), status: "active" } }
  );
}

export async function sendMessage(
  messageApp: MessageApp,
  chatId: number,
  message: string,
  options?: {
    //matrixClient?: MatrixClient;
    signalCli?: SignalCli;
    whatsAppAPI?: WhatsAppAPI;
    forceNoKeyboard?: boolean;
    keyboard?: Keyboard;
  }
): Promise<boolean> {
  switch (messageApp) {
    /*
      case "Matrix":
        if (options?.matrixClient == null)
          throw new Error("matrixClient is required");
        return await sendMatrixMessage(
          options.matrixClient,
          chatId,
          message,
          options.keyboard
        );
        */

    case "Signal":
      if (options?.signalCli == null) throw new Error("signalCli is required");
      return await sendSignalAppMessage(options.signalCli, chatId, message);

    case "Telegram":
      return await sendTelegramMessage(chatId, message, options?.keyboard);

    case "WhatsApp":
      if (options?.whatsAppAPI == null)
        throw new Error("WhatsAppAPI is required");
      return await sendWhatsAppMessage(
        options.whatsAppAPI,
        chatId,
        message,
        options
      );
  }
  return false;
}
