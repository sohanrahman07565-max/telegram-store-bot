import axios from 'axios';
import { Markup } from 'telegraf';
import { KEY_API_URL, KEY_API_SECRET } from './config.js';
import { startInput, stopInput, currentInput } from './input.js';

const API_BASE = KEY_API_URL.trim().replace(/\/$/, '');
const API_SECRET = KEY_API_SECRET.trim().replace(/\ufeff/g, '');

const headers = {
  'Content-Type': 'application/json',
  ...(API_SECRET ? { Authorization: `Bearer ${API_SECRET}` } : {}),
};

async function apiRequest(method, path, options = {}) {
  try {
    const res = await axios({
      method,
      url: `${API_BASE}${path}`,
      headers,
      timeout: 20000,
      ...options,
    });
    return res.data;
  } catch (err) {
    const msg = err.response?.data?.error || err.message;
    throw new Error(`API HTTP ${err.response?.status || 'ERR'}: ${msg}`);
  }
}

function formatKeyItem(item) {
  if (typeof item === 'string') return `🔑 ${item}`;
  return (
    `#${item.id || '-'}  ${String(item.status || '-').toUpperCase()}\n` +
    `🔑 ${item.key || item.api_key || item.value || '-'}\n` +
    `📦 Product: ${item.product || '-'}\n` +
    `⏳ Duration: ${item.duration || '-'}\n` +
    `⌛ Expires: ${item.expire_at || item.expires_at || '-'}`
  );
}

function menu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⚡ Generate', 'api_keys_generate'),
      Markup.button.callback('🔍 Search', 'api_keys_search'),
    ],
    [
      Markup.button.callback('📋 View', 'api_keys_view'),
      Markup.button.callback('🗑 Delete', 'api_keys_delete'),
    ],
    [
      Markup.button.callback('🚫 Revoke', 'api_keys_revoke'),
      Markup.button.callback('📊 Statistics', 'api_keys_stats'),
    ],
    [Markup.button.callback('⬅️ Back', 'admin')],
  ]);
}

export function registerApiKeyRoutes(bot) {
  bot.action('api_keys', async (ctx) => {
    try {
      const data = await apiRequest('GET', '/stats');
      const total = data.total_keys || data.total || data.count || 0;
      const active = data.active_keys || data.active || 0;
      const revoked = data.revoked_keys || data.revoked || 0;

      const text =
        '🔐 API KEY MANAGER\n\n' +
        '━━━━━━━━━━━━━━━━━━\n\n' +
        `🔑 Total API Keys : ${total}\n` +
        `🟢 Active         : ${active}\n` +
        `🔴 Revoked        : ${revoked}\n\n` +
        '━━━━━━━━━━━━━━━━━━\n\n' +
        '🟢 Connected to GH PRIME Key API';

      await ctx.editMessageText(text, menu());
    } catch (e) {
      const text =
        '🔐 API KEY MANAGER\n\n' +
        '━━━━━━━━━━━━━━━━━━\n\n' +
        '🔴 API CONNECTION FAILED\n\n' +
        `${e.message}\n\n` +
        `API: ${API_BASE}`;
      await ctx.editMessageText(text, menu());
    }
  });

  bot.action('api_keys_generate', async (ctx) => {
    startInput(ctx.from.id, 'api_keys_generate');
    await ctx.editMessageText(
      '⚡ GENERATE PRODUCT KEY\n\n' +
      'Send in this format:\n\n' +
      'Product | Duration\n\n' +
      'Example:\n' +
      'DRIP CLIENT NON-ROOT | 1day\n\n' +
      'For multiple keys, send one request per line.',
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'api_keys')]])
    );
  });

  bot.action('api_keys_search', async (ctx) => {
    startInput(ctx.from.id, 'api_keys_search');
    await ctx.editMessageText(
      '🔍 SEARCH API KEY\n\nSend API key, product name, customer ID,\nor order ID.',
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'api_keys')]])
    );
  });

  bot.action('api_keys_delete', async (ctx) => {
    startInput(ctx.from.id, 'api_keys_delete');
    await ctx.editMessageText(
      '🗑 DELETE API KEYS\n\nSend one or multiple keys.\nSeparate multiple keys with commas.',
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'api_keys')]])
    );
  });

  bot.action('api_keys_revoke', async (ctx) => {
    startInput(ctx.from.id, 'api_keys_revoke');
    await ctx.editMessageText(
      '🚫 REVOKE API KEY\n\nSend the exact product key to revoke.',
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'api_keys')]])
    );
  });

  bot.action('api_keys_view', async (ctx) => {
    try {
      const data = await apiRequest('GET', '/keys', { params: { limit: 100 } });
      const rows = data.keys || [];

      if (!rows.length) {
        return ctx.editMessageText(
          '📋 API KEYS\n\nNo keys found in the remote API.',
          Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'api_keys')]])
        );
      }

      const lines = ['📋 API KEYS', '', '━━━━━━━━━━━━━━━━━━'];
      const buttons = [];

      for (const item of rows) {
        lines.push(formatKeyItem(item), '');
        const key = item.key || item.api_key || item.value;
        if (key) {
          // Telegraf inline copy button
          buttons.push([Markup.button.callback(`📋 ${key}`, `copy_key_noop`)]);
        }
      }
      buttons.push([Markup.button.callback('⬅️ Back', 'api_keys')]);

      await ctx.editMessageText(lines.join('\n'), Markup.inlineKeyboard(buttons));
    } catch (e) {
      await ctx.editMessageText(
        `❌ Could not load API keys.\n\n${e.message}`,
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'api_keys')]])
      );
    }
  });

  bot.action('api_keys_stats', async (ctx) => {
    try {
      const data = await apiRequest('GET', '/stats');
      const text =
        '📊 API KEY STATISTICS\n\n' +
        '━━━━━━━━━━━━━━━━━━\n\n' +
        `🔑 Total : ${data.total_keys || 0}\n` +
        `🟢 Active : ${data.active_keys || 0}\n` +
        `🔴 Revoked : ${data.revoked_keys || 0}\n` +
        `⏳ Expired : ${data.expired_keys || 0}\n` +
        `⚡ Generated Today : ${data.generated_today || data.generatedToday || 0}`;

      await ctx.editMessageText(text, menu());
    } catch (e) {
      await ctx.editMessageText(`❌ Statistics unavailable.\n\n${e.message}`, menu());
    }
  });
}

// ইনপুট হ্যান্ডলার
export async function handleApiKeyInput(ctx) {
  const uid = ctx.from.id;
  const mode = currentInput(uid);
  if (!mode?.startsWith('api_keys_')) return false;

  const text = (ctx.message?.text || '').trim();
  if (!text) {
    await ctx.reply('❌ Please send text input.');
    return true;
  }

  if (mode === 'api_keys_generate') {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const created = [];
    const errors = [];

    for (const line of lines) {
      if (!line.includes('|')) {
        errors.append(`❌ Invalid format: ${line}\nUse Product | Duration`);
        continue;
      }
      const [product, duration] = line.split('|').map((s) => s.trim());
      try {
        const data = await apiRequest('POST', '/generate', { data: { product, duration } });
        const keys = data.key ? [data.key] : data.keys || [];
        if (keys.length) {
          keys.forEach((k) => created.push(`🔑 ${k}\n📦 ${product}\n⏳ ${duration}`));
        } else {
          created.push(`✅ Generated\n📦 ${product}\n⏳ ${duration}`);
        }
      } catch (e) {
        errors.push(`❌ ${product} | ${duration}\n${e.message}`);
      }
    }

    stopInput(uid);
    const parts = [];
    if (created.length) parts.push('⚡ GENERATED KEYS\n\n' + created.join('\n\n'));
    if (errors.length) parts.push('ERRORS\n\n' + errors.join('\n\n'));

    await ctx.reply(parts.join('\n\n━━━━━━━━━━━━━━━━━━\n\n'));
    return true;
  }

  if (mode === 'api_keys_search') {
    stopInput(uid);
    try {
      const data = await apiRequest('GET', '/keys', { params: { q: text, limit: 100 } });
      const rows = data.keys || [];
      if (!rows.length) {
        await ctx.reply('❌ No keys found in the remote API.');
        return true;
      }
      const lines = ['🔍 SEARCH RESULTS', '', ...rows.map(formatKeyItem)];
      await ctx.reply(lines.join('\n'));
    } catch (e) {
      await ctx.reply(`❌ Search failed.\n\n${e.message}`);
    }
    return true;
  }

  if (mode === 'api_keys_delete') {
    stopInput(uid);
    const parts = text.split(/[\n,]/).map((p) => p.trim()).filter(Boolean);
    let deleted = 0;
    let failed = 0;
    const lines = ['🗑 DELETE RESULT', ''];

    for (const k of parts) {
      try {
        await apiRequest('DELETE', `/keys/${encodeURIComponent(k)}`);
        deleted++;
        lines.push(`✅ ${k}`);
      } catch (e) {
        failed++;
        lines.push(`❌ ${k}\n${e.message}`);
      }
    }
    lines.splice(2, 0, `✅ Deleted: ${deleted}`, `❌ Failed: ${failed}`);
    await ctx.reply(lines.join('\n'));
    return true;
  }

  if (mode === 'api_keys_revoke') {
    stopInput(uid);
    try {
      const data = await apiRequest('POST', '/keys/revoke', { data: { key: text } });
      await ctx.reply(
        data.success ? '🚫 API key revoked successfully.' : `❌ API key was not revoked.\n\n${JSON.stringify(data)}`
      );
    } catch (e) {
      await ctx.reply(`❌ Revoke failed.\n\n${e.message}`);
    }
    return true;
  }

  return false;
}
