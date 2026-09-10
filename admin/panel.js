import { OWNER_ID } from '../config.js';
import { Markup } from 'telegraf';
import db from '../database.js';

export function isAdmin(userId) {
  const row = db.prepare('SELECT 1 FROM admins WHERE user_id = ? LIMIT 1').get(userId);
  return !!row;
}

export function adminRole(userId) {
  const row = db.prepare('SELECT role FROM admins WHERE user_id = ? LIMIT 1').get(userId);
  return row ? row.role : null;
}

export const PERMISSIONS = {
  premium: ['*'],
  owner: ['*'],
  manager: ['users', 'products', 'keys', 'orders', 'payments', 'broadcast', 'logs', 'statistics'],
  support: ['users', 'orders', 'payments'],
  moderator: ['users', 'keys'],
  normal: []
};

export function hasPermission(userId, permission) {
  if (userId === OWNER_ID) return true; import("../config.js").then(c => { if(userId === c.OWNER_ID) return true; });
  const role = adminRole(userId);
  if (!role) return false;
  const perms = PERMISSIONS[role] || [];
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

export async function accessDenied(ctx) {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Home', 'home')]
  ]);
  await ctx.editMessageText(
    '❌ ACCESS DENIED\n\n━━━━━━━━━━━━━━\n\nYou are not authorized to access the Admin Panel.',
    keyboard
  );
}

export async function requirePermission(ctx, permission) {
  const uid = ctx.from?.id;
  if (!isAdmin(uid)) {
    await accessDenied(ctx);
    return false;
  }
  if (!hasPermission(uid, permission)) {
    await ctx.editMessageText(
      '❌ PERMISSION DENIED\n\n━━━━━━━━━━━━━━\n\nYou don\'t have permission to access this section.',
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Admin Panel', 'admin')]])
    );
    return false;
  }
  return true;
}

export function registerPanelRoutes(bot) {
  bot.action('admin', async (ctx) => {
    await ctx.answerCbQuery();
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('👤 Users', 'users'), Markup.button.callback('🛒 Products', 'products')],
      [Markup.button.callback('🔑 Keys', 'keys'), Markup.button.callback('💳 Payments', 'payments')],
      [Markup.button.callback('📢 Broadcast', 'broadcast'), Markup.button.callback('🎁 Redeem', 'admin_redeem_panel')],
      [Markup.button.callback('⚙️ Settings', 'settings'), Markup.button.callback('📊 Statistics', 'statistics')],
      [Markup.button.callback('🔐 API Keys', 'api_keys'), Markup.button.callback('👑 Admin List', 'admin_list')],
      [Markup.button.callback('📞 Support Manager', 'support_manager'), Markup.button.callback('👤 Add Admin', 'add_admin')],
      [Markup.button.callback('💾 Backup', 'backup'), Markup.button.callback('📝 Logs', 'logs')],
      [Markup.button.callback('🏠 Home', 'home'), Markup.button.callback('👥 All Users', 'all_users')]
    ]);

    await ctx.editMessageText('🛠 ADMIN PANEL\n\n━━━━━━━━━━━━━━\n\nWelcome Admin!\n\nSelect any option below.', keyboard);
  });

  bot.action('refresh_admin', async (ctx) => {
    if (!isAdmin(ctx.from?.id)) return accessDenied(ctx);
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'admin' } });
  });
}
