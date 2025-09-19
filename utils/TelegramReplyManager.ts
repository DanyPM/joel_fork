import { Context } from "telegraf";
import { Message, Update } from "telegraf/typings/core/types/typegram";

type ReplyKey = string;

interface ReplyResolver {
  resolve: (msg: Message) => void;
}

const createKey = (chatId: string, messageId: number): ReplyKey =>
  `${chatId}:${messageId}`;

export class TelegramReplyManager {
  private readonly pendingReplies = new Map<ReplyKey, ReplyResolver>();

  waitForReply(chatId: string, messageId: number): Promise<Message> {
    const key = createKey(chatId, messageId);

    return new Promise((resolve) => {
      this.pendingReplies.set(key, { resolve });
    });
  }

  tryHandleReply(ctx: Context<Update>): boolean {
    const message = ctx.message;
    const chat = ctx.chat;
    if (message === undefined || chat === undefined) return false;

    if (!("reply_to_message" in message) || message.reply_to_message == null)
      return false;

    const key = createKey(chat.id.toString(), message.reply_to_message.message_id);
    const resolver = this.pendingReplies.get(key);
    if (resolver === undefined) return false;

    this.pendingReplies.delete(key);
    resolver.resolve(message as Message);
    return true;
  }
}
