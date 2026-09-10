import { Markup } from 'telegraf';
import db from './database.js';
import { edit } from './utils.js';
import { startInput, stopInput } from './input.js';
import { setMessage, message } from './payments/session.js';
import { hasPermission } from './admin/panel.js';

const settingsButtons = (back = 'settings') => Markup.inlineKeyboard([
  [Markup.button.callback('⬅️ Back', back), Markup.button.callback('🏠 Admin Panel', 'admin')],
  [Markup.button.callback('❌ Cancel', 'settings')]
]);

async function openSetting(ctx, uid, mode, title, placeholder) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(mode);
  const current = row ? row.value : 'Not Set';

  startInput(uid, mode);

  const text = `${title}\n\n━━━━━━━━━━━━━━\n\n📄 Current Value\n\n➜ ${current}\n\n━━━━━━━━━━━━━━\n\n📝 ${placeholder}`;
  const msg = await edit(ctx, text, settingsButtons());

  if (msg) {
    setMessage(uid, msg.message_id);
  }
}

export function registerSettingsRoutes(bot) {
  bot.action('settings', async (ctx) => {
    if (!hasPermission(ctx.from.id, 'settings')) {
      return await ctx.answerCbQuery('❌ Access Denied', { show_alert: true });
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🤖 Bot Name', 'set_bot_name')],
      [Markup.button.callback('🎁 Join Bonus', 'set_bonus')],
      [Markup.button.callback('📞 Support', 'set_support')],
      [Markup.button.callback('📢 Channel', 'set_channel')],
      [Markup.button.callback('📜 Rules', 'set_rules')],
      [Markup.button.callback('🔧 Maintenance', 'maintenance')],
      [Markup.button.callback('💳 Payment Methods', 'manage_methods')],
      [Markup.button.callback('⬅️ Back', 'admin')]
    ]);

    await edit(ctx, '⚙️ SETTINGS', keyboard);
  });

  bot.action('set_bot_name', async (ctx) => openSetting(ctx, ctx.from.id, 'bot_name', '🤖 EDIT BOT NAME', 'Send New Bot Name.'));
  bot.action('set_bonus', async (ctx) => openSetting(ctx, ctx.from.id, 'join_bonus', '🎁 EDIT JOIN BONUS', 'Send New Join Bonus.'));
  bot.action('set_support', async (ctx) => openSetting(ctx, ctx.from.id, 'support', '📞 EDIT SUPPORT', 'Send Support Username.'));
  bot.action('set_channel', async (ctx) => openSetting(ctx, ctx.from.id, 'channel', '📢 EDIT CHANNEL', 'Send Channel Username.'));
  bot.action('set_rules', async (ctx) => openSetting(ctx, ctx.from.id, 'rules', '📜 EDIT RULES', 'Send New Rules.'));
  bot.action('maintenance', async (ctx) => openSetting(ctx, ctx.from.id, 'maintenance', '🔧 EDIT MAINTENANCE', 'Send Maintenance Message.'));
}

export async function handleSaveSetting(ctx, key) {
  const uid = ctx.from.id;
  const newValue = ctx.message.text.trim();

  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  const oldValue = row ? row.value : '-';

  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, newValue);

  stopInput(uid);
  try { await ctx.deleteMessage(); } catch (e) {}

  const titles = {
    bot_name: '🤖 BOT NAME',
    join_bonus: '🎁 JOIN BONUS',
    support: '📞 SUPPORT',
    channel: '📢 CHANNEL',
    rules: '📜 RULES',
    maintenance: '🔧 MAINTENANCE'
  };

  const title = titles[key] || key.toUpperCase();
  const text = `✅ ${title} UPDATED\n\n━━━━━━━━━━━━━━\n\n📄 Old Value\n\n➜ ${oldValue}\n\n━━━━━━━━━━━━━━\n\n🆕 New Value\n\n➜ ${newValue}\n\n━━━━━━━━━━━━━━\n\n✅ Updated Successfully.`;

  const msgId = message(uid);
  if (msgId) {
    try {
      await ctx.telegram.editMessageText(ctx.chat.id, msgId, null, text, settingsButtons());
      return true;
    } catch (e) {}
  }

  await ctx.reply(text, settingsButtons());
  return true;
}
