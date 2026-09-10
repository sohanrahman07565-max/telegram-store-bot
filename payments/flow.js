import { Markup } from 'telegraf';
import { OWNER_ID } from '../config.js';
import { startInput, stopInput } from '../input.js';
import { set, value, clear, setMessage, message, expired } from './session.js';
import { backCancel, confirm, home } from './keyboard.js';
import { trxExists, createPayment } from './service.js';

export function registerFlowRoutes(bot) {
  bot.action('payment_continue', async (ctx) => {
    const uid = ctx.from.id;
    startInput(uid, 'payment_amount');

    const msg = await ctx.editMessageText(
      '💳 ADD BALANCE\n\n━━━━━━━━━━━━━━\n\n💰 Enter Payment Amount\n',
      backCancel('add_balance')
    );

    if (msg) {
      setMessage(uid, msg.message_id);
    }
  });

  bot.action('payment_submit', async (ctx) => {
    const uid = ctx.from.id;

    const userMethod = value(uid, 'method');
    const userAmount = value(uid, 'amount');
    const userTrx = value(uid, 'trx');
    const userPhoto = value(uid, 'photo');

    const pid = createPayment(uid, userMethod, userAmount, userTrx, userPhoto);

    clear(uid);

    try {
      await ctx.telegram.sendPhoto(OWNER_ID, userPhoto, {
        caption:
          `🔔 NEW PAYMENT REQUEST\n\n` +
          `━━━━━━━━━━━━━━\n\n` +
          `🆔 ID : #${pid}\n\n` +
          `👤 User : ${uid}\n\n` +
          `💳 Method : ${userMethod}\n\n` +
          `💰 Amount : ${userAmount} Tk\n\n` +
          `🧾 TRX ID :\n\n${userTrx}\n\n` +
          `━━━━━━━━━━━━━━\n\n` +
          `Open Admin → Payments\nto Approve or Reject.`
      });
    } catch (e) {
      console.error(e);
    }

    await ctx.editMessageText(
      `✅ PAYMENT SUBMITTED\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `🆔 Request ID\n\n#${pid}\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `Your payment request has been sent successfully.\n\n` +
      `⏳ Please wait for admin approval.`,
      home()
    );
  });

  bot.action('payment_back', async (ctx) => {
    const uid = ctx.from.id;
    const step = value(uid, 'step');

    if (step === 'trx') {
      return bot.handleUpdate({
        ...ctx.update,
        callback_query: { ...ctx.callbackQuery, data: 'payment_continue' }
      });
    }

    if (step === 'photo') {
      startInput(uid, 'payment_trx');
      return ctx.editMessageText('🧾 ENTER TRX ID', backCancel('payment_continue'));
    }

    if (expired(uid)) {
      clear(uid);
      return ctx.reply('⌛ Payment session expired.');
    }
  });
}

export async function handlePaymentFlowInput(ctx, mode) {
  const uid = ctx.from.id;

  if (mode === 'payment_amount') {
    const amount = parseInt(ctx.message?.text?.trim(), 10);

    if (isNaN(amount) || amount <= 0) {
      try { await ctx.deleteMessage(); } catch (e) {}
      return true;
    }

    try { await ctx.deleteMessage(); } catch (e) {}

    set(uid, 'amount', amount);
    set(uid, 'step', 'trx');
    stopInput(uid);
    startInput(uid, 'payment_trx');

    const msgId = message(uid);
    if (msgId) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msgId,
        null,
        '🧾 ENTER TRANSACTION ID\n\n━━━━━━━━━━━━━━\n\nSend your TRX ID.\n',
        backCancel('payment_continue')
      );
    }
    return true;
  }

  if (mode === 'payment_trx') {
    const trx = (ctx.message?.text?.trim() || '').toUpperCase();

    if (trx.length < 6 || trxExists(trx)) {
      try { await ctx.deleteMessage(); } catch (e) {}
      return true;
    }

    try { await ctx.deleteMessage(); } catch (e) {}

    set(uid, 'trx', trx);
    set(uid, 'step', 'photo');
    stopInput(uid);
    startInput(uid, 'payment_photo');

    const msgId = message(uid);
    if (msgId) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        msgId,
        null,
        '📸 UPLOAD PAYMENT SCREENSHOT\n\n━━━━━━━━━━━━━━\n\nSend your payment screenshot.\n\nAccepted:\n• payment screenshot',
        backCancel('payment_continue')
      );
    }
    return true;
  }

  if (mode === 'payment_photo') {
    if (!ctx.message?.photo) {
      await ctx.reply('❌ Please send a payment screenshot.');
      return true;
    }

    const photo = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    set(uid, 'photo', photo);
    stopInput(uid);

    const text =
      `✅ PAYMENT CONFIRMATION\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `💳 Method\n➜ ${value(uid, 'method')}\n\n` +
      `💰 Amount\n➜ ${value(uid, 'amount')} Tk\n\n` +
      `🧾 TRX ID\n➜ \`${value(uid, 'trx')}\`\n\n` +
      `📸 Screenshot\n➜ Received ✅\n\n` +
      `━━━━━━━━━━━━━━\n\n` +
      `Please verify all information.\n\nPress Submit to send your payment request.`;

    try { await ctx.deleteMessage(); } catch (e) {}

    const msgId = message(uid);
    if (msgId) {
      await ctx.telegram.editMessageText(ctx.chat.id, msgId, null, text, {
        parse_mode: 'Markdown',
        ...confirm()
      });
    }
    return true;
  }

  return false;
}
