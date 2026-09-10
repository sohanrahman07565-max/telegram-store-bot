import { Markup } from 'telegraf';

export function methodsKeyboard(rows) {
  const keyboard = rows.map((row) => [
    Markup.button.callback(`💳 ${row.name}`, `paymethod_${row.id}`)
  ]);

  keyboard.push([
    Markup.button.callback('❌ Cancel', 'payment_cancel')
  ]);

  return Markup.inlineKeyboard(keyboard);
}

export function continueMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➡️ Continue', 'payment_continue')],
    [
      Markup.button.callback('⬅️ Back', 'add_balance'),
      Markup.button.callback('❌ Cancel', 'payment_cancel')
    ]
  ]);
}

export function backCancel(back) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('⬅️ Back', back),
      Markup.button.callback('❌ Cancel', 'payment_cancel')
    ]
  ]);
}

export function confirm() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ Submit', 'payment_submit')],
    [
      Markup.button.callback('⬅️ Back', 'payment_back'),
      Markup.button.callback('❌ Cancel', 'payment_cancel')
    ]
  ]);
}

export function approve(pid) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Approve', `approve_${pid}`),
      Markup.button.callback('❌ Reject', `reject_${pid}`)
    ],
    [Markup.button.callback('⬅️ Back', 'payments')]
  ]);
}

export function methodPage(mid, number = null) {
  const keyboard = [];

  if (number) {
    keyboard.push([
      { text: "📋 Copy Number", copy_text: { text: String(number) } }
    ]);
  }

  keyboard.push([
    Markup.button.callback('➡️ Continue', 'payment_continue')
  ]);

  keyboard.push([
    Markup.button.callback('⬅️ Back', 'add_balance'),
    Markup.button.callback('❌ Cancel', 'payment_cancel')
  ]);

  return Markup.inlineKeyboard(keyboard);
}

export function home() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🏠 Home', 'home')]
  ]);
}

export function adminBack() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⬅️ Back', 'admin')]
  ]);
}
