import "dotenv/config";
import { mongodbConnect } from "../db.ts";
import User from "../models/User.ts";
import { Types } from "mongoose";
import { guardFilter, guardUpdate } from "../utils/database/queryGuard.ts";

interface oldMiniUser {
  _id: Types.ObjectId;
  chatId: number;
}

await (async function () {
  await mongodbConnect();

  const users = (await User.collection
    .find(guardFilter({ chatId: { $exists: true } }))
    .toArray()) as oldMiniUser[];

  let updatedCount = 0;

  for (const user of users) {
    const chatId = user.chatId;

    await User.collection.updateOne(
      guardFilter({ _id: user._id }),
      guardUpdate({ $set: { chatId: String(chatId), schemaVersion: 3 } })
    );
    updatedCount += 1;
  }

  console.log(`Converted chatId to string for ${String(updatedCount)} users.`);

  process.exit(0);
})();
