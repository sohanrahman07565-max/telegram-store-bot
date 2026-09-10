import { OWNER_ID } from './config.js';
import { isAdmin } from './database.js';

export async function adminGuard(ctx) {
  const uid = ctx.from?.id;

  // Owner সবসময় Allow
  if (uid === OWNER_ID) {
    return false;
  }

  // Admin হলে Allow
  if (isAdmin(uid)) {
    return false;
  }

  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('⛔ Your admin access has been revoked.', {
        show_alert: true,
      });
    } else if (ctx.message) {
      await ctx.reply('⛔ Your admin access has been revoked.');
    }
  } catch (e) {
    // Ignore error
  }

  return true;
}
