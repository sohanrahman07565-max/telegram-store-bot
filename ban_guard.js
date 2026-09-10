import { OWNER_ID } from './config.js';
import { isBanned } from './database.js';
import { stopInput } from './input.js';

export async function banGuard(ctx) {
  const uid = ctx.from?.id;

  // Owner can never be banned
  if (uid === OWNER_ID) {
    return false;
  }

  if (!isBanned(uid)) {
    return false;
  }

  stopInput(uid);

  const text =
    '⛔ ACCOUNT BANNED\n\n' +
    'Your account has been permanently banned from this bot.\n\n' +
    '🚫 You cannot use any feature.\n' +
    '📩 Contact the bot owner if you think this is a mistake.';

  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(text, { show_alert: true });
    } else if (ctx.message) {
      await ctx.reply(text);
    }
  } catch (e) {
    // Ignore error
  }

  return true;
}
