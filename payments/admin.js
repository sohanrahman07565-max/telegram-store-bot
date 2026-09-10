import { Markup } from 'telegraf';
import db from '../database.js';
import { startInput, stopInput } from '../input.js';
import { set, value, setMessage, message } from './session.js';
import {
  pending,
  payment,
  approve as approveService,
  reject as rejectService,
  addBalance,
  addMethod,
  allMethods,
  methodById,
  deleteMethod,
  setMethodStatus,
  updateMethodName,
  updateMethodNumber
} from './service.js';
import { adminBack } from './keyboard.js';

export function registerPaymentsAdminRoutes(bot) {
  bot.action('payments', async (ctx) => {
    const rows = pending();

    if (!rows || rows.length === 0) {
      return ctx.editMessageText('📭 NO PENDING PAYMENTS', adminBack());
    }

    const keyboard = rows.map((row) => [
      Markup.button.callback(`💳 #${row.id} • ${row.amount} Tk`, `pay_${row.id}`)
    ]);

    keyboard.push([Markup.button.callback('⬅️ Back', 'admin')]);

    await ctx.editMessageText(
      '💳 PENDING PAYMENTS\n\n━━━━━━━━━━━━━━\n\nSelect a payment request.',
      Markup.inlineKeyboard(keyboard)
    );
  });

  bot.action(/^pay_(\d+)$/, async (ctx) => {
    const pid = parseInt(ctx.match[1], 10);
    const row = payment(pid);

    if (!row) {
      return ctx.editMessageText('❌ Payment Not Found.');
    }

    const text =
      `💳 PAYMENT DETAILS\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `🆔 ID\n#${row.id}\n\n` +
      `👤 User\n${row.user}\n\n` +
      `💳 Method\n${row.method}\n\n` +
      `💰 Amount\n${row.amount} Tk\n\n` +
      `🧾 TRX ID\n${row.trxid}\n\n` +
      `📊 Status\n${row.status}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `Choose an action below.`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🖼 Screenshot', `photo_${pid}`)],
      [
        Markup.button.callback('✅ Approve', `approve_${pid}`),
        Markup.button.callback('❌ Reject', `reject_${pid}`)
      ],
      [Markup.button.callback('⬅️ Back', 'payments')]
    ]);

    await ctx.editMessageText(text, keyboard);
  });

  bot.action(/^photo_(\d+)$/, async (ctx) => {
    const pid = parseInt(ctx.match[1], 10);
    const row = payment(pid);

    if (!row) {
      return ctx.answerCbQuery('Payment Not Found', { show_alert: true });
    }

    await ctx.replyWithPhoto(row.screenshot, {
      caption:
        `🖼 Payment Screenshot\n\n` +
        `━━━━━━━━━━━━━━\n\n` +
        `Payment ID : #${pid}\n` +
        `User : ${row.user}\n` +
        `Amount : ${row.amount} Tk`
    });

    await ctx.answerCbQuery();
  });

  bot.action(/^approve_(\d+)$/, async (ctx) => {
    const pid = parseInt(ctx.match[1], 10);
    const row = payment(pid);
    if (!row) return;

    approveService(pid);
    addBalance(row.user, row.amount);

    try {
      const { addLog } = await import('../logs.js');
      addLog({ admin_id: ctx.from.id, action: 'Approve Payment', details: `Payment #${pid}` });
    } catch (e) {}

    try {
      await ctx.telegram.sendMessage(
        row.user,
        `✅ Payment Approved\n\n━━━━━━━━━━━━━━\n\nAmount Added :\n${row.amount} Tk\n\nThank you.`
      );
    } catch (e) {}

    await ctx.editMessageText(
      '✅ Payment Approved Successfully.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('⬅️ Back', 'payments'),
          Markup.button.callback('🏠 Admin', 'admin')
        ]
      ])
    );
  });

  bot.action(/^reject_(\d+)$/, async (ctx) => {
    const pid = parseInt(ctx.match[1], 10);
    const row = payment(pid);
    if (!row) return;

    rejectService(pid);

    try {
      const { addLog } = await import('../logs.js');
      addLog({ admin_id: ctx.from.id, action: 'Reject Payment', details: `Payment #${pid}` });
    } catch (e) {}

    try {
      await ctx.telegram.sendMessage(
        row.user,
        '❌ Payment Rejected\n\nPlease contact support if you think this is a mistake.'
      );
    } catch (e) {}

    await ctx.editMessageText(
      '❌ Payment Rejected.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('⬅️ Back', 'payments'),
          Markup.button.callback('🏠 Admin', 'admin')
        ]
      ])
    );
  });

  bot.action('add_method', async (ctx) => {
    startInput(ctx.from.id, 'method_name');
    await ctx.editMessageText('➕ ADD PAYMENT METHOD\n\n━━━━━━━━━━━━━━\n\n📝 Enter Method Name\n\nExample: bKash');
  });

  bot.action('manage_methods', async (ctx) => {
    const rows = allMethods();
    const keyboard = rows.map((row) => [
      Markup.button.callback(`${row.status ? '🟢' : '🔴'} ${row.name}`, `method_${row.id}`)
    ]);

    keyboard.push([Markup.button.callback('⬅️ Back', 'settings')]);

    await ctx.editMessageText(
      '📋 PAYMENT METHODS\n\n━━━━━━━━━━━━━━\n\nSelect a method to manage.',
      Markup.inlineKeyboard(keyboard)
    );
  });

  bot.action(/^method_(\d+)$/, async (ctx) => {
    const mid = parseInt(ctx.match[1], 10);
    const row = methodById(mid);

    if (!row) {
      return ctx.answerCbQuery('Method Not Found', { show_alert: true });
    }

    const status = row.status ? '🟢 Enabled' : '🔴 Disabled';

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✏️ Edit Name', `edit_method_name_${mid}`)],
      [Markup.button.callback('📱 Edit Number', `edit_method_number_${mid}`)],
      [Markup.button.callback(row.status ? '🔴 Disable' : '🟢 Enable', `toggle_method_${mid}`)],
      [Markup.button.callback('🗑 Delete', `delete_method_${mid}`)],
      [Markup.button.callback('⬅️ Back', 'manage_methods')]
    ]);

    await ctx.editMessageText(
      `💳 PAYMENT METHOD\n\n━━━━━━━━━━━━━━\n\nName\n➜ ${row.name}\n\nNumber\n➜ \`${row.number}\`\n\nStatus\n➜ ${status}`,
      {
        parse_mode: 'Markdown',
        ...keyboard
      }
    );
  });

  bot.action(/^delete_method_(\d+)$/, async (ctx) => {
    const mid = parseInt(ctx.match[1], 10);
    deleteMethod(mid);
    await ctx.answerCbQuery('✅ Method Deleted');

    return bot.handleUpdate({
      ...ctx.update,
      callback_query: { ...ctx.callbackQuery, data: 'manage_methods' }
    });
  });

  bot.action(/^toggle_method_(\d+)$/, async (ctx) => {
    const mid = parseInt(ctx.match[1], 10);
    const row = methodById(mid);

    if (!row) {
      return ctx.answerCbQuery('Method Not Found', { show_alert: true });
    }

    setMethodStatus(mid, row.status ? 0 : 1);
    await ctx.answerCbQuery('✅ Updated');

    return bot.handleUpdate({
      ...ctx.update,
      callback_query: { ...ctx.callbackQuery, data: `method_${mid}` }
    });
  });

  bot.action(/^edit_method_name_(\d+)$/, async (ctx) => {
    const mid = parseInt(ctx.match[1], 10);
    set(ctx.from.id, 'edit_method_id', mid);
    startInput(ctx.from.id, 'edit_method_name');

    const msg = await ctx.editMessageText(
      '✏️ EDIT METHOD NAME\n\n━━━━━━━━━━━━━━\n\nSend New Method Name.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('⬅️ Back', `method_${mid}`),
          Markup.button.callback('🏠 Admin Panel', 'admin')
        ]
      ])
    );

    if (msg) setMessage(ctx.from.id, msg.message_id);
  });

  bot.action(/^edit_method_number_(\d+)$/, async (ctx) => {
    const mid = parseInt(ctx.match[1], 10);
    set(ctx.from.id, 'edit_method_id', mid);
    startInput(ctx.from.id, 'edit_method_number');

    const msg = await ctx.editMessageText(
      '📱 EDIT PAYMENT NUMBER\n\n━━━━━━━━━━━━━━\n\nSend New Number.',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('⬅️ Back', `method_${mid}`),
          Markup.button.callback('🏠 Admin Panel', 'admin')
        ]
      ])
    );

    if (msg) setMessage(ctx.from.id, msg.message_id);
  });
}

export async function handleMethodAdminInput(ctx, mode) {
  const uid = ctx.from.id;
  const text = ctx.message?.text?.trim() || '';

  if (mode === 'method_name') {
    if (!text) {
      await ctx.reply('❌ Invalid Method Name.');
      return true;
    }

    set(uid, 'new_method_name', text);
    stopInput(uid);
    startInput(uid, 'method_number');

    await ctx.reply('📱 ENTER PAYMENT NUMBER\n\n━━━━━━━━━━━━━━\n\n');
    return true;
  }

  if (mode === 'method_number') {
    if (!text) {
      await ctx.reply('❌ Invalid Number.');
      return true;
    }

    const name = value(uid, 'new_method_name');
    addMethod(name, text);
    stopInput(uid);

    await ctx.reply(
      `✅ PAYMENT METHOD ADDED\n\n━━━━━━━━━━━━━━\n\n💳 Name\n➜ ${name}\n\n📱 Number\n➜ ${text}\n\n━━━━━━━━━━━━━━\n\nSuccessfully Added.`
    );
    return true;
  }

  if (mode === 'edit_method_name') {
    const mid = value(uid, 'edit_method_id');
    const row = methodById(mid);
    if (!row) return true;

    updateMethodName(mid, text);
    stopInput(uid);

    try { await ctx.deleteMessage(); } catch (e) {}

    const msgId = message(uid);
    if (msgId) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msgId,
        null,
        `✅ METHOD NAME UPDATED\n\n━━━━━━━━━━━━━━\n\n💳 Old Name\n➜ ${row.name}\n\n🆕 New Name\n➜ ${text}\n\n━━━━━━━━━━━━━━\n\n✅ Updated Successfully.`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('⬅️ Back', `method_${mid}`),
            Markup.button.callback('🏠 Admin Panel', 'admin')
          ]
        ])
      );
    }
    return true;
  }

  if (mode === 'edit_method_number') {
    const mid = value(uid, 'edit_method_id');
    const row = methodById(mid);
    if (!row) return true;

    updateMethodNumber(mid, text);
    stopInput(uid);

    try { await ctx.deleteMessage(); } catch (e) {}

    const msgId = message(uid);
    if (msgId) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msgId,
        null,
        `✅ PAYMENT NUMBER UPDATED\n\n━━━━━━━━━━━━━━\n\n📞 Old Number\n➜ ${row.number}\n\n📱 New Number\n➜ ${text}\n\n━━━━━━━━━━━━━━\n\n✅ Updated Successfully.`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('⬅️ Back', `method_${mid}`),
            Markup.button.callback('🏠 Admin Panel', 'admin')
          ]
        ])
      );
    }
    return true;
  }

  return false;
}
