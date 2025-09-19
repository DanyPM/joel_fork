import "dotenv/config";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { mongodbConnect } from "../db.ts";
import { TelegramSession } from "../entities/TelegramSession.ts";
import { processMessage } from "../commands/Commands.ts";
import umami from "../utils/umami.ts";
import { ErrorMessages } from "../entities/ErrorMessages.ts";
import { TelegramReplyManager } from "../utils/TelegramReplyManager.ts";

const BOT_TOKEN = process.env.BOT_TOKEN;
if (BOT_TOKEN === undefined)
  throw new Error(ErrorMessages.TELEGRAM_BOT_TOKEN_NOT_SET);

const bot = new Telegraf(BOT_TOKEN);
const replyManager = new TelegramReplyManager();

await (async () => {
  await mongodbConnect();

  bot.on(message("text"), (ctx) => {
    void (async () => {
      await umami.log({ event: "/message-telegram" });
      try {
        const tgUser = ctx.from;
        const chat = ctx.chat;
        const messageText = ctx.message.text;

        if (tgUser === undefined || tgUser.is_bot) return;
        if (chat === undefined || messageText === undefined) return;

        const tgSession = new TelegramSession(
          bot,
          replyManager,
          chat.id.toString(),
          tgUser.language_code ?? "fr"
        );
        await tgSession.loadUser();
        tgSession.isReply = ctx.message.reply_to_message !== undefined;

        replyManager.tryHandleReply(ctx);

        if (tgSession.user != null)
          await tgSession.user.updateInteractionMetrics();

        await processMessage(tgSession, messageText);
      } catch (error) {
        console.error("Error processing command:", error);
      }
    })();
  });

  await bot.launch();

  console.log(`Telegram: JOEL started successfully \u{2705}`);
})();

process.once("SIGINT", () => void bot.stop("SIGINT"));
process.once("SIGTERM", () => void bot.stop("SIGTERM"));
