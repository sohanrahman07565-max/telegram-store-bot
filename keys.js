import { Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';
import db from './database.js';
import { edit } from './utils.js';
import { startInput, stopInput } from './input.js';

const userSession = new Map();

function setSession(uid, key, val) {
  if (!userSession.has(uid)) userSession.set(uid, {});
  userSession.get(uid)[key] = val;
}

function getSession(uid, key) {
  return userSession.get(uid)?.[key] || '';
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateKey(prefix, groups, length) {
  const parts = [];
  for (let g = 0; g < groups; g++) {
    let part = '';
    for (let l = 0; l < length; l++) {
      part += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    parts.push(part);
  }
  return (prefix ? prefix + '-' : '') + parts.join('-');
}

function addKeyLog(adminId, productId, productName, duration, action, quantity, details = '') {
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  try {
    db.prepare(`
      INSERT INTO key_logs (admin_id, product_id, product_name, duration, action, quantity, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adminId, productId, productName, duration, action, quantity, details, now);
  } catch (e) {}
}

export function registerKeysRoutes(bot) {
  // 🔑 KEY MANAGER
  bot.action('keys', async (ctx) => {
    const total = db.prepare('SELECT COUNT(*) AS c FROM keys').get()?.c || 0;
    const available = db.prepare("SELECT COUNT(*) AS c FROM keys WHERE status='unused'").get()?.c || 0;
    const used = db.prepare("SELECT COUNT(*) AS c FROM keys WHERE status='used'").get()?.c || 0;
    const distinctKeys = db.prepare('SELECT COUNT(DISTINCT key) AS c FROM keys').get()?.c || 0;
    const duplicate = total - distinctKeys;

    const text = `🔑 KEY MANAGER\n\n━━━━━━━━━━━━━━\n\n🔑 Total Keys : ${total}\n\n🟢 Available : ${available}\n\n🔴 Used : ${used}\n\n🧹 Duplicate : ${duplicate}\n\n━━━━━━━━━━━━━━\n\nSelect an option.`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🟢 ➕ Add Keys', 'add_keys'), Markup.button.callback('🟡 ⚡ Generate', 'generate_keys')],
      [Markup.button.callback('🔵 📥 Import TXT', 'import_keys'), Markup.button.callback('🔵 📤 Export TXT', 'export_keys')],
      [Markup.button.callback('🔵 📋 View Keys', 'view_keys'), Markup.button.callback('🔵 🔍 Search', 'search_key')],
      [Markup.button.callback('⚙️ Auto Delete', 'auto_delete_panel')],
      [Markup.button.callback('🟣 📊 Statistics', 'key_statistics'), Markup.button.callback('🟣 📜 History', 'key_history')],
      [Markup.button.callback('🔴 🗑 Delete', 'delete_keys'), Markup.button.callback('🟠 🧹 Duplicate', 'duplicate_keys')],
      [Markup.button.callback('⬅️ Back', 'admin')]
    ]);

    await edit(ctx, text, keyboard);
  });

  // --- ⚡ GENERATE KEYS FLOW ---
  bot.action('generate_keys', async (ctx) => {
    setSession(ctx.from.id, 'generate_msg', ctx.callbackQuery.message.message_id);
    const rows = db.prepare("SELECT DISTINCT name FROM products WHERE status='on' ORDER BY name").all();
    const keyboard = rows.map((r) => [Markup.button.callback(r.name, `gen_prod_${encodeURIComponent(r.name)}`)]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'keys')]);

    await edit(ctx, '⚡ GENERATE KEYS\n\n━━━━━━━━━━━━━━\n\nSelect Product', Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^gen_prod_(.+)$/, async (ctx) => {
    const product = decodeURIComponent(ctx.match[1]);
    setSession(ctx.from.id, 'gen_product', product);
    const rows = db.prepare('SELECT duration, price FROM products WHERE name=? ORDER BY id').all(product);

    const keyboard = rows.map((r) => [
      Markup.button.callback(`${r.duration} • ${r.price} Tk`, `gen_dur_${encodeURIComponent(r.duration)}`)
    ]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'generate_keys')]);

    await edit(ctx, `📦 ${product}\n\n━━━━━━━━━━━━━━\n\nSelect Duration`, Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^gen_dur_(.+)$/, async (ctx) => {
    const duration = decodeURIComponent(ctx.match[1]);
    setSession(ctx.from.id, 'gen_duration', duration);

    const keyboard = [];
    for (let start = 1; start <= 20; start += 5) {
      const btns = [];
      for (let i = start; i < Math.min(start + 5, 21); i++) {
        btns.push(Markup.button.callback(String(i), `grp_cnt_${i}`));
      }
      keyboard.push(btns);
    }
    keyboard.push([Markup.button.callback('⬅️ Back', 'generate_keys')]);

    await edit(ctx, '🔢 SELECT GROUP COUNT\n\n━━━━━━━━━━━━━━\n\nSelect Group Count', Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^grp_cnt_(\d+)$/, async (ctx) => {
    const group = parseInt(ctx.match[1], 10);
    setSession(ctx.from.id, 'gen_group', group);

    const keyboard = [];
    for (let start = 1; start <= 20; start += 5) {
      const btns = [];
      for (let i = start; i < Math.min(start + 5, 21); i++) {
        btns.push(Markup.button.callback(String(i), `grp_len_${i}`));
      }
      keyboard.push(btns);
    }
    keyboard.push([Markup.button.callback('⬅️ Back', 'generate_keys')]);

    await edit(ctx, `📏 SELECT GROUP LENGTH\n\n━━━━━━━━━━━━━━\n\n🔢 Groups : ${group}\n\nSelect Length For Each Group`, Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^grp_len_(\d+)$/, async (ctx) => {
    const length = parseInt(ctx.match[1], 10);
    setSession(ctx.from.id, 'gen_length', length);
    const group = getSession(ctx.from.id, 'gen_group') || 3;
    startInput(ctx.from.id, 'generate_count');

    const text = `⚡ GENERATE KEYS\n\n━━━━━━━━━━━━━━\n\n🔢 Groups : ${group}\n\n📏 Group Length : ${length}\n\n━━━━━━━━━━━━━━\n\nSend Generate Count\n\nExample\n\n100`;
    await edit(ctx, text, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'generate_keys')]]));
  });

  // --- ➕ ADD KEYS FLOW ---
  bot.action('add_keys', async (ctx) => {
    const rows = db.prepare("SELECT DISTINCT name FROM products WHERE status='on' ORDER BY name").all();
    const keyboard = rows.map((r) => [Markup.button.callback(r.name, `add_k_prod_${encodeURIComponent(r.name)}`)]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'keys')]);

    await edit(ctx, '➕ ADD KEYS\n\n━━━━━━━━━━━━━━\n\nSelect Product', Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^add_k_prod_(.+)$/, async (ctx) => {
    const product = decodeURIComponent(ctx.match[1]);
    setSession(ctx.from.id, 'key_product', product);
    const rows = db.prepare('SELECT duration, price FROM products WHERE name=? ORDER BY id').all(product);

    const keyboard = rows.map((r) => [
      Markup.button.callback(`${r.duration} • ${r.price} Tk`, `add_k_dur_${encodeURIComponent(r.duration)}`)
    ]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'add_keys')]);

    await edit(ctx, `📦 ${product}\n\n━━━━━━━━━━━━━━\n\nSelect Duration`, Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^add_k_dur_(.+)$/, async (ctx) => {
    const duration = decodeURIComponent(ctx.match[1]);
    const product = getSession(ctx.from.id, 'key_product');
    setSession(ctx.from.id, 'key_duration', duration);
    setSession(ctx.from.id, 'add_keys_msg', ctx.callbackQuery.message.message_id);
    startInput(ctx.from.id, 'save_keys');

    const text = `🔑 SEND KEYS\n\n━━━━━━━━━━━━━━\n\n📦 Product :\n${product}\n\n⏳ Duration :\n${duration}\n\n━━━━━━━━━━━━━━\n\nSend one key per line.\n\nExample\n\nAAAA-BBBB-CCCC\n\nDDDD-EEEE-FFFF`;
    await edit(ctx, text, Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'keys')]]));
  });

  // --- 📋 VIEW KEYS FLOW ---
  bot.action('view_keys', async (ctx) => {
    const rows = db.prepare("SELECT DISTINCT name FROM products WHERE status='on' ORDER BY name").all();
    const keyboard = rows.map((r) => [Markup.button.callback(r.name, `view_p_${encodeURIComponent(r.name)}`)]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'keys')]);

    await edit(ctx, '📋 VIEW KEYS\n\n━━━━━━━━━━━━━━\n\nSelect Product', Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^view_p_(.+)$/, async (ctx) => {
    const product = decodeURIComponent(ctx.match[1]);
    const rows = db.prepare('SELECT duration, price FROM products WHERE name=? ORDER BY id').all(product);
    const keyboard = rows.map((r) => [Markup.button.callback(`${r.duration} • ${r.price} Tk`, `view_d_${encodeURIComponent(product)}_${encodeURIComponent(r.duration)}`)]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'view_keys')]);

    await edit(ctx, `📦 ${product}\n\n━━━━━━━━━━━━━━\n\nSelect Duration`, Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^view_d_([^_]+)_(.+)$/, async (ctx) => {
    const product = decodeURIComponent(ctx.match[1]);
    const duration = decodeURIComponent(ctx.match[2]);

    const total = db.prepare('SELECT COUNT(*) AS c FROM keys WHERE product=? AND duration=?').get(product, duration)?.c || 0;
    const available = db.prepare("SELECT COUNT(*) AS c FROM keys WHERE product=? AND duration=? AND status='unused'").get(product, duration)?.c || 0;
    const used = total - available;

    const text = `🔑 KEY INFORMATION\n\n━━━━━━━━━━━━━━\n\n📦 Product :\n${product}\n\n⏳ Duration :\n${duration}\n\n━━━━━━━━━━━━━━\n\n📦 Total :\n${total}\n\n🟢 Available :\n${available}\n\n🔴 Used :\n${used}`;

    const encP = encodeURIComponent(product);
    const encD = encodeURIComponent(duration);
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🟢 Available', `view_avail_${encP}_${encD}_1`), Markup.button.callback('🔴 Used', `view_used_${encP}_${encD}_1`)],
      [Markup.button.callback('📤 Export', `exp_p_all_${encP}`), Markup.button.callback('🔴 🗑 Delete', `del_pd_${encP}_${encD}`)],
      [Markup.button.callback('⬅️ Back', `view_p_${encP}`)]
    ]);

    await edit(ctx, text, keyboard);
  });

  // Available Keys Paging
  bot.action(/^view_avail_([^_]+)_([^_]+)_(\d+)$/, async (ctx) => {
    const product = decodeURIComponent(ctx.match[1]);
    const duration = decodeURIComponent(ctx.match[2]);
    const page = parseInt(ctx.match[3], 10);
    const perPage = 20;

    const total = db.prepare("SELECT COUNT(*) AS c FROM keys WHERE product=? AND duration=? AND status='unused'").get(product, duration)?.c || 0;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const offset = (page - 1) * perPage;

    const rows = db.prepare("SELECT key, created_at FROM keys WHERE product=? AND duration=? AND status='unused' ORDER BY id LIMIT ? OFFSET ?").all(product, duration, perPage, offset);

    let text = `🟢 AVAILABLE KEYS\n\n━━━━━━━━━━━━━━\n\n📦 ${product}\n⏳ ${duration}\n📄 Page ${page}/${pages}\n\n━━━━━━━━━━━━━━\n\n`;
    if (!rows.length) text += 'No Available Keys.';
    else rows.forEach((r) => { text += `🔑 ${r.key}\n🕒 ${r.created_at || '-'}\n\n`; });

    const encP = encodeURIComponent(product);
    const encD = encodeURIComponent(duration);
    const keyboard = [];
    const nav = [];
    if (page > 1) nav.push(Markup.button.callback('⬅️ Prev', `view_avail_${encP}_${encD}_${page - 1}`));
    if (page < pages) nav.push(Markup.button.callback('Next ➡️', `view_avail_${encP}_${encD}_${page + 1}`));
    if (nav.length) keyboard.push(nav);

    keyboard.push([Markup.button.callback('⬅️ Back', `view_d_${encP}_${encD}`)]);
    await edit(ctx, text, Markup.inlineKeyboard(keyboard));
  });

  // Used Keys Paging
  bot.action(/^view_used_([^_]+)_([^_]+)_(\d+)$/, async (ctx) => {
    const product = decodeURIComponent(ctx.match[1]);
    const duration = decodeURIComponent(ctx.match[2]);
    const page = parseInt(ctx.match[3], 10);
    const perPage = 20;

    const total = db.prepare("SELECT COUNT(*) AS c FROM keys WHERE product=? AND duration=? AND status='used'").get(product, duration)?.c || 0;
    const pages = Math.max(1, Math.ceil(total / perPage));
    const offset = (page - 1) * perPage;

    const rows = db.prepare("SELECT key, buyer_id, order_id, used_at FROM keys WHERE product=? AND duration=? AND status='used' ORDER BY used_at DESC LIMIT ? OFFSET ?").all(product, duration, perPage, offset);

    let text = `🔴 USED KEYS\n\n━━━━━━━━━━━━━━\n\n📦 ${product}\n⏳ ${duration}\n📄 Page ${page}/${pages}\n\n━━━━━━━━━━━━━━\n\n`;
    if (!rows.length) text += 'No Used Keys.';
    else rows.forEach((r) => { text += `🔑 ${r.key}\n👤 Buyer: ${r.buyer_id || '-'}\n🛒 Order: ${r.order_id || '-'}\n🕒 Used: ${r.used_at || '-'}\n\n`; });

    const encP = encodeURIComponent(product);
    const encD = encodeURIComponent(duration);
    const keyboard = [];
    const nav = [];
    if (page > 1) nav.push(Markup.button.callback('⬅️ Prev', `view_used_${encP}_${encD}_${page - 1}`));
    if (page < pages) nav.push(Markup.button.callback('Next ➡️', `view_used_${encP}_${encD}_${page + 1}`));
    if (nav.length) keyboard.push(nav);

    keyboard.push([Markup.button.callback('⬅️ Back', `view_d_${encP}_${encD}`)]);
    await edit(ctx, text, Markup.inlineKeyboard(keyboard));
  });

  // --- 📥 IMPORT TXT FLOW ---
  bot.action('import_keys', async (ctx) => {
    const rows = db.prepare("SELECT DISTINCT name FROM products WHERE status='on' ORDER BY name").all();
    const keyboard = rows.map((r) => [Markup.button.callback(r.name, `imp_p_${encodeURIComponent(r.name)}`)]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'keys')]);

    await edit(ctx, '📥 IMPORT KEYS\n\n━━━━━━━━━━━━━━\n\nSelect Product', Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^imp_p_(.+)$/, async (ctx) => {
    const product = decodeURIComponent(ctx.match[1]);
    setSession(ctx.from.id, 'import_product', product);
    const rows = db.prepare('SELECT duration, price FROM products WHERE name=? ORDER BY id').all(product);
    const keyboard = rows.map((r) => [Markup.button.callback(`${r.duration} • ${r.price} Tk`, `imp_d_${encodeURIComponent(r.duration)}`)]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'import_keys')]);

    await edit(ctx, `📦 ${product}\n\n━━━━━━━━━━━━━━\n\nSelect Duration`, Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^imp_d_(.+)$/, async (ctx) => {
    const duration = decodeURIComponent(ctx.match[1]);
    const product = getSession(ctx.from.id, 'import_product');
    setSession(ctx.from.id, 'import_duration', duration);
    setSession(ctx.from.id, 'import_msg', ctx.callbackQuery.message.message_id);
    startInput(ctx.from.id, 'import_txt');

    const text = `📥 IMPORT TXT\n\n━━━━━━━━━━━━━━\n\n📦 Product :\n${product}\n\n⏳ Duration :\n${duration}\n\n━━━━━━━━━━━━━━\n\nSend TXT File\n\n• Only .txt\n\n• One key per line`;
    await edit(ctx, text, Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'keys')]]));
  });

  // --- 📤 EXPORT TXT FLOW ---
  bot.action('export_keys', async (ctx) => {
    await edit(
      ctx,
      '📤 EXPORT KEYS\n\n━━━━━━━━━━━━━━\n\nChoose Export Type',
      Markup.inlineKeyboard([
        [Markup.button.callback('🟢 Available', 'export_available'), Markup.button.callback('🔴 Used', 'export_used')],
        [Markup.button.callback('📦 All Keys', 'export_all')],
        [Markup.button.callback('⬅️ Back', 'keys')]
      ])
    );
  });

  const renderExportProducts = async (ctx, exportType) => {
    const rows = db.prepare("SELECT DISTINCT name FROM products WHERE status='on' ORDER BY name").all();
    const keyboard = rows.map((r) => [Markup.button.callback(r.name, `exp_prod_${exportType}_${encodeURIComponent(r.name)}`)]);
    keyboard.push([Markup.button.callback('⬅️ Back', 'export_keys')]);
    await edit(ctx, `📤 EXPORT\n\n━━━━━━━━━━━━━━\n\nType : ${exportType.toUpperCase()}\n\n━━━━━━━━━━━━━━\n\nSelect Product`, Markup.inlineKeyboard(keyboard));
  };

  bot.action('export_available', (ctx) => renderExportProducts(ctx, 'available'));
  bot.action('export_used', (ctx) => renderExportProducts(ctx, 'used'));
  bot.action('export_all', (ctx) => renderExportProducts(ctx, 'all'));

  bot.action(/^exp_prod_([^_]+)_(.+)$/, async (ctx) => {
    const exportType = ctx.match[1];
    const product = decodeURIComponent(ctx.match[2]);
    setSession(ctx.from.id, 'export_type', exportType);
    setSession(ctx.from.id, 'export_product', product);

    const rows = db.prepare('SELECT duration FROM products WHERE name=? ORDER BY id').all(product);
    const keyboard = rows.map((r) => [Markup.button.callback(r.duration, `exp_dur_${encodeURIComponent(r.duration)}`)]);
    keyboard.push([Markup.button.callback('⬅️ Back', `export_${exportType}`)]);

    await edit(ctx, `📦 ${product}\n\n━━━━━━━━━━━━━━\n\nSelect Duration`, Markup.inlineKeyboard(keyboard));
  });

  bot.action(/^exp_dur_(.+)$/, async (ctx) => {
    const duration = decodeURIComponent(ctx.match[1]);
    const product = getSession(ctx.from.id, 'export_product');
    setSession(ctx.from.id, 'export_duration', duration);

    const text = `📤 EXPORT READY\n\n━━━━━━━━━━━━━━\n\n📦 Product :\n${product}\n\n⏳ Duration :\n${duration}\n\n━━━━━━━━━━━━━━\n\nPress Continue`;
    await edit(ctx, text, Markup.inlineKeyboard([[Markup.button.callback('📤 Export', 'export_now')], [Markup.button.callback('❌ Cancel', 'keys')]]));
  });

  bot.action('export_now', async (ctx) => {
    const uid = ctx.from.id;
    const exportType = getSession(uid, 'export_type');
    const product = getSession(uid, 'export_product');
    const duration = getSession(uid, 'export_duration');

    let sql = 'SELECT key FROM keys WHERE product=? AND duration=?';
    const params = [product, duration];
    if (exportType === 'available') sql += " AND status='unused'";
    else if (exportType === 'used') sql += " AND status='used'";
    sql += ' ORDER BY id';

    const rows = db.prepare(sql).all(...params);
    if (!rows.length) return await ctx.answerCbQuery('❌ No Keys Found.', { show_alert: true });

    fs.mkdirSync('data/exports', { recursive: true });
    const filename = `${product}_${duration}_${exportType}.txt`.replace(/\s+/g, '_');
    const filepath = path.join('data/exports', filename);
    fs.writeFileSync(filepath, rows.map((r) => r.key).join('\n'), 'utf-8');

    addKeyLog(uid, null, product, duration, 'EXPORT', rows.length, exportType);

    await ctx.replyWithDocument(
      { source: filepath, filename },
      { caption: `📤 Export Complete\n\n📦 ${product}\n⏳ ${duration}\n📄 ${exportType.toUpperCase()}\n🔑 ${rows.length} Keys` }
    );
    await edit(ctx, '✅ Export Completed.', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'keys')]]));
  });

  // --- 📜 HISTORY FLOW ---
  bot.action('key_history', async (ctx) => {
    const rows = db.prepare('SELECT * FROM key_logs ORDER BY id DESC LIMIT 30').all();
    let text = '📜 KEY HISTORY\n\n';
    if (!rows.length) text += 'No History.';
    else rows.forEach((r) => { text += `👤 ${r.admin_id}\n⚡ ${r.action}\n📦 ${r.product_name}\n⏳ ${r.duration}\n🔑 ${r.quantity}\n🕒 ${r.created_at}\n\n`; });

    await edit(ctx, text, Markup.inlineKeyboard([
      [Markup.button.callback('🗑 Clear', 'clear_key_history'), Markup.button.callback('🔄 Refresh', 'key_history')],
      [Markup.button.callback('⬅️ Back', 'keys')]
    ]));
  });

  bot.action('clear_key_history', async (ctx) => {
    await edit(ctx, '⚠️ CLEAR HISTORY\n\n━━━━━━━━━━━━━━\n\nAre you sure?\n\nThis cannot be undone.', Markup.inlineKeyboard([
      [Markup.button.callback('✅ Yes', 'confirm_clear_key_history')],
      [Markup.button.callback('❌ Cancel', 'key_history')]
    ]));
  });

  bot.action('confirm_clear_key_history', async (ctx) => {
    db.prepare('DELETE FROM key_logs').run();
    await edit(ctx, '✅ HISTORY CLEARED', Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'keys')]]));
  });

  // --- ⚙️ AUTO DELETE FLOW ---
  bot.action('auto_delete_panel', async (ctx) => {
    const row = db.prepare("SELECT value FROM settings WHERE key='auto_delete_keys'").get();
    const status = row?.value === '1';
    const text = `⚙️ AUTO DELETE\n\n━━━━━━━━━━━━━━\n\nStatus :\n${status ? '🟢 ON' : '🔴 OFF'}\n\nExpired keys will be deleted automatically.`;
    await edit(ctx, text, Markup.inlineKeyboard([
      [Markup.button.callback(status ? '🔴 Turn OFF' : '🟢 Turn ON', 'toggle_auto_delete')],
      [Markup.button.callback('⬅️ Back', 'keys'), Markup.button.callback('👑 Admin', 'admin')]
    ]));
  });

  bot.action('toggle_auto_delete', async (ctx) => {
    const row = db.prepare("SELECT value FROM settings WHERE key='auto_delete_keys'").get();
    const newVal = row?.value === '1' ? '0' : '1';
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_delete_keys', ?)").run(newVal);
    await ctx.answerCbQuery(newVal === '1' ? '🟢 Auto Delete Enabled' : '🔴 Auto Delete Disabled');
    return bot.handleUpdate({ ...ctx.update, callback_query: { ...ctx.callbackQuery, data: 'auto_delete_panel' } });
  });

  // --- 🔍 SEARCH & DELETE ---
  bot.action('search_key', async (ctx) => {
    await edit(ctx, '🔍 SEARCH KEY\n\n━━━━━━━━━━━━━━\n\nChoose Search Type', Markup.inlineKeyboard([
      [Markup.button.callback('🔑 Search Key', 'search_by_key')],
      [Markup.button.callback('👤 Buyer ID', 'search_by_buyer'), Markup.button.callback('🛒 Order ID', 'search_by_order')],
      [Markup.button.callback('⬅️ Back', 'keys')]
    ]));
  });

  bot.action('search_by_key', async (ctx) => {
    startInput(ctx.from.id, 'search_key_value');
    await edit(ctx, '🔑 SEARCH KEY\n\n━━━━━━━━━━━━━━\n\nSend Full Key', Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'search_key')]]));
  });

  bot.action('search_by_buyer', async (ctx) => {
    startInput(ctx.from.id, 'search_buyer_value');
    await edit(ctx, '👤 SEARCH BUYER\n\n━━━━━━━━━━━━━━\n\nSend Buyer ID', Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'search_key')]]));
  });

  bot.action('search_by_order', async (ctx) => {
    startInput(ctx.from.id, 'search_order_value');
    await edit(ctx, '🛒 SEARCH ORDER\n\n━━━━━━━━━━━━━━\n\nSend Order ID', Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'search_key')]]));
  });

  bot.action('delete_keys', async (ctx) => {
    await edit(ctx, '🗑 DELETE KEYS\n\n━━━━━━━━━━━━━━\n\nSelect Delete Option', Markup.inlineKeyboard([
      [Markup.button.callback('🟢 Available', 'delete_available_keys'), Markup.button.callback('🔴 Used', 'delete_used_keys')],
      [Markup.button.callback('🟠 🧹 Duplicate', 'delete_duplicate_keys')],
      [Markup.button.callback('💥 Delete All', 'delete_all_keys')],
      [Markup.button.callback('⬅️ Back', 'keys')]
    ]));
  });

  bot.action('delete_available_keys', async (ctx) => {
    const count = db.prepare("SELECT COUNT(*) AS c FROM keys WHERE status='unused'").get()?.c || 0;
    db.prepare("DELETE FROM keys WHERE status='unused'").run();
    addKeyLog(ctx.from.id, null, 'ALL', 'ALL', 'DELETE_AVAILABLE', count, 'Available Keys');
    await edit(ctx, `✅ Deleted\n\n━━━━━━━━━━━━━━\n\n🟢 Available Keys\n\nDeleted : ${count}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'delete_keys')]]));
  });

  bot.action('delete_used_keys', async (ctx) => {
    const count = db.prepare("SELECT COUNT(*) AS c FROM keys WHERE status='used'").get()?.c || 0;
    db.prepare("DELETE FROM keys WHERE status='used'").run();
    addKeyLog(ctx.from.id, null, 'ALL', 'ALL', 'DELETE_USED', count, 'Used Keys');
    await edit(ctx, `✅ Deleted\n\n━━━━━━━━━━━━━━\n\n🔴 Used Keys\n\nDeleted : ${count}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'delete_keys')]]));
  });

  bot.action('delete_all_keys', async (ctx) => {
    const count = db.prepare('SELECT COUNT(*) AS c FROM keys').get()?.c || 0;
    db.prepare('DELETE FROM keys').run();
    addKeyLog(ctx.from.id, null, 'ALL', 'ALL', 'DELETE_ALL', count, 'All Keys');
    await edit(ctx, `💥 ALL KEYS DELETED\n\n━━━━━━━━━━━━━━\n\nDeleted :\n\n${count}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'keys')]]));
  });

  bot.action('delete_duplicate_keys', async (ctx) => {
    const before = db.prepare('SELECT COUNT(*) AS c FROM keys').get()?.c || 0;
    db.prepare('DELETE FROM keys WHERE id NOT IN (SELECT MIN(id) FROM keys GROUP BY key)').run();
    const after = db.prepare('SELECT COUNT(*) AS c FROM keys').get()?.c || 0;
    const deleted = before - after;
    addKeyLog(ctx.from.id, null, 'ALL', 'ALL', 'DELETE_DUPLICATE', deleted, 'Duplicate Cleaner');
    await edit(ctx, `🧹 DUPLICATES REMOVED\n\n━━━━━━━━━━━━━━\n\nDeleted :\n\n${deleted}`, Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'keys')]]));
  });

  bot.action('duplicate_keys', async (ctx) => {
    const dupCount = db.prepare('SELECT COUNT(*) AS c FROM (SELECT key FROM keys GROUP BY key HAVING COUNT(*) > 1)').get()?.c || 0;
    await edit(ctx, `🧹 DUPLICATE KEYS\n\n━━━━━━━━━━━━━━\n\nDuplicate Found : ${dupCount}\n\n━━━━━━━━━━━━━━`, Markup.inlineKeyboard([
      [Markup.button.callback('🗑 Remove Duplicate', 'delete_duplicate_keys')],
      [Markup.button.callback('⬅️ Back', 'keys')]
    ]));
  });

  bot.action('key_statistics', async (ctx) => {
    const total = db.prepare('SELECT COUNT(*) AS c FROM keys').get()?.c || 0;
    const available = db.prepare("SELECT COUNT(*) AS c FROM keys WHERE status='unused'").get()?.c || 0;
    const used = db.prepare("SELECT COUNT(*) AS c FROM keys WHERE status='used'").get()?.c || 0;
    const products = db.prepare('SELECT COUNT(DISTINCT product) AS c FROM keys').get()?.c || 0;
    const lowStock = db.prepare("SELECT COUNT(*) AS c FROM (SELECT product FROM keys WHERE status='unused' GROUP BY product, duration HAVING COUNT(*) <= 10)").get()?.c || 0;
    const duplicate = total - (db.prepare('SELECT COUNT(DISTINCT key) AS c FROM keys').get()?.c || 0);

    const text = `📊 KEY STATISTICS\n\n━━━━━━━━━━━━━━\n\n🔑 Total Keys :\n${total}\n\n🟢 Available :\n${available}\n\n🔴 Used :\n${used}\n\n🧹 Duplicate :\n${duplicate}\n\n📦 Products :\n${products}\n\n⚠️ Low Stock :\n${lowStock}\n\n━━━━━━━━━━━━━━`;
    await edit(ctx, text, Markup.inlineKeyboard([[Markup.button.callback('🔄 Refresh', 'key_statistics')], [Markup.button.callback('⬅️ Back', 'keys')]]));
  });
}

// ইনপুট হ্যান্ডলার (একই মেসেজ এডিট করে আপডেট)
export async function handleKeysInput(ctx, mode) {
  const uid = ctx.from.id;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  if (mode === 'save_keys') {
    const product = getSession(uid, 'key_product');
    const duration = getSession(uid, 'key_duration');
    const lines = (ctx.message.text || '').split('\n');

    let added = 0;
    let duplicate = 0;
    for (const line of lines) {
      const key = line.trim();
      if (!key) continue;
      const exist = db.prepare('SELECT 1 FROM keys WHERE key=?').get(key);
      if (exist) { duplicate++; continue; }
      db.prepare("INSERT INTO keys (product, duration, key, status, created_at) VALUES (?, ?, ?, 'unused', ?)").run(product, duration, key, now);
      added++;
    }

    addKeyLog(uid, null, product, duration, 'ADD', added, `Duplicate: ${duplicate}`);
    stopInput(uid);
    try { await ctx.deleteMessage(); } catch (e) {}

    const text = `✅ KEYS ADDED\n\n━━━━━━━━━━━━━━\n\n📦 Product : ${product}\n⏳ Duration : ${duration}\n\n━━━━━━━━━━━━━━\n\n✅ Added : ${added}\n⚠️ Duplicate : ${duplicate}`;
    const kb = Markup.inlineKeyboard([[Markup.button.callback('🔑 Keys', 'keys'), Markup.button.callback('👑 Admin Panel', 'admin')]]);
    const msgId = getSession(uid, 'add_keys_msg');

    try {
      if (msgId) await ctx.telegram.editMessageText(ctx.chat.id, msgId, null, text, kb);
      else await ctx.reply(text, kb);
    } catch (e) {
      await ctx.reply(text, kb);
    }
    return true;
  }

  if (mode === 'generate_count') {
    const count = parseInt(ctx.message.text.trim(), 10);
    if (isNaN(count) || count <= 0) {
      await ctx.reply('❌ Please enter a valid number.');
      return true;
    }

    const product = getSession(uid, 'gen_product');
    const duration = getSession(uid, 'gen_duration');
    const group = parseInt(getSession(uid, 'gen_group') || '3', 10);
    const length = parseInt(getSession(uid, 'gen_length') || '3', 10);

    let prefix = '';
    try {
      const row = db.prepare('SELECT prefix FROM products WHERE name=? AND duration=? LIMIT 1').get(product, duration);
      if (row?.prefix) prefix = row.prefix;
    } catch (e) {}

    let added = 0;
    const stmt = db.prepare("INSERT INTO keys (product, duration, key, status, created_at) VALUES (?, ?, ?, 'unused', ?)");

    for (let i = 0; i < count; i++) {
      const key = generateKey(prefix, group, length);
      try {
        stmt.run(product, duration, key, now);
        added++;
      } catch (err) {}
    }

    addKeyLog(uid, null, product, duration, 'GENERATE', added, `Length: ${length}`);
    stopInput(uid);
    try { await ctx.deleteMessage(); } catch (e) {}

    const text = `✅ GENERATE SUCCESS\n\n━━━━━━━━━━━━━━\n\n📦 Product : ${product}\n🏷 Prefix : ${prefix || 'None'}\n⏳ Duration : ${duration}\n📏 Length : ${length}\n\n━━━━━━━━━━━━━━\n\n🔑 Generated : ${added}`;
    const msgId = getSession(uid, 'generate_msg');
    const kb = Markup.inlineKeyboard([[Markup.button.callback('🔑 Keys', 'keys'), Markup.button.callback('👑 Admin Panel', 'admin')]]);

    try {
      if (msgId) await ctx.telegram.editMessageText(ctx.chat.id, msgId, null, text, kb);
      else await ctx.reply(text, kb);
    } catch (e) {
      await ctx.reply(text, kb);
    }
    return true;
  }

  if (mode === 'search_key_value') {
    const key = ctx.message.text.trim();
    const row = db.prepare('SELECT * FROM keys WHERE key=? LIMIT 1').get(key);
    stopInput(uid);
    if (!row) return await ctx.reply('❌ Key Not Found.');
    await ctx.reply(`🔑 Key: \`${row.key}\`\n📦 Product: ${row.product} (${row.duration})\nStatus: ${row.status}\nBuyer: ${row.buyer_id || '-'}\nOrder: ${row.order_id || '-'}`, { parse_mode: 'Markdown' });
    return true;
  }

  if (mode === 'search_buyer_value') {
    const buyer = ctx.message.text.trim();
    const total = db.prepare('SELECT COUNT(*) AS c FROM keys WHERE buyer_id=?').get(buyer)?.c || 0;
    stopInput(uid);
    await ctx.reply(`👤 BUYER RESULT\n\n━━━━━━━━━━━━━━\n\nBuyer ID : ${buyer}\n\n━━━━━━━━━━━━━━\n\n🔑 Total Keys : ${total}`);
    return true;
  }

  if (mode === 'search_order_value') {
    const order = ctx.message.text.trim();
    const rows = db.prepare('SELECT * FROM keys WHERE order_id=?').all(order);
    stopInput(uid);
    if (!rows.length) return await ctx.reply('❌ Order Not Found.');
    let text = `🛒 ORDER : ${order}\n\n`;
    rows.forEach((r) => { text += `🔑 ${r.key} (${r.product} | ${r.duration})\n`; });
    await ctx.reply(text);
    return true;
  }

  return false;
}
