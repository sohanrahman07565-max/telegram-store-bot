import { Markup } from 'telegraf';
import db from '../database.js';

export function registerDashboardRoutes(bot) {
  bot.action('statistics', async (ctx) => {
    await ctx.answerCbQuery();
    const users = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    const products = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
    const keys = db.prepare('SELECT COUNT(*) AS count FROM keys').get().count;
    const pending = db.prepare('SELECT COUNT(*) AS count FROM payments WHERE status = "pending"').get().count;

    const text = `📊 BOT STATISTICS\n\n━━━━━━━━━━━━━━\n\n👤 Users : ${users}\n\n🛒 Products : ${products}\n\n🔑 Keys : ${keys}\n\n💳 Pending Payments : ${pending}`;
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📊 Dashboard', 'dashboard')],
      [Markup.button.callback('⬅️ Back', 'admin')]
    ]);

    await ctx.editMessageText(text, keyboard);
  });

  bot.action('dashboard', async (ctx) => {
    await ctx.answerCbQuery();
    const totalUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    const activeUsers = db.prepare('SELECT COUNT(*) AS count FROM users WHERE banned = 0').get().count;
    const bannedUsers = db.prepare('SELECT COUNT(*) AS count FROM users WHERE banned = 1').get().count;
    const totalAdmins = db.prepare('SELECT COUNT(*) AS count FROM admins').get().count;
    const pendingPayments = db.prepare('SELECT COUNT(*) AS count FROM payments WHERE status = "pending"').get().count;
    const totalProducts = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
    const totalKeys = db.prepare('SELECT COUNT(*) AS count FROM keys').get().count;

    const text = `📊 ADMIN DASHBOARD\n\n━━━━━━━━━━━━━━\n\n👥 Users : ${totalUsers}\n\n🟢 Active : ${activeUsers}\n\n🔴 Banned : ${bannedUsers}\n\n👮 Admins : ${totalAdmins}\n\n🛒 Products : ${totalProducts}\n\n🔑 Keys : ${totalKeys}\n\n💳 Pending : ${pendingPayments}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('👤 Users', 'users'), Markup.button.callback('🛒 Products', 'products')],
      [Markup.button.callback('🔑 Keys', 'keys'), Markup.button.callback('💳 Payments', 'payments')],
      [Markup.button.callback('🔄 Refresh', 'dashboard')],
      [Markup.button.callback('⬅️ Back', 'admin')]
    ]);

    await ctx.editMessageText(text, keyboard);
  });
}
