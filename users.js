import { Markup } from 'telegraf';
import db from './database.js';
import { startInput, stopInput } from './input.js';
import { set, value } from './admin/session.js';
import { edit } from './utils.js';

export async function registerUser(ctx) {
  const user = ctx.from;
  if (!user) return;

  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(user.id);
  if (existing) return;

  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.prepare(`
    INSERT INTO users (id, username, first_name, balance, banned, join_date, ref_by)
    VALUES (?, ?, ?, 0, 0, ?, 0)
  `).run(user.id, user.username || null, user.first_name || 'User', now);
}

export function registerUserRoutes(bot) {
  bot.action('account', async (ctx) => {
    const uid = ctx.from.id;
    const row = db.prepare('SELECT username, balance, join_date FROM users WHERE id = ?').get(uid);

    if (!row) {
      return await edit(ctx, '❌ User Not Found.');
    }

    const orderCount = db.prepare('SELECT COUNT(*) AS total FROM orders WHERE user = ?').get(uid).total;

    const text = `👤 ACCOUNT\n\n━━━━━━━━━━━━━━\n\n🆔 ${uid}\n\n👤 @${row.username || 'None'}\n\n💰 Balance\n${row.balance} Tk\n\n🛒 Orders\n${orderCount}\n\n📅 Joined\n${(row.join_date || '').substring(0, 10)}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📜 Order History', 'orders')],
      [Markup.button.callback('🎁 Redeem History', 'redeem_history')],
      [Markup.button.callback('⬅️ Home', 'home')]
    ]);

    await edit(ctx, text, keyboard);
  });

  bot.action('orders', async (ctx) => {
    const uid = ctx.from.id;
    const rows = db.prepare(`
      SELECT product, duration, amount, purchase_date, expire_date AS expire_at
      FROM orders
      WHERE user = ?
      ORDER BY id DESC
      LIMIT 10
    `).all(uid);

    if (!rows.length) {
      return await edit(
        ctx,
        '📜 ORDER HISTORY\n\n━━━━━━━━━━━━━━\n\nNo Orders Found.',
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'account')]])
      );
    }

    let text = '📜 ORDER HISTORY\n\n━━━━━━━━━━━━━━\n\n';
    for (const row of rows) {
      text += `📦 ${row.product}\n⏳ ${row.duration}\n💰 ${row.amount} Tk\n📅 ${(row.purchase_date || '').substring(0, 10)}\n\n`;
    }

    await edit(ctx, text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'account')]]));
  });

  bot.action('redeem_history', async (ctx) => {
    const uid = ctx.from.id;
    const rows = db.prepare(`
      SELECT code, amount, used_at
      FROM redeem_history
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 10
    `).all(uid);

    if (!rows.length) {
      return await edit(
        ctx,
        '🎁 REDEEM HISTORY\n\n━━━━━━━━━━━━━━\n\nNo Redeem History.',
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'account')]])
      );
    }

    let text = '🎁 REDEEM HISTORY\n\n━━━━━━━━━━━━━━\n\n';
    for (const row of rows) {
      text += `🎟 ${row.code}\n💰 ${row.amount} Tk\n📅 ${(row.used_at || '').substring(0, 10)}\n\n`;
    }

    await edit(ctx, text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'account')]]));
  });

  bot.action('redeem', async (ctx) => {
    const uid = ctx.from.id;
    startInput(uid, 'redeem');
    set(uid, 'redeem_msg', ctx.callbackQuery.message.message_id);

    await edit(
      ctx,
      '🎁 REDEEM CODE\n\n━━━━━━━━━━━━━━\n\nSend your Redeem Code.',
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'home')]])
    );
  });
}

export async function handleUserRedeemInput(ctx) {
  const uid = ctx.from.id;
  const code = ctx.message.text.trim();

  const redeem = db.prepare('SELECT * FROM redeem WHERE code = ?').get(code);

  if (!redeem) {
    return await ctx.reply('❌ Invalid Redeem Code.');
  }

  const alreadyUsed = db.prepare('SELECT id FROM redeem_history WHERE user_id = ? AND code = ?').get(uid, code);
  if (alreadyUsed) {
    return await ctx.reply('❌ Redeem Code Already Used.');
  }

  const amount = redeem.amount;

  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, uid);
  db.prepare(`
    INSERT INTO redeem_history (redeem_id, user_id, code, amount, used_at)
    VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
  `).run(redeem.id, uid, code, amount);
  db.prepare('DELETE FROM redeem WHERE code = ?').run(code);

  stopInput(uid);
  try { await ctx.deleteMessage(); } catch (e) {}

  const msgId = value(uid, 'redeem_msg');
  const text = `✅ REDEEM SUCCESS\n\n━━━━━━━━━━━━━━\n\n🎁 Amount :\n${amount} Tk\n\n━━━━━━━━━━━━━━\n\nBalance Added Successfully.`;
  const keyboard = Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'home')]]);

  if (msgId) {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, msgId, null, text, keyboard);
      return true;
    } catch (e) {}
  }

  await ctx.reply(text, keyboard);
  return true;
}
