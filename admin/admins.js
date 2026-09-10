import { Markup } from 'telegraf';
import db from '../database.js';
import { startInput, stopInput } from '../input.js';
import { set, value } from './session.js';

export function registerAdminsRoutes(bot) {
  bot.action('admin_list', async (ctx) => {
    await ctx.answerCbQuery();
    const rows = db.prepare('SELECT id, user_id, role FROM admins ORDER BY id ASC').all();
    const buttons = [];

    if (rows.length) {
      rows.forEach((row) => {
        buttons.push([Markup.button.callback(`👤 ${row.user_id} (${row.role})`, `admin_info_${row.id}`)]);
      });
    } else {
      buttons.push([Markup.button.callback('No Admin Found', 'none')]);
    }

    buttons.push([Markup.button.callback('➕ Add Admin', 'add_admin')]);
    buttons.push([Markup.button.callback('⬅️ Back', 'admin')]);

    await ctx.editMessageText(
      `👑 ADMIN LIST\n\n━━━━━━━━━━━━━━\n\nTotal Admin :\n\n${rows.length}`,
      Markup.inlineKeyboard(buttons)
    );
  });

  bot.action(/^admin_info_(\d+)$/, async (ctx) => {
    const adminId = parseInt(ctx.match[1], 10);
    set(ctx.from.id, 'selected_admin', adminId);

    const row = db.prepare('SELECT * FROM admins WHERE id = ?').get(adminId);
    if (!row) {
      return ctx.answerCbQuery('❌ Admin Not Found', { show_alert: true });
    }

    const text = `👑 ADMIN INFORMATION\n\n━━━━━━━━━━━━━━\n\n🆔 Admin ID\n➜ ${row.id}\n\n👤 Telegram ID\n➜ ${row.user_id}\n\n📱 Telegram ID\n➜ ${row.user_id}\n\n🛡 Role\n➜ ${row.role}\n\n📅 Added\n➜ ${row.created_at}`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🛡 Change Role', 'change_admin_role')],
      [Markup.button.callback('🗑 Remove Admin', 'remove_admin')],
      [Markup.button.callback('⬅️ Back', 'admin_list'), Markup.button.callback('🏠 Admin', 'admin')]
    ]);

    await ctx.editMessageText(text, keyboard);
  });

  bot.action('add_admin', async (ctx) => {
    startInput(ctx.from.id, 'add_admin');
    const msg = await ctx.editMessageText(
      '➕ ADD ADMIN\n\n━━━━━━━━━━━━━━\n\nSend:\n\nUser ID',
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'admin_list')]])
    );
    set(ctx.from.id, 'admin_add_msg', msg.message_id);
  });

  bot.action('change_admin_role', async (ctx) => {
    await ctx.editMessageText(
      '🛡 CHANGE ADMIN ROLE\n\n━━━━━━━━━━━━━━\n\nSelect New Role',
      Markup.inlineKeyboard([
        [Markup.button.callback('👑 Owner', 'admin_role_owner'), Markup.button.callback('⚙️ Manager', 'admin_role_manager')],
        [Markup.button.callback('🛠 Support', 'admin_role_support'), Markup.button.callback('🛡 Moderator', 'admin_role_moderator')],
        [Markup.button.callback('⬅️ Back', 'admin_list')]
      ])
    );
  });

  bot.action(/^admin_role_(.+)$/, async (ctx) => {
    const role = ctx.match[1];
    const currentAdmin = ctx.from.id;
    const newAdmin = value(currentAdmin, 'new_admin');
    const selectedAdmin = value(currentAdmin, 'selected_admin');

    if (newAdmin) {
      db.prepare(`
        INSERT INTO admins (user_id, role, added_by, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(newAdmin, role, currentAdmin);

      set(currentAdmin, 'new_admin', null);
      return ctx.editMessageText(
        `✅ ADMIN ADDED\n\n━━━━━━━━━━━━━━\n\n👤 User ID : ${newAdmin}\n\n🛡 Role : ${role}`,
        Markup.inlineKeyboard([[Markup.button.callback('👑 Admin List', 'admin_list')]])
      );
    }

    if (selectedAdmin) {
      db.prepare('UPDATE admins SET role = ? WHERE id = ?').run(role, selectedAdmin);
      return ctx.editMessageText(
        `✅ ROLE UPDATED\n\n━━━━━━━━━━━━━━\n\n🛡 New Role\n\n${role}`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', `admin_info_${selectedAdmin}`)]])
      );
    }
  });

  bot.action('remove_admin', async (ctx) => {
    const adminId = value(ctx.from.id, 'selected_admin');
    if (!adminId) return ctx.answerCbQuery('❌ No admin selected.', { show_alert: true });

    await ctx.editMessageText(
      '🗑 REMOVE ADMIN\n\n━━━━━━━━━━━━━━\n\nAre you sure you want to remove this admin?',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes', 'confirm_remove_admin'), Markup.button.callback('❌ No', `admin_info_${adminId}`)]
      ])
    );
  });

  bot.action('confirm_remove_admin', async (ctx) => {
    const adminId = value(ctx.from.id, 'selected_admin');
    if (!adminId) return ctx.answerCbQuery('❌ No admin selected.', { show_alert: true });

    db.prepare('DELETE FROM admins WHERE id = ?').run(adminId);
    set(ctx.from.id, 'selected_admin', null);

    await ctx.editMessageText(
      '✅ ADMIN REMOVED\n\n━━━━━━━━━━━━━━\n\nThe selected admin has been removed successfully.',
      Markup.inlineKeyboard([
        [Markup.button.callback('👑 Admin List', 'admin_list')],
        [Markup.button.callback('🏠 Admin Panel', 'admin')]
      ])
    );
  });
}

export async function handleAdminsInput(ctx) {
  const adminId = ctx.from.id;
  const uid = parseInt(ctx.message?.text?.trim(), 10);

  if (isNaN(uid)) {
    await ctx.reply('❌ Invalid User ID');
    return true;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
  if (!user) {
    await ctx.reply('❌ User Not Found');
    return true;
  }

  const existingAdmin = db.prepare('SELECT 1 FROM admins WHERE user_id = ?').get(uid);
  if (existingAdmin) {
    await ctx.reply('❌ User is already an admin.');
    return true;
  }

  set(adminId, 'new_admin', uid);
  stopInput(adminId);

  try { await ctx.deleteMessage(); } catch (e) {}

  const msgId = value(adminId, 'admin_add_msg');
  await ctx.telegram.editMessageText(
    ctx.chat.id,
    msgId,
    null,
    '✅ USER FOUND\n\n━━━━━━━━━━━━━━\n\nSelect Admin Role',
    Markup.inlineKeyboard([
      [Markup.button.callback('👑 Owner', 'admin_role_owner')],
      [Markup.button.callback('🛡 Manager', 'admin_role_manager'), Markup.button.callback('🎧 Support', 'admin_role_support')],
      [Markup.button.callback('👮 Moderator', 'admin_role_moderator')],
      [Markup.button.callback('⬅️ Back', 'admin_list')]
    ])
  );
  return true;
}
