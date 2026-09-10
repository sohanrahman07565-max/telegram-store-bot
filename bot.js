import { Telegraf, Markup } from 'telegraf';
import http from 'http';
import { TOKEN, BOT_NAME, OWNER_ID } from './config.js';
import db from './database.js';

// Guards
import { banGuard } from './ban_guard.js';
import { adminGuard } from './admin_guard.js';

// Utils & Routing
import { edit, send, answer, flood, safeDelete } from './utils.js';
import { openPage } from './routes.js';
import { currentInput, stopInput } from './input.js';

// Modules (Routes & Input Handlers)
import { registerApiKeyRoutes, handleApiKeyInput } from './api_keys.js';
import { registerBroadcast, handleBroadcastMedia } from './broadcast.js';
import { registerBackup } from './backup.js';
import { registerAdminModule, handleAdminsInput, handleSearchUserInput, handleAdminBalanceInput, handleRedeemCreationInput } from './admin/index.js';
import { registerPaymentsModule, handlePaymentFlowInput, handleMethodAdminInput } from './payments/index.js';
import { registerUserRoutes, registerUser, handleUserRedeemInput } from './users.js';
import { registerSupportRoutes, handleSupportInput } from './support.js';
import { registerShopRoutes } from './shop.js';
import { registerProductAdminRoutes, handleProductAdminInput } from './products.js';
import { registerSettingsRoutes, handleSaveSetting } from './settings.js';

// -------------------------------------------------------------
// ১. বট ইনিশিয়ালাইজেশন
// -------------------------------------------------------------
const bot = new Telegraf(TOKEN);

// -------------------------------------------------------------
// ২. হোম কিবোর্ড বিল্ডার (মূল ইমোজি সহ)
// -------------------------------------------------------------
function homeKeyboard(userId) {
  const keyboard = [
    [
      Markup.button.callback('🛒 Shop', 'shop'),
      Markup.button.callback('💳 Add Balance', 'add_balance')
    ],
    [
      Markup.button.callback('👤 Account', 'account'),
      Markup.button.callback('🎁 Redeem', 'redeem')
    ],
    [
      Markup.button.callback('📞 Support', 'support'),
      Markup.button.callback('📜 Rules', 'rules')
    ]
  ];

  // Owner অথবা Admin হলে Admin Panel বাটন যুক্ত হবে
  const isAdmin = db.prepare('SELECT 1 FROM admins WHERE user_id = ? LIMIT 1').get(userId);
  if (userId === OWNER_ID || isAdmin) {
    keyboard.push([Markup.button.callback('🛠️ Admin Panel', 'admin')]);
  }

  return Markup.inlineKeyboard(keyboard);
}

// -------------------------------------------------------------
// ৩. সমস্ত মডিউলের রাউট রেজিস্টার
// -------------------------------------------------------------
registerApiKeyRoutes(bot);
registerBroadcast(bot);
registerBackup(bot);
registerAdminModule(bot);
registerPaymentsModule(bot);
registerUserRoutes(bot);
registerSupportRoutes(bot);
registerShopRoutes(bot);
registerProductAdminRoutes(bot);
registerSettingsRoutes(bot);

// -------------------------------------------------------------
// ৪. স্টার্ট কমান্ড (/start এবং 'home' বাটন)
// -------------------------------------------------------------
async function startHandler(ctx) {
  if (await banGuard(ctx)) return;

  await registerUser(ctx);

  const user = ctx.from;
  const userFirstName = user.first_name || 'User';
  const userUsername = user.username ? `@${user.username}` : 'No Username';
  const userId = user.id;

  const text = `🏠 ${BOT_NAME}

━━━━━━━━━━━━━━

👋 Welcome ${userFirstName}

👤NAME:
➜  ${userUsername}

🆔UID:
➜ ${userId}

Choose an option below.`;

  await send(ctx, text, homeKeyboard(userId));
}

bot.command('start', startHandler);
bot.action('home', startHandler);

// -------------------------------------------------------------
// ৫. গ্লোবাল কলব্যাক গার্ড ও ডিসপ্যাচার
// -------------------------------------------------------------
bot.on('callback_query', async (ctx, next) => {
  if (await banGuard(ctx)) return;

  const data = ctx.callbackQuery.data;
  console.log(`CALLBACK: ${data}`);

  // ফ্ল্যাড প্রটেকশন
  if (flood(ctx.from.id)) {
    return await answer(ctx, 'Please wait...', true);
  }

  // এডমিন এরিয়া প্রোটেকশন
  const adminRoutes = [
    'admin', 'users', 'settings', 'backup', 'broadcast',
    'payments', 'logs', 'products', 'keys', 'admin_list',
    'add_admin', 'admin_info_', 'admin_role', 'remove_admin',
    'change_admin_role', 'ban_user', 'unban_user'
  ];

  if (adminRoutes.some((route) => data.startsWith(route))) {
    if (await adminGuard(ctx)) return;
  }

  // কাস্টম রাউট থাকলে হ্যান্ডল করবে
  const handled = await openPage(ctx, data);
  if (handled) return;

  return next();
});

// -------------------------------------------------------------
// ৬. সেন্ট্রাল মেসেজ ও ইনপুট হ্যান্ডলার
// -------------------------------------------------------------
bot.on('message', async (ctx) => {
  if (await banGuard(ctx)) return;

  const uid = ctx.from.id;
  const mode = currentInput(uid);

  if (!mode) return;

  // Remote API Key Inputs
  if (mode.startsWith('api_keys_')) {
    if (await handleApiKeyInput(ctx)) return;
  }

  // Broadcast Multimedia Inputs
  if (mode.startsWith('broadcast_') || mode === 'bc_text' || mode === 'bc_photo') {
    if (await handleBroadcastMedia(ctx)) return;
  }

  // Admin User & Balance Inputs
  if (mode === 'search_user') {
    return await handleSearchUserInput(ctx);
  }
  if (mode === 'admin_balance') {
    return await handleAdminBalanceInput(ctx);
  }

  // Admin Management Inputs
  if (mode === 'add_admin') {
    return await handleAdminsInput(ctx);
  }

  // Redeem Creation Inputs
  if (mode.startsWith('admin_redeem_') || mode.startsWith('admin_edit_redeem_')) {
    return await handleRedeemCreationInput(ctx, mode);
  }

  // User Redeem Code Input
  if (mode === 'redeem') {
    return await handleUserRedeemInput(ctx);
  }

  // Payment Flow Inputs (User deposit)
  if (mode === 'payment_amount' || mode === 'payment_trx' || mode === 'payment_photo') {
    return await handlePaymentFlowInput(ctx, mode);
  }

  // Admin Payment Method Management Inputs
  if (mode === 'method_name' || mode === 'method_number' || mode === 'edit_method_name' || mode === 'edit_method_number') {
    return await handleMethodAdminInput(ctx, mode);
  }

  // Support / Channel Adding Inputs
  if (mode === 'add_support' || mode === 'add_channel') {
    return await handleSupportInput(ctx, mode);
  }

  // Product Admin Inputs
  const productModes = [
    'add_product_name', 'add_product_duration', 'add_product_price',
    'edit_name', 'edit_duration', 'edit_price', 'search_product'
  ];
  if (productModes.includes(mode)) {
    return await handleProductAdminInput(ctx, mode);
  }

  // Bot Settings Inputs
  const settingKeys = ['bot_name', 'join_bonus', 'support', 'channel', 'rules', 'maintenance'];
  if (settingKeys.includes(mode)) {
    return await handleSaveSetting(ctx, mode);
  }
});

// -------------------------------------------------------------
// ৭. গ্লোবাল এরর হ্যান্ডলার
// -------------------------------------------------------------
bot.catch((err, ctx) => {
  console.error('\n========== ERROR ==========');
  console.error(err);
  console.error('===========================\n');

  try {
    if (ctx.callbackQuery) {
      ctx.answerCbQuery('⚠️ Something went wrong.', { show_alert: true });
    }
  } catch (e) {}
});

// -------------------------------------------------------------
// ৮. Render Health-Check Web Server
// -------------------------------------------------------------
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running online!');
}).listen(PORT, () => {
  console.log(`🌐 Health server listening on port ${PORT}`);
});

// -------------------------------------------------------------
// ৯. অটো রিস্টার্ট পল সহ লঞ্চ
// -------------------------------------------------------------
console.log(`🤖 ${BOT_NAME} Started Successfully in Node.js`);

// ক্লিন লঞ্চ (নো লুপ রিস্টার্ট)
bot.launch({ dropPendingUpdates: true })
  .then(() => console.log('🤖 Bot launched successfully!'))
  .catch((err) => {
    console.error('❌ Bot launch failed:', err.message);
    process.exit(1);
  });

// সেফ শাটডাউন
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
