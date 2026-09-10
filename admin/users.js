import { Markup } from 'telegraf';
import db from '../database.js';
import { startInput, stopInput } from '../input.js';
import { set, value } from './session.js';
import { OWNER_ID } from '../config.js';

export function registerUsersRoutes(bot) {
  bot.action('users', async (ctx) => {
    await ctx.answerCbQuery();
    const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const active = db.prepare('SELECT COUNT(*) as c FROM users WHERE banned = 0').get().c;
    const banned = db.prepare('SELECT COUNT(*) as c FROM users WHERE banned = 1').get().c;

    await ctx.editMessageText(
      `👤 USER MANAGER\n\n━━━━━━━━━━━━━━\n\n👥 Total Users : ${total}\n\n🟢 Active Users : ${active}\n\n🔴 Banned Users : ${banned}\n\n━━━━━━━━━━━━━━\n\nSelect an option.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔍 Search User', 'search_user')],
        [Markup.button.callback('👥 All Users', 'all_users')],
        [Markup.button.callback('💰 Add Balance', 'admin_add_balance'), Markup.button.callback('📜 History', 'user_history')],
        [Markup.button.callback('🚫 Ban User', 'ban_user'), Markup.button.callback('✅ Unban User', 'unban_user')],
        [Markup.button.callback('⬅️ Back', 'admin')]
      ])
    );
  });

  bot.action('all_users', async (ctx) => {
    const adminId = ctx.from.id;
    const page = value(adminId, 'user_page') || 0;
    const limit = 20;
    const offset = page * limit;

    const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const rows = db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT ? OFFSET ?').all(limit, offset);

    const keyboard = rows.map((r) => [
      Markup.button.callback(`${r.banned ? '🔴' : '🟢'} ${r.first_name} (${r.id})`, `user_${r.id}`)
    ]);

    const nav = [];
    if (page > 0) nav.push(Markup.button.callback('⬅️ Previous', 'users_prev'));
    if (offset + limit < total) nav.push(Markup.button.callback('➡️ Next', 'users_next'));
    if (nav.length) keyboard.push(nav);

    keyboard.push([Markup.button.callback('🔍 Search', 'search_user')]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'users'), Markup.button.callback('🏠 Admin', 'admin')]);

    await ctx.editMessageText(
      `👥 ALL USERS\n\n━━━━━━━━━━━━━━\n\n👤 Total Users : ${total}\n\n📄 Page : ${page + 1}\n\n━━━━━━━━━━━━━━\n\nSelect a user.`,
      Markup.inlineKeyboard(keyboard)
    );
  });

  bot.action(/^user_(\d+)$/, async (ctx) => {
    const uid = parseInt(ctx.match[1], 10);
    set(ctx.from.id, 'selected_user', uid);
    await showUserProfile(ctx, uid);
  });

  bot.action('users_prev', async (ctx) => {
    const p = value(ctx.from.id, 'user_page') || 0;
    if (p > 0) set(ctx.from.id, 'user_page', p - 1);
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'all_users' } });
  });

  bot.action('users_next', async (ctx) => {
    const p = value(ctx.from.id, 'user_page') || 0;
    set(ctx.from.id, 'user_page', p + 1);
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'all_users' } });
  });

  bot.action('ban_user', async (ctx) => {
    const adminId = ctx.from.id;
    if (adminId !== OWNER_ID) return ctx.answerCbQuery('⛔ Only the Owner can manage bans.', { show_alert: true });

    const uid = value(adminId, 'selected_user');
    if (!uid) return ctx.answerCbQuery('❌ No user selected.', { show_alert: true });
    if (uid === OWNER_ID) return ctx.answerCbQuery('❌ Owner cannot be banned.', { show_alert: true });

    db.prepare('UPDATE users SET banned = 1 WHERE id = ?').run(uid);
    await ctx.answerCbQuery('✅ User Banned');
    await showUserProfile(ctx, uid);
  });

  bot.action('unban_user', async (ctx) => {
    const adminId = ctx.from.id;
    if (adminId !== OWNER_ID) return ctx.answerCbQuery('⛔ Only the Owner can manage bans.', { show_alert: true });

    const uid = value(adminId, 'selected_user');
    if (!uid) return ctx.answerCbQuery('❌ No user selected.', { show_alert: true });

    db.prepare('UPDATE users SET banned = 0 WHERE id = ?').run(uid);
    await ctx.answerCbQuery('✅ User Unbanned');
    await showUserProfile(ctx, uid);
  });

  bot.action('user_history', async (ctx) => {
    const uid = value(ctx.from.id, 'selected_user');
    if (!uid) return ctx.answerCbQuery('❌ No user selected.', { show_alert: true });

    const rows = db.prepare('SELECT product, amount, purchase_date FROM orders WHERE user = ? ORDER BY id DESC LIMIT 20').all(uid);
    let text = `📜 USER HISTORY\n\n━━━━━━━━━━━━━━\n\n👤 User ID : ${uid}\n\n━━━━━━━━━━━━━━\n\n`;

    if (!rows.length) {
      text += 'No purchase history found.';
    } else {
      rows.forEach((r) => {
        text += `🛒 ${r.product}\n💰 ${r.amount} Tk\n🕒 ${r.purchase_date}\n\n`;
      });
    }

    await ctx.editMessageText(text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', `user_${uid}`)]]));
  });

  bot.action('search_user', async (ctx) => {
    startInput(ctx.from.id, 'search_user');
    await ctx.editMessageText(
      '🔍 SEARCH USER\n\n━━━━━━━━━━━━━━\n\nSend Telegram User ID',
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'users')]])
    );
  });

  bot.action('admin_add_balance', async (ctx) => {
    startInput(ctx.from.id, 'admin_balance');
    const msg = await ctx.editMessageText(
      '💰 ADD USER BALANCE\n\n━━━━━━━━━━━━━━\n\nSend:\n\nUserID Amount',
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'users')]])
    );
    set(ctx.from.id, 'balance_msg', msg.message_id);
  });
}

async function showUserProfile(ctx, uid) {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  if (!row) return ctx.answerCbQuery?.('❌ User Not Found', { show_alert: true });

  const status = row.banned ? '🔴 Banned' : '🟢 Active';
  const text = `👤 USER PROFILE\n\n━━━━━━━━━━━━━━\n\n🆔 ID\n➜ ${row.id}\n\n👤 Name\n➜ ${row.first_name}\n\n📛 Username\n➜ @${row.username || 'None'}\n\n💰 Balance\n➜ ${row.balance} Tk\n\n🚫 Status\n➜ ${status}`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💰 Add Balance', 'admin_add_balance')],
    [Markup.button.callback('🚫 Ban', 'ban_user'), Markup.button.callback('✅ Unban', 'unban_user')],
    [Markup.button.callback('📜 History', 'user_history')],
    [Markup.button.callback('⬅️ Back', 'all_users'), Markup.button.callback('🏠 Admin', 'admin')]
  ]);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, keyboard);
  } else {
    await ctx.reply(text, keyboard);
  }
}

export async function handleSearchUserInput(ctx) {
  const uid = parseInt(ctx.message?.text?.trim(), 10);
  stopInput(ctx.from.id);
  if (isNaN(uid)) return ctx.reply('❌ Invalid User ID');

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  if (!row) return ctx.reply('❌ User Not Found');

  set(ctx.from.id, 'selected_user', uid);
  await showUserProfile(ctx, uid);
  return true;
}

export async function handleAdminBalanceInput(ctx) {
  const parts = ctx.message?.text?.trim().split(/\s+/);
  if (parts.length !== 2) {
    await ctx.reply('❌ Format\n━━━━━━━━━━━━━━\nUserID Amount');
    return true;
  }

  const targetUid = parseInt(parts[0], 10);
  const amount = parseInt(parts[1], 10);
  if (isNaN(targetUid) || isNaN(amount)) {
    await ctx.reply('❌ Numbers only.');
    return true;
  }

  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, targetUid);
  stopInput(ctx.from.id);

  try { await ctx.deleteMessage(); } catch (e) {}

  ctx.telegram.sendMessage(targetUid, `💰 Balance Added\n\n━━━━━━━━━━━━━━\n\nAmount :\n\n${amount} Tk`).catch(() => {});

  const msgId = value(ctx.from.id, 'balance_msg');
  if (msgId) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msgId,
      null,
      `✅ BALANCE ADDED\n\n━━━━━━━━━━━━━━\n\n👤 User ID :\n${targetUid}\n\n💰 Amount :\n${amount}\n\n━━━━━━━━━━━━━━\n\nBalance Added Successfully.`,
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'admin')]])
    );
  }
  return true;
}
