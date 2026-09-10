import { Markup } from 'telegraf';

const _lastRequest = new Map();
export const AUTO_DELETE = 5; // Default auto delete delay

export async function send(ctx, text, keyboard = null, extra = {}) {
  const options = {
    ...extra,
    ...(keyboard ? keyboard : {})
  };

  if (ctx.callbackQuery) {
    return await ctx.editMessageText(text, options);
  }
  return await ctx.reply(text, options);
}

export async function edit(ctx, text, keyboard = null, extra = {}) {
  try {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const options = {
      ...extra,
      ...(keyboard ? keyboard : {})
    };
    return await ctx.editMessageText(text, options);
  } catch (err) {
    if (err.description && err.description.includes('message is not modified')) {
      return;
    }
    throw err;
  }
}

export async function answer(ctx, text = null, alert = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await ctx.answerCbQuery(text, { show_alert: alert });
    } catch (err) {
      if (attempt === 2) {
        console.error('⚠️ Callback answer network error:', err);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * (1 + attempt)));
    }
  }
}

export async function deleteMsg(telegram, chatId, messageId) {
  try {
    await telegram.deleteMessage(chatId, messageId);
  } catch (e) {}
}

export async function autoDelete(telegram, chatId, messageId, delay = AUTO_DELETE) {
  await new Promise((resolve) => setTimeout(resolve, delay * 1000));
  try {
    await telegram.deleteMessage(chatId, messageId);
  } catch (e) {}
}

export async function sendAuto(ctx, text, keyboard = null, extra = {}, delay = AUTO_DELETE) {
  const options = {
    ...extra,
    ...(keyboard ? keyboard : {})
  };

  const msg = ctx.callbackQuery
    ? await ctx.callbackQuery.message.reply(text, options)
    : await ctx.reply(text, options);

  autoDelete(ctx.telegram, msg.chat.id, msg.message_id, delay);
  return msg;
}

export function backButton(page) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Back', page)]
  ]);
}

export function flood(userId, delay = 1) {
  const now = Date.now() / 1000;
  const last = _lastRequest.get(userId) || 0;
  if (now - last < delay) {
    return true;
  }
  _lastRequest.set(userId, now);
  return false;
}

export function* chunk(data, size) {
  for (let i = 0; i < data.length; i += size) {
    yield data.slice(i, i + size);
  }
}

export async function safeDelete(ctx) {
  try {
    await ctx.deleteMessage();
  } catch (e) {}
}
