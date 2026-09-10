import { Markup } from 'telegraf';
import db from '../database.js';
import { startInput, stopInput } from '../input.js';
import { set, value } from './session.js';

function generateRedeemCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  while (true) {
    let rand = '';
    for (let i = 0; i < 8; i++) rand += chars.charAt(Math.floor(Math.random() * chars.length));
    const code = `RD-${rand}`;
    const exists = db.prepare('SELECT id FROM redeem WHERE code = ?').get(code);
    if (!exists) return code;
  }
}

const redeemBack = () => Markup.inlineKeyboard([
  [Markup.button.callback('⬅️ Back', 'admin_redeem_panel'), Markup.button.callback('🏠 Admin', 'admin')]
]);

const redeemCancel = () => Markup.inlineKeyboard([
  [Markup.button.callback('❌ Cancel', 'admin_redeem_panel')],
  [Markup.button.callback('🏠 Admin', 'admin')]
]);

const infoBack = (rid) => Markup.inlineKeyboard([
  [Markup.button.callback('⬅️ Back', `admin_redeem_info_${rid}`), Markup.button.callback('🏠 Admin', 'admin')]
]);

const searchBack = () => Markup.inlineKeyboard([
  [Markup.button.callback('⬅️ Back', 'admin_redeem_list'), Markup.button.callback('🏠 Admin', 'admin')]
]);

export function registerRedeemRoutes(bot) {
  bot.action('admin_redeem_panel', async (ctx) => {
    await ctx.answerCbQuery();
    const total = db.prepare('SELECT COUNT(*) as c FROM redeem').get().c;
    const active = db.prepare('SELECT COUNT(*) as c FROM redeem WHERE status = 1').get().c;
    const disabled = db.prepare('SELECT COUNT(*) as c FROM redeem WHERE status = 0').get().c;

    await ctx.editMessageText(
      `🎁 REDEEM MANAGEMENT\n\n━━━━━━━━━━━━━━\n\n📦 Total Redeem :\n${total}\n\n🟢 Active :\n${active}\n\n🔴 Disabled :\n${disabled}\n\n━━━━━━━━━━━━━━\n\nSelect an option.`,
      Markup.inlineKeyboard([
        [Markup.button.callback('➕ Create', 'admin_create_redeem')],
        [Markup.button.callback('📋 Redeem List', 'admin_redeem_list')],
        [Markup.button.callback('🔍 Search', 'admin_search_redeem'), Markup.button.callback('📊 Stats', 'admin_redeem_stats')],
        [Markup.button.callback('📜 History', 'admin_redeem_history')],
        [Markup.button.callback('🏠 Admin Panel', 'admin')]
      ])
    );
  });

  bot.action('admin_create_redeem', async (ctx) => {
    const uid = ctx.from.id;
    startInput(uid, 'admin_redeem_amount');
    const msg = await ctx.editMessageText(
      '➕ CREATE REDEEM\n\n━━━━━━━━━━━━━━\n\n💰 Step 1 / 4\n\nSend Redeem Amount\n\nExample\n\n100',
      redeemCancel()
    );
    set(uid, 'admin_redeem_msg', msg.message_id);
  });

  bot.action('admin_redeem_list', async (ctx) => {
    const rows = db.prepare('SELECT id, code, amount, status FROM redeem ORDER BY id DESC').all();
    if (!rows.length) return ctx.editMessageText('📭 NO REDEEM FOUND', redeemBack());

    const keyboard = rows.map((r) => [
      Markup.button.callback(`${r.status ? '🟢' : '🔴'} ${r.code} • ${r.amount} Tk`, `admin_redeem_info_${r.id}`)
    ]);
    keyboard.push([Markup.button.callback('🔍 Search', 'admin_search_redeem'), Markup.button.callback('📊 Stats', 'admin_redeem_stats')]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'admin_redeem_panel'), Markup.button.callback('🏠 Admin', 'admin')]);

    await ctx.editMessageText('🎁 REDEEM LIST\n\n━━━━━━━━━━━━━━\n\nSelect a Redeem Code.', Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^admin_redeem_info_(\d+)$/, async (ctx) => {
    const rid = parseInt(ctx.match[1], 10);
    await showRedeemDetails(ctx, rid);
  });

  bot.action(/^admin_toggle_redeem_(\d+)$/, async (ctx) => {
    const rid = parseInt(ctx.match[1], 10);
    const row = db.prepare('SELECT status FROM redeem WHERE id = ?').get(rid);
    if (!row) return ctx.answerCbQuery('❌ Redeem Not Found', { show_alert: true });

    db.prepare('UPDATE redeem SET status = ? WHERE id = ?').run(row.status ? 0 : 1, rid);
    await ctx.answerCbQuery('✅ Updated');
    await showRedeemDetails(ctx, rid);
  });

  bot.action(/^admin_delete_redeem_(\d+)$/, async (ctx) => {
    const rid = parseInt(ctx.match[1], 10);
    await ctx.editMessageText(
      '⚠️ DELETE REDEEM\n\n━━━━━━━━━━━━━━\n\nAre you sure?\n\nThis action cannot be undone.',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes', `admin_delete_redeem_yes_${rid}`), Markup.button.callback('❌ No', `admin_redeem_info_${rid}`)],
        [Markup.button.callback('🏠 Admin', 'admin')]
      ])
    );
  });

  bot.action(/^admin_delete_redeem_yes_(\d+)$/, async (ctx) => {
    const rid = parseInt(ctx.match[1], 10);
    db.prepare('DELETE FROM redeem WHERE id = ?').run(rid);
    await ctx.answerCbQuery('✅ Deleted');
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'admin_redeem_list' } });
  });

  bot.action('admin_redeem_stats', async (ctx) => {
    const total = db.prepare('SELECT COUNT(*) as c FROM redeem').get().c;
    const active = db.prepare('SELECT COUNT(*) as c FROM redeem WHERE status = 1').get().c;
    const disabled = db.prepare('SELECT COUNT(*) as c FROM redeem WHERE status = 0').get().c;
    const used = db.prepare('SELECT SUM(used_count) as c FROM redeem').get().c || 0;

    await ctx.editMessageText(
      `📊 REDEEM STATISTICS\n\n━━━━━━━━━━━━━━\n\n📦 Total : ${total}\n\n🟢 Active : ${active}\n\n🔴 Disabled : ${disabled}\n\n🎯 Total Used : ${used}`,
      redeemBack()
    );
  });

  bot.action('admin_redeem_history', async (ctx) => {
    const rows = db.prepare('SELECT code, user as user_id, amount, date as used_at FROM redeem_history ORDER BY id DESC LIMIT 20').all();
    if (!rows.length) return ctx.editMessageText('📭 No Redeem History.', redeemBack());

    let text = '📜 REDEEM HISTORY\n\n';
    rows.forEach((r) => {
      text += `🔑 ${r.code}\n👤 ${r.user_id}\n💰 ${r.amount} Tk\n🕒 ${r.used_at}\n\n`;
    });
    await ctx.editMessageText(text, redeemBack());
  });

  bot.action('admin_search_redeem', async (ctx) => {
    startInput(ctx.from.id, 'admin_search_redeem');
    const msg = await ctx.editMessageText('🔍 SEARCH REDEEM\n\n━━━━━━━━━━━━━━\n\nSend Redeem Code\n\nExample\n\nRD-ABC12345', searchBack());
    set(ctx.from.id, 'admin_redeem_msg', msg.message_id);
  });

  // ফিল্ড এডিটর রুটসমূহ
  ['amount', 'limit', 'per_user', 'expiry'].forEach((field) => {
    bot.action(new RegExp(`^admin_edit_redeem_${field}_(\\d+)$`), async (ctx) => {
      const rid = parseInt(ctx.match[1], 10);
      set(ctx.from.id, 'edit_redeem_id', rid);
      set(ctx.from.id, 'admin_redeem_msg', ctx.callbackQuery.message.message_id);
      startInput(ctx.from.id, `admin_edit_redeem_${field}`);
      await ctx.editMessageText(`✏️ EDIT REDEEM ${field.toUpperCase()}\n\nSend new value:`, infoBack(rid));
    });
  });
}

async function showRedeemDetails(ctx, rid) {
  const row = db.prepare('SELECT * FROM redeem WHERE id = ?').get(rid);
  if (!row) return ctx.answerCbQuery?.('❌ Redeem Not Found', { show_alert: true });

  const remaining = Math.max(0, (row.limit_count || 1) - (row.used_count || 0));
  const status = row.status ? '🟢 Active' : '🔴 Disabled';
  const expiry = row.expire_at || 'Unlimited';

  const text = `🎁 REDEEM DETAILS\n\n━━━━━━━━━━━━━━\n\n🔑 Code\n${row.code}\n\n💰 Amount\n${row.amount} Tk\n\n👥 Total Limit\n${row.limit_count || 1}\n\n✅ Used\n${row.used_count || 0}\n\n📦 Remaining\n${remaining}\n\n👤 Per User\n${row.per_user || 1}\n\n📅 Expiry\n${expiry}\n\n📊 Status\n${status}`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('💰 Amount', `admin_edit_redeem_amount_${rid}`), Markup.button.callback('👥 Limit', `admin_edit_redeem_limit_${rid}`)],
    [Markup.button.callback('👤 Per User', `admin_edit_redeem_per_user_${rid}`), Markup.button.callback('📅 Expiry', `admin_edit_redeem_expiry_${rid}`)],
    [{ text: "📋 Copy", copy_text: { text: String(row.code) } }, Markup.button.callback('🗑 Delete', `admin_delete_redeem_${rid}`)],
    [Markup.button.callback(row.status === 0 ? '🟢 ON' : '🔴 OFF', `admin_toggle_redeem_${rid}`)],
    [Markup.button.callback('⬅️ Back', 'admin_redeem_list'), Markup.button.callback('🏠 Admin', 'admin')]
  ]);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, keyboard);
  } else {
    await ctx.reply(text, keyboard);
  }
}

// ৪ ধাপের ইনপুট ক্রিয়েশন হ্যান্ডলার
export async function handleRedeemCreationInput(ctx, mode) {
  const uid = ctx.from.id;
  const text = ctx.message?.text?.trim();

  if (mode === 'admin_redeem_amount') {
    const amount = parseInt(text, 10);
    if (isNaN(amount) || amount <= 0) return ctx.reply('❌ Invalid Amount.');
    set(uid, 'redeem_amount', amount);
    startInput(uid, 'admin_redeem_limit');
    try { await ctx.deleteMessage(); } catch (e) {}
    const msg = value(uid, 'admin_redeem_msg');
    await ctx.telegram.editMessageText(ctx.chat.id, msg, null, '➕ CREATE REDEEM\n\n👥 Step 2 / 4\n\nSend Total Limit\n\nExample\n\n100', redeemCancel());
    return true;
  }

  if (mode === 'admin_redeem_limit') {
    const limit = parseInt(text, 10);
    if (isNaN(limit) || limit <= 0) return ctx.reply('❌ Invalid Limit.');
    set(uid, 'redeem_limit', limit);
    startInput(uid, 'admin_redeem_per_user');
    try { await ctx.deleteMessage(); } catch (e) {}
    const msg = value(uid, 'admin_redeem_msg');
    await ctx.telegram.editMessageText(ctx.chat.id, msg, null, '➕ CREATE REDEEM\n\n👤 Step 3 / 4\n\nSend Per User Limit (0 = Unlimited)', redeemCancel());
    return true;
  }

  if (mode === 'admin_redeem_per_user') {
    const perUser = parseInt(text, 10);
    if (isNaN(perUser) || perUser < 0) return ctx.reply('❌ Invalid Value.');
    set(uid, 'redeem_per_user', perUser);
    startInput(uid, 'admin_redeem_expiry');
    try { await ctx.deleteMessage(); } catch (e) {}
    const msg = value(uid, 'admin_redeem_msg');
    await ctx.telegram.editMessageText(ctx.chat.id, msg, null, '➕ CREATE REDEEM\n\n📅 Step 4 / 4\n\nSend Expiry (Example: 31-12-2026 23:59 or "none")', redeemCancel());
    return true;
  }

  if (mode === 'admin_redeem_expiry') {
    const expiry = text.toLowerCase() === 'none' ? null : text;
    const code = generateRedeemCode();

    db.prepare(`
      INSERT INTO redeem (code, amount, limit_count, used_count, per_user, expire_at, status)
      VALUES (?, ?, ?, 0, ?, ?, 1)
    `).run(code, value(uid, 'redeem_amount'), value(uid, 'redeem_limit'), value(uid, 'redeem_per_user'), expiry);

    stopInput(uid);
    try { await ctx.deleteMessage(); } catch (e) {}
    const msg = value(uid, 'admin_redeem_msg');
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msg,
      null,
      `✅ REDEEM CREATED\n\n━━━━━━━━━━━━━━\n\n🔑 Code:\n\`${code}\`\n\nSuccessfully Created.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('📋 Redeem List', 'admin_redeem_list')],
          [Markup.button.callback('➕ Create Again', 'admin_create_redeem')],
          [Markup.button.callback('🏠 Admin', 'admin')]
        ])
      }
    );
    return true;
  }

  return false;
}
