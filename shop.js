import { Markup } from 'telegraf';
import axios from 'axios';
import db from './database.js';
import { edit } from './utils.js';
import { KEY_API_URL, KEY_API_SECRET } from './config.js';

async function apiGenerateKey(product, duration, orderId = '', customerId = '') {
  try {
    const base = (KEY_API_URL || '').trim().replace(/\/$/, '');
    const secret = (KEY_API_SECRET || '').trim().replace(/\ufeff/g, '');

    const res = await axios.post(
      `${base}/generate`,
      {
        product: String(product),
        duration: String(duration),
        order_id: String(orderId),
        customer_id: String(customerId)
      },
      {
        headers: {
          'Authorization': `Bearer ${secret}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 12000
      }
    );
    return [res.data, res.status];
  } catch (err) {
    return [{ success: false, error: err.response?.data?.error || err.message }, err.response?.status || 0];
  }
}

export function registerShopRoutes(bot) {
  bot.action('shop', async (ctx) => {
    const rows = db.prepare("SELECT DISTINCT name FROM products WHERE status = 'on' ORDER BY name ASC").all();

    const keyboard = rows.map((r) => [
      Markup.button.callback(r.name, `shop_group_${r.name}`)
    ]);
    keyboard.push([Markup.button.callback('🏠 Home', 'home')]);

    await edit(ctx, '🛒 SHOP\n\n━━━━━━━━━━━━━━\n\nSelect a Product', Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^shop_group_(.+)$/, async (ctx) => {
    const product = ctx.match[1];
    const rows = db.prepare("SELECT id, duration, price FROM products WHERE name = ? AND status = 'on' ORDER BY id ASC").all(product);

    if (!rows.length) {
      return await ctx.answerCbQuery('❌ Product not found.', { show_alert: true });
    }

    const keyboard = rows.map((r) => [
      Markup.button.callback(`${r.duration} • ${r.price} Tk`, `shop_plan_${r.id}`)
    ]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'shop'), Markup.button.callback('🏠 Home', 'home')]);

    await edit(ctx, `📦 ${product}\n\n━━━━━━━━━━━━━━\n\nSelect Duration`, Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^shop_plan_(\d+)$/, async (ctx) => {
    const planId = parseInt(ctx.match[1], 10);
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(planId);

    if (!row) {
      return await ctx.answerCbQuery('❌ Product not found.', { show_alert: true });
    }

    const stock = db.prepare("SELECT COUNT(*) AS c FROM keys WHERE product = ? AND duration = ? AND status = 'unused'").get(row.name, row.duration).c;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🛒 Buy Now', `buy_${row.id}`)],
      [Markup.button.callback('⬅️ Back', `shop_group_${row.name}`), Markup.button.callback('🏠 Home', 'home')]
    ]);

    const text = `🛒 PRODUCT DETAILS\n\n━━━━━━━━━━━━━━\n\n📦 Product\n${row.name}\n\n⏱ Duration\n${row.duration}\n\n💰 Price\n${row.price} Tk\n\n📦 Stock\n${stock}\n\n━━━━━━━━━━━━━━\n\nChoose an option below.`;
    await edit(ctx, text, keyboard);
  });

  bot.action(/^buy_(\d+)$/, async (ctx) => {
    const planId = parseInt(ctx.match[1], 10);
    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(planId);

    if (!row) {
      return await ctx.answerCbQuery('❌ Product not found.', { show_alert: true });
    }

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(ctx.from.id);
    const balance = user ? user.balance : 0;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Confirm', `confirm_buy_${planId}`)],
      [Markup.button.callback('⬅️ Back', `shop_plan_${planId}`), Markup.button.callback('🏠 Home', 'home')]
    ]);

    const text = `🛒 CONFIRM PURCHASE\n\n━━━━━━━━━━━━━━\n\n📦 Product\n${row.name}\n\n⏱ Duration\n${row.duration}\n\n💰 Price\n${row.price} Tk\n\n💳 Your Balance\n${balance} Tk\n\n━━━━━━━━━━━━━━\n\nDo you want to continue?`;
    await edit(ctx, text, keyboard);
  });

  bot.action(/^confirm_buy_(\d+)$/, async (ctx) => {
    const uid = ctx.from.id;
    const planId = parseInt(ctx.match[1], 10);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(planId);
    if (!product) return await ctx.answerCbQuery('❌ Product not found.', { show_alert: true });

    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(uid);
    if (!user) return await ctx.answerCbQuery('❌ User not found.', { show_alert: true });

    if (user.balance < product.price) {
      return await ctx.answerCbQuery('❌ Insufficient Balance.', { show_alert: true });
    }

    const bars = [
      [10, "▓░░░░░░░░░"],
      [30, "▓▓▓░░░░░░░"],
      [60, "▓▓▓▓▓▓░░░░"],
      [90, "▓▓▓▓▓▓▓▓▓░"],
      [100, "▓▓▓▓▓▓▓▓▓▓"]
    ];

    for (const [pct, bar] of bars) {
      await edit(ctx, `╭━━ Processing... ━━╮\n\n    🔍 Checking Stock...\n\n    [${bar}] ${pct}%\n\n╰━━━━━━━━━━━━━━━━━━╯`);
      await new Promise((r) => setTimeout(r, 400));
    }

    let key = db.prepare("SELECT * FROM keys WHERE product = ? AND duration = ? AND status = 'unused' ORDER BY id ASC LIMIT 1").get(product.name, product.duration);

    let apiCreated = false;
    let apiOrderId = `GH${Date.now()}${String(uid).slice(-4)}`;
    let apiExpireAt = null;

    if (key) {
      await edit(ctx, "╭━━ Processing... ━━╮\n\n    ✅ Stock Found\n\n    📦 Taking key from stock...\n\n╰━━━━━━━━━━━━━━━━━━╯");
      await new Promise((r) => setTimeout(r, 800));
    } else {
      await edit(ctx, "╭━━ Processing... ━━╮\n\n    ⚠️ Stock Empty\n\n    🌐 Calling API...\n\n╰━━━━━━━━━━━━━━━━━━╯");
      await new Promise((r) => setTimeout(r, 1200));

      const [apiData, apiStatus] = await apiGenerateKey(product.name, product.duration, apiOrderId, uid);

      if (!apiData || !apiData.success || !apiData.key) {
        const reason = apiData?.error || `API HTTP ${apiStatus}`;
        await ctx.answerCbQuery('❌ API GENERATION FAILED', { show_alert: true });
        return await edit(
          ctx,
          `❌ KEY DELIVERY FAILED\n\n━━━━━━━━━━━━━━\n\n📦 Product\n${product.name}\n\n⏱ Duration\n${product.duration}\n\n🌐 API\n❌ ${reason}\n\nYour balance was NOT deducted.`,
          Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back', `buy_${planId}`), Markup.button.callback('🏠 Home', 'home')]
          ])
        );
      }

      key = {
        id: null,
        key: apiData.key,
        expires_at: apiData.expires_at
      };
      apiCreated = true;
      apiExpireAt = apiData.expires_at;
    }

    await edit(ctx, "╭━━ Processing... ━━╮\n\n    🔐 Generating Key...\n\n    ▓▓▓▓▓▓▓▓▓▓ 100%\n\n╰━━━━━━━━━━━━━━━━━━╯");
    await new Promise((r) => setTimeout(r, 600));

    // Deduct Balance
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(product.price, uid);

    const dur = product.duration.toLowerCase();
    let days = 0;
    if (dur.includes('1day')) days = 1;
    else if (dur.includes('3day')) days = 3;
    else if (dur.includes('7day')) days = 7;
    else if (dur.includes('15day')) days = 15;
    else if (dur.includes('30day')) days = 30;

    let expireAt = null;
    if (days > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + days);
      expireAt = expDate.toISOString().replace('T', ' ').substring(0, 19);
    }

    if (!apiCreated && key.id) {
      db.prepare(`
        UPDATE keys
        SET status = 'used', buyer_id = ?, used_at = datetime('now', 'localtime'), expire_at = ?
        WHERE id = ?
      `).run(uid, expireAt, key.id);
    } else {
      expireAt = apiExpireAt || expireAt;
    }

    db.prepare(`
      INSERT INTO orders (user, product, duration, amount, key, status, purchase_date, product_id, key_id, created_at)
      VALUES (?, ?, ?, ?, ?, 'completed', datetime('now', 'localtime'), ?, ?, datetime('now', 'localtime'))
    `).run(uid, product.name, product.duration, product.price, key.key, product.id, apiCreated ? null : key.id);

    const text = `✅ PURCHASE SUCCESS\n\n━━━━━━━━━━━━━━\n\n📦 Product\n${product.name}\n\n⏱ Duration\n${product.duration}\n\n💰 Paid\n${product.price} Tk\n\n🔑 Your Key\n\n━━━━━━━━━━━━━━\n${key.key}\n━━━━━━━━━━━━━━\n\n━━━━━━━━━━━━━━\n\nThank you for shopping ❤️`;

    await edit(
      ctx,
      text,
      Markup.inlineKeyboard([
        [{ text: "📋 Copy Key", copy_text: { text: String(key.key) } }],
        [Markup.button.callback('🛒 Shop', 'shop'), Markup.button.callback('🏠 Home', 'home')]
      ])
    );
  });
}
