import { Markup } from 'telegraf';
import db from '../database.js';
import { clear, create, set } from './session.js';
import { methods, method, pendingPayment } from './service.js';
import { methodsKeyboard, methodPage } from './keyboard.js';

export function registerMenuRoutes(bot) {
  bot.action('add_balance', async (ctx) => {
    const uid = ctx.from.id;

    if (pendingPayment(uid)) {
      return ctx.answerCbQuery('⚠️ You already have a pending payment.', { show_alert: true });
    }

    create(uid);
    const rows = methods();

    if (!rows || rows.length === 0) {
      return ctx.editMessageText('❌ No Payment Method Available\n\nPlease contact admin.');
    }

    await ctx.editMessageText(
      '💳 ADD BALANCE\n\n' +
      '━━━━━━━━━━━━━━\n\n' +
      '💰 Select Payment Method\n\n' +
      'Choose one of the payment methods below.\n\n' +
      '━━━━━━━━━━━━━━',
      methodsKeyboard(rows)
    );
  });

  bot.action(/^paymethod_(\d+)$/, async (ctx) => {
    const uid = ctx.from.id;
    const mid = parseInt(ctx.match[1], 10);
    const row = method(mid);

    if (!row) {
      return ctx.answerCbQuery('Payment Method Not Found', { show_alert: true });
    }

    set(uid, 'method', row.name);
    set(uid, 'number', row.number);

    await ctx.editMessageText(
      `💳 PAYMENT\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `Method :\n${row.name}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `Number :\n\n\`${row.number}\`\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `📋 Copy the number above,\ncomplete your payment,\nthen press Continue.`,
      {
        parse_mode: 'Markdown',
        ...methodPage(mid, row.number),
      }
    );
  });

  bot.action('payment_cancel', async (ctx) => {
    const uid = ctx.from.id;
    clear(uid);
    const { stopInput } = await import('../input.js');
    stopInput(uid);

    return bot.handleUpdate({
      ...ctx.update,
      callback_query: { ...ctx.callbackQuery, data: 'home' }
    });
  });

  bot.action('rules', async (ctx) => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'rules'").get();
    const text = row ? row.value : '❌ Rules not set.';

    await ctx.editMessageText(
      `📜 RULES\n\n━━━━━━━━━━━━━━\n\n${text}`,
      Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'home')]])
    );
  });
}
