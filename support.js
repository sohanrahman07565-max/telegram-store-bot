import { Markup } from 'telegraf';
import db from './database.js';
import { edit } from './utils.js';
import { startInput, stopInput } from './input.js';
import { set, value } from './admin/session.js';

export function registerSupportRoutes(bot) {
  bot.action('support_manager', async (ctx) => {
    const supportCount = db.prepare("SELECT COUNT(*) AS c FROM contacts WHERE type = 'support'").get().c;
    const channelCount = db.prepare("SELECT COUNT(*) AS c FROM contacts WHERE type = 'channel'").get().c;

    const text = `📞 SUPPORT MANAGER\n\n━━━━━━━━━━━━━━\n\n👥 Total Support : ${supportCount}\n\n📢 Total Channel : ${channelCount}\n\n━━━━━━━━━━━━━━\n\nSelect an option below.`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('👤 Support List', 'support_list'), Markup.button.callback('📢 Channel List', 'channel_list')],
      [Markup.button.callback('➕ Add Support', 'add_support'), Markup.button.callback('➕ Add Channel', 'add_channel')],
      [Markup.button.callback('⬅️ Back', 'admin')]
    ]);

    await edit(ctx, text, keyboard);
  });

  bot.action('support_list', async (ctx) => {
    const rows = db.prepare("SELECT id, username FROM contacts WHERE type = 'support' ORDER BY id").all();
    let text = '👤 SUPPORT LIST\n\n━━━━━━━━━━━━━━\n\n';
    if (!rows.length) text += 'No support added.';

    const keyboard = rows.map((r) => {
      text += `• ${r.username}\n`;
      return [Markup.button.callback(`❌ ${r.username}`, `del_support_${r.id}`)];
    });

    keyboard.push([Markup.button.callback('➕ Add Support', 'add_support')]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'support_manager'), Markup.button.callback('🏠 Admin', 'admin')]);

    await edit(ctx, text, Markup.inlineKeyboard(keyboard));
  });

  bot.action('add_support', async (ctx) => {
    startInput(ctx.from.id, 'add_support');
    set(ctx.from.id, 'support_chat_id', ctx.chat.id);
    set(ctx.from.id, 'support_msg_id', ctx.callbackQuery.message.message_id);

    await edit(
      ctx,
      '➕ ADD SUPPORT\n\n━━━━━━━━━━━━━━\n\nSend Support Details\n\nFormat:\n\nName | @Username',
      Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Back', 'support_list'), Markup.button.callback('🏠 Admin', 'admin')]
      ])
    );
  });

  bot.action(/^del_support_(\d+)$/, async (ctx) => {
    const sid = parseInt(ctx.match[1], 10);
    db.prepare('DELETE FROM contacts WHERE id = ?').run(sid);
    await ctx.answerCbQuery('✅ Support Deleted.');
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'support_list' } });
  });

  bot.action('channel_list', async (ctx) => {
    const rows = db.prepare("SELECT id, username FROM contacts WHERE type = 'channel' ORDER BY id").all();
    let text = '📢 CHANNEL LIST\n\n━━━━━━━━━━━━━━\n\n';
    if (!rows.length) text += 'No channel added.';

    const keyboard = rows.map((r) => {
      text += `• ${r.username}\n`;
      return [Markup.button.callback(`❌ ${r.username}`, `del_channel_${r.id}`)];
    });

    keyboard.push([Markup.button.callback('➕ Add Channel', 'add_channel')]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'support_manager'), Markup.button.callback('🏠 Admin', 'admin')]);

    await edit(ctx, text, Markup.inlineKeyboard(keyboard));
  });

  bot.action('add_channel', async (ctx) => {
    startInput(ctx.from.id, 'add_channel');
    set(ctx.from.id, 'channel_chat_id', ctx.chat.id);
    set(ctx.from.id, 'channel_msg_id', ctx.callbackQuery.message.message_id);

    await edit(
      ctx,
      '➕ ADD CHANNEL\n\n━━━━━━━━━━━━━━\n\nSend Channel Username\n\nFormat:\n\nName | @Username',
      Markup.inlineKeyboard([
        [Markup.button.callback('⬅️ Back', 'channel_list'), Markup.button.callback('🏠 Admin', 'admin')]
      ])
    );
  });

  bot.action(/^del_channel_(\d+)$/, async (ctx) => {
    const cid = parseInt(ctx.match[1], 10);
    db.prepare('DELETE FROM contacts WHERE id = ?').run(cid);
    await ctx.answerCbQuery('✅ Channel Deleted.');
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'channel_list' } });
  });

  bot.action('support', async (ctx) => {
    const supports = db.prepare("SELECT username FROM contacts WHERE type = 'support' ORDER BY id").all();
    const channels = db.prepare("SELECT username FROM contacts WHERE type = 'channel' ORDER BY id").all();

    let text = '📞 SUPPORT CENTER\n\n━━━━━━━━━━━━━━\n\n👤 Support Team\n\n';
    text += supports.length ? supports.map((s) => `• ${s.username}`).join('\n') + '\n' : 'No Support Available.\n';
    text += '\n━━━━━━━━━━━━━━\n\n📢 Official Channels\n\n';
    text += channels.length ? channels.map((c) => `• ${c.username}`).join('\n') : 'No Channel Available.';

    const keyboard = [];
    supports.forEach((s) => {
      keyboard.push([Markup.button.url(`👤 ${s.username}`, `https://t.me/${s.username.replace('@', '')}`)]);
    });
    channels.forEach((c) => {
      keyboard.push([Markup.button.url(`📢 ${c.username}`, `https://t.me/${c.username.replace('@', '')}`)]);
    });
    keyboard.push([Markup.button.callback('⬅️ Back', 'home')]);

    await edit(ctx, text, Markup.inlineKeyboard(keyboard));
  });
}

export async function handleSupportInput(ctx, mode) {
  const text = ctx.message.text.trim();
  if (!text.includes('|')) {
    await ctx.reply('❌ Format:\n\nName | @Username');
    return true;
  }

  const [rawName, rawUser] = text.split('|').map((s) => s.trim());
  let username = rawUser
    .replace('https://t.me/', '')
    .replace('http://t.me/', '')
    .replace('t.me/', '');
  if (username.startsWith('@')) username = username.substring(1);

  const type = mode === 'add_support' ? 'support' : 'channel';
  const existing = db.prepare('SELECT id FROM contacts WHERE type = ? AND username = ?').get(type, username);

  if (existing) {
    await ctx.reply(`⚠️ ${type} already exists.`);
    stopInput(ctx.from.id);
    return true;
  }

  db.prepare(`
    INSERT INTO contacts (type, display_name, username, created_at)
    VALUES (?, ?, ?, datetime('now', 'localtime'))
  `).run(type, rawName, username);

  stopInput(ctx.from.id);
  try { await ctx.deleteMessage(); } catch (e) {}

  const chatId = value(ctx.from.id, `${type}_chat_id`);
  const msgId = value(ctx.from.id, `${type}_msg_id`);

  const successText = `✅ ${type.toUpperCase()} Added\n\n👤 Name : ${rawName}\n🔗 Username : @${username}`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Back', 'support'), Markup.button.callback('🏠 Admin', 'admin')]
  ]);

  if (chatId && msgId) {
    try {
      await ctx.telegram.editMessageText(chatId, msgId, null, successText, keyboard);
      return true;
    } catch (e) {}
  }

  await ctx.reply(successText, keyboard);
  return true;
}
