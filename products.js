import { Markup } from 'telegraf';
import db from './database.js';
import { edit } from './utils.js';
import { startInput, stopInput } from './input.js';
import { set, value } from './admin/session.js';

const PRODUCTS_PER_PAGE = 15;

const backAdmin = () => Markup.inlineKeyboard([
  [Markup.button.callback('⬅️ Back', 'products'), Markup.button.callback('🏠 Admin', 'admin')]
]);

const successKeyboard = () => Markup.inlineKeyboard([
  [Markup.button.callback('📦 Product List', 'product_list')],
  [Markup.button.callback('➕ Add Product', 'add_product')],
  [Markup.button.callback('🏠 Admin', 'admin')]
]);

export function registerProductAdminRoutes(bot) {
  bot.action('products', async (ctx) => {
    const totalProducts = db.prepare('SELECT COUNT(DISTINCT name) AS c FROM products').get().c;
    const totalActive = db.prepare("SELECT COUNT(*) AS c FROM products WHERE status = 'on'").get().c;
    const totalDisabled = db.prepare("SELECT COUNT(*) AS c FROM products WHERE status = 'off'").get().c;

    set(ctx.from.id, 'product_page', 0);

    const text = `📦 PRODUCT MANAGER\n\n━━━━━━━━━━━━━━\n\n📦 Products : ${totalProducts}\n\n🟢 Active Plans : ${totalActive}\n\n🔴 Disabled Plans : ${totalDisabled}\n\n━━━━━━━━━━━━━━\n\nSelect an option.`;

    await edit(
      ctx,
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback('📦 Product List', 'product_list')],
        [Markup.button.callback('➕ Add Product', 'add_product'), Markup.button.callback('🔍 Search', 'search_product')],
        [Markup.button.callback('⬅️ Back', 'admin'), Markup.button.callback('🏠 Home', 'home')]
      ])
    );
  });

  bot.action('product_list', async (ctx) => {
    const uid = ctx.from.id;
    const page = value(uid, 'product_page') || 0;
    const limit = PRODUCTS_PER_PAGE;
    const offset = page * limit;

    const total = db.prepare('SELECT COUNT(DISTINCT name) AS c FROM products').get().c;
    const rows = db.prepare(`
      SELECT name, COUNT(*) AS plans
      FROM products
      GROUP BY name
      ORDER BY name COLLATE NOCASE
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const keyboard = rows.map((r) => [
      Markup.button.callback(`📦 ${r.name} (${r.plans})`, `group_${r.name}`)
    ]);

    const nav = [];
    if (page > 0) nav.push(Markup.button.callback('⬅️ Prev', 'product_prev'));
    if (offset + limit < total) nav.push(Markup.button.callback('➡️ Next', 'product_next'));
    if (nav.length) keyboard.push(nav);

    keyboard.push([Markup.button.callback('➕ Add Product', 'add_product')]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'products'), Markup.button.callback('🏠 Admin', 'admin')]);

    await edit(ctx, `📦 PRODUCT LIST\n\n━━━━━━━━━━━━━━\n\nProducts : ${total}\n\nPage : ${page + 1}\n\n━━━━━━━━━━━━━━\n\nSelect a Product.`, Markup.inlineKeyboard(keyboard));
  });

  bot.action('product_prev', async (ctx) => {
    const p = value(ctx.from.id, 'product_page') || 0;
    if (p > 0) set(ctx.from.id, 'product_page', p - 1);
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'product_list' } });
  });

  bot.action('product_next', async (ctx) => {
    const p = value(ctx.from.id, 'product_page') || 0;
    set(ctx.from.id, 'product_page', p + 1);
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'product_list' } });
  });

  bot.action(/^group_(.+)$/, async (ctx) => {
    const name = ctx.match[1];
    set(ctx.from.id, 'selected_product', name);

    const rows = db.prepare('SELECT id, duration, price, status FROM products WHERE name = ? ORDER BY id ASC').all(name);
    if (!rows.length) return await ctx.answerCbQuery('❌ Product Not Found', { show_alert: true });

    const keyboard = rows.map((r) => [
      Markup.button.callback(`${r.status === 'on' ? '🟢' : '🔴'} ${r.duration} • ${r.price} Tk`, `plan_${r.id}`)
    ]);
    keyboard.push([Markup.button.callback('➕ Add Duration', 'add_duration')]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'product_list'), Markup.button.callback('🏠 Admin', 'admin')]);

    await edit(ctx, `📦 ${name}\n\n━━━━━━━━━━━━━━\n\nAvailable Plans\n\n━━━━━━━━━━━━━━\n\nSelect a Duration.`, Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^plan_(\d+)$/, async (ctx) => {
    const pid = parseInt(ctx.match[1], 10);
    set(ctx.from.id, 'selected_plan', pid);

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(pid);
    if (!row) return await ctx.answerCbQuery('❌ Plan Not Found', { show_alert: true });

    const status = row.status === 'on' ? '🟢 Enabled' : '🔴 Disabled';
    const text = `📦 PRODUCT DETAILS\n\n━━━━━━━━━━━━━━\n\n📦 Name :\n${row.name}\n\n⏳ Duration :\n${row.duration}\n\n💰 Price :\n${row.price} Tk\n\n📡 Status :\n${status}`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Edit Name', 'edit_name')],
      [Markup.button.callback('⏳ Edit Duration', 'edit_duration'), Markup.button.callback('💰 Edit Price', 'edit_price')],
      [Markup.button.callback('🔄 ON / OFF', 'toggle_plan')],
      [Markup.button.callback('🗑 Delete', 'delete_plan')],
      [Markup.button.callback('⬅️ Back', `group_${row.name}`), Markup.button.callback('🏠 Admin', 'admin')]
    ]);

    await edit(ctx, text, keyboard);
  });

  bot.action('toggle_plan', async (ctx) => {
    const pid = value(ctx.from.id, 'selected_plan');
    const row = db.prepare('SELECT status FROM products WHERE id = ?').get(pid);
    if (!row) return await ctx.answerCbQuery('❌ Plan Not Found', { show_alert: true });

    const newStatus = row.status === 'on' ? 'off' : 'on';
    db.prepare('UPDATE products SET status = ? WHERE id = ?').run(newStatus, pid);

    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: `plan_${pid}` } });
  });

  bot.action('delete_plan', async (ctx) => {
    await edit(
      ctx,
      '⚠️ DELETE PLAN\n\n━━━━━━━━━━━━━━\n\nAre you sure?\n\nThis action cannot be undone.',
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes', 'delete_plan_yes'), Markup.button.callback('❌ No', 'plan_back')],
        [Markup.button.callback('⬅️ Back', 'plan_back'), Markup.button.callback('🏠 Admin', 'admin')]
      ])
    );
  });

  bot.action('delete_plan_yes', async (ctx) => {
    const uid = ctx.from.id;
    const pid = value(uid, 'selected_plan');
    const product = value(uid, 'selected_product');

    db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    const left = db.prepare('SELECT COUNT(*) AS c FROM products WHERE name = ?').get(product).c;

    if (left === 0) {
      return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'product_list' } });
    }
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: `group_${product}` } });
  });

  bot.action('add_duration', async (ctx) => {
    const uid = ctx.from.id;
    const prodName = value(uid, 'selected_product');
    startInput(uid, 'add_product_duration');
    set(uid, 'new_product_name', prodName);

    const msg = await edit(
      ctx,
      `📦 ${prodName}\n\n━━━━━━━━━━━━━━\n\n⏳ Send Duration\n\nExample:\n\n30 Days\n365 Days\nLifetime`,
      backAdmin()
    );
    set(uid, 'product_message', msg.message_id);
  });

  bot.action('add_product', async (ctx) => {
    const uid = ctx.from.id;
    startInput(uid, 'add_product_name');
    const msg = await edit(
      ctx,
      '➕ ADD PRODUCT\n\n━━━━━━━━━━━━━━\n\nSend Product Name\n\nExample:\n\nNetflix\nSpotify\nYouTube',
      backAdmin()
    );
    set(uid, 'product_message', msg.message_id);
  });

  bot.action('edit_name', async (ctx) => {
    startInput(ctx.from.id, 'edit_name');
    await edit(ctx, '✏️ EDIT PRODUCT NAME\n\n━━━━━━━━━━━━━━\n\nSend New Product Name', backAdmin());
  });

  bot.action('edit_duration', async (ctx) => {
    startInput(ctx.from.id, 'edit_duration');
    await edit(ctx, '⏳ EDIT DURATION\n\n━━━━━━━━━━━━━━\n\nSend New Duration', backAdmin());
  });

  bot.action('edit_price', async (ctx) => {
    startInput(ctx.from.id, 'edit_price');
    await edit(ctx, '💰 EDIT PRICE\n\n━━━━━━━━━━━━━━\n\nSend New Price', backAdmin());
  });

  bot.action('search_product', async (ctx) => {
    startInput(ctx.from.id, 'search_product');
    const msg = await edit(ctx, '🔍 SEARCH PRODUCT\n\n━━━━━━━━━━━━━━\n\nSend Product Name', backAdmin());
    set(ctx.from.id, 'product_message', msg.message_id);
  });
}

export async function handleProductAdminInput(ctx, mode) {
  const uid = ctx.from.id;
  const text = ctx.message.text.trim();
  try { await ctx.deleteMessage(); } catch (e) {}

  if (mode === 'add_product_name') {
    if (!text) return true;
    set(uid, 'new_product_name', text);
    startInput(uid, 'add_product_duration');
    const msgId = value(uid, 'product_message');
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msgId,
      null,
      `📦 ${text}\n\n━━━━━━━━━━━━━━\n\nSend Duration\n\nExample\n\n30 Days\n365 Days\nLifetime`,
      backAdmin()
    );
    return true;
  }

  if (mode === 'add_product_duration') {
    if (!text) return true;
    set(uid, 'new_duration', text);
    startInput(uid, 'add_product_price');
    const msgId = value(uid, 'product_message');
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msgId,
      null,
      `📦 ${value(uid, 'new_product_name')}\n\n━━━━━━━━━━━━━━\n\n⏳ ${text}\n\n━━━━━━━━━━━━━━\n\nSend Price`,
      backAdmin()
    );
    return true;
  }

  if (mode === 'add_product_price') {
    const price = parseInt(text, 10);
    if (isNaN(price)) return true;

    const name = value(uid, 'new_product_name');
    const duration = value(uid, 'new_duration');

    const duplicate = db.prepare('SELECT id FROM products WHERE name = ? AND duration = ?').get(name, duration);
    const msgId = value(uid, 'product_message');

    if (duplicate) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msgId,
        null,
        `❌ PLAN ALREADY EXISTS\n\n━━━━━━━━━━━━━━\n\n📦 ${name}\n\n⏳ ${duration}\n\nalready exists.`,
        backAdmin()
      );
      stopInput(uid);
      return true;
    }

    db.prepare(`
      INSERT INTO products (name, duration, price, status)
      VALUES (?, ?, ?, 'on')
    `).run(name, duration, price);

    stopInput(uid);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      msgId,
      null,
      `✅ PRODUCT SAVED\n\n━━━━━━━━━━━━━━\n\n📦 ${name}\n\n⏳ ${duration}\n\n💰 ${price} Tk\n\n🟢 Status : ON`,
      successKeyboard()
    );
    return true;
  }

  if (mode === 'edit_name') {
    const pid = value(uid, 'selected_plan');
    db.prepare('UPDATE products SET name = ? WHERE id = ?').run(text, pid);
    stopInput(uid);
    return showPlanDetailsFromInput(ctx, pid);
  }

  if (mode === 'edit_duration') {
    const pid = value(uid, 'selected_plan');
    db.prepare('UPDATE products SET duration = ? WHERE id = ?').run(text, pid);
    stopInput(uid);
    return showPlanDetailsFromInput(ctx, pid);
  }

  if (mode === 'edit_price') {
    const price = parseInt(text, 10);
    if (isNaN(price)) return true;
    const pid = value(uid, 'selected_plan');
    db.prepare('UPDATE products SET price = ? WHERE id = ?').run(price, pid);
    stopInput(uid);
    return showPlanDetailsFromInput(ctx, pid);
  }

  if (mode === 'search_product') {
    stopInput(uid);
    const rows = db.prepare(`
      SELECT name, COUNT(*) AS plans
      FROM products
      WHERE name LIKE ?
      GROUP BY name
      ORDER BY name
    `).all(`%${text}%`);

    const keyboard = rows.length
      ? rows.map((r) => [Markup.button.callback(`📦 ${r.name} (${r.plans})`, `group_${r.name}`)])
      : [[Markup.button.callback('❌ No Product Found', 'products')]];

    keyboard.push([Markup.button.callback('⬅️ Back', 'products'), Markup.button.callback('🏠 Admin', 'admin')]);

    const msgId = value(uid, 'product_message');
    await ctx.telegram.editMessageText(ctx.chat.id, msgId, null, '🔍 SEARCH RESULT', Markup.inlineKeyboard(keyboard));
    return true;
  }

  return false;
}

async function showPlanDetailsFromInput(ctx, pid) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(pid);
  if (!row) return;

  const status = row.status === 'on' ? '🟢 Enabled' : '🔴 Disabled';
  const text = `📦 PRODUCT DETAILS\n\n━━━━━━━━━━━━━━\n\n📦 Name :\n${row.name}\n\n⏳ Duration :\n${row.duration}\n\n💰 Price :\n${row.price} Tk\n\n📡 Status :\n${status}`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✏️ Edit Name', 'edit_name')],
    [Markup.button.callback('⏳ Edit Duration', 'edit_duration'), Markup.button.callback('💰 Edit Price', 'edit_price')],
    [Markup.button.callback('🔄 ON / OFF', 'toggle_plan')],
    [Markup.button.callback('🗑 Delete', 'delete_plan')],
    [Markup.button.callback('⬅️ Back', `group_${row.name}`), Markup.button.callback('🏠 Admin', 'admin')]
  ]);

  await ctx.reply(text, keyboard);
  return true;
}
