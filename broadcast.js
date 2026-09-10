import { Markup } from 'telegraf';
import db from './database.js';
import { startInput, stopInput } from './input.js';

let BROADCAST_RUNNING = false;
let BROADCAST_STOP = false;
const broadcastDrafts = new Map();

function getMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📝 Text', 'bc_text'), Markup.button.callback('🖼 Photo', 'bc_photo')],
    [Markup.button.callback('🎥 Video', 'bc_video'), Markup.button.callback('🎞 Animation', 'bc_animation')],
    [Markup.button.callback('🎵 Audio', 'bc_audio'), Markup.button.callback('🎤 Voice', 'bc_voice')],
    [Markup.button.callback('📄 Document', 'bc_document')],
    [Markup.button.callback('📜 History', 'bc_history')],
    [Markup.button.callback('⬅️ Back', 'admin')],
  ]);
}

export function registerBroadcast(bot) {
  // নিশ্চিত করুন History টেবিল আছে
  db.exec(`
    CREATE TABLE IF NOT EXISTS broadcast_history(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      media_type TEXT,
      content TEXT,
      caption TEXT,
      total INTEGER DEFAULT 0,
      processed INTEGER DEFAULT 0,
      success INTEGER DEFAULT 0,
      failed INTEGER DEFAULT 0,
      stopped INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  bot.action('broadcast', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageText('📢 BROADCAST PANEL\n\n━━━━━━━━━━━━━━\n\nSelect Message Type', getMenu());
  });

  const types = ['text', 'photo', 'video', 'document', 'audio', 'voice', 'animation'];

  types.forEach((type) => {
    bot.action(`bc_${type}`, async (ctx) => {
      const uid = ctx.from.id;
      startInput(uid, `broadcast_${type}`);
      broadcastDrafts.set(uid, { panelChat: ctx.chat.id, panelMsg: ctx.callbackQuery.message.message_id });

      await ctx.editMessageText(
        `📝 ${type.toUpperCase()} BROADCAST\n\n━━━━━━━━━━━━━━\n\nSend the ${type} to broadcast.`,
        Markup.inlineKeyboard([[Markup.button.callback('❌ Cancel', 'broadcast')]])
      );
    });

    bot.action(`bc_confirm_${type}`, async (ctx) => {
      await runBroadcastEngine(bot, ctx, type);
    });

    bot.action(`bc_delete_${type}`, async (ctx) => {
      broadcastDrafts.delete(ctx.from.id);
      await ctx.editMessageText('🗑 Draft deleted.', getMenu());
    });
  });

  bot.action('bc_stop', async (ctx) => {
    if (!BROADCAST_RUNNING) return ctx.answerCbQuery('No broadcast running.');
    BROADCAST_STOP = true;
    await ctx.answerCbQuery('🛑 Stopping broadcast...');
  });

  bot.action('bc_history', async (ctx) => {
    const rows = db.prepare('SELECT * FROM broadcast_history ORDER BY id DESC LIMIT 10').all();
    if (!rows.length) {
      return ctx.editMessageText(
        '📜 BROADCAST HISTORY\n\nNo history found.',
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'broadcast')]])
      );
    }

    let text = '📜 BROADCAST HISTORY\n\n━━━━━━━━━━━━━━\n\n';
    const buttons = rows.map((r) => {
      text += `${r.stopped ? '🛑' : '✅'} #${r.id} ${r.media_type.toUpperCase()} - ${r.success}/${r.total}\n`;
      return [Markup.button.callback(`#${r.id} ${r.media_type.toUpperCase()}`, `bc_hist_${r.id}`)];
    });
    buttons.push([Markup.button.callback('⬅️ Back', 'broadcast')]);

    await ctx.editMessageText(text, Markup.inlineKeyboard(buttons));
  });
}

// মিডিয়া ইনপুট রিসিভার
export async function handleBroadcastMedia(ctx) {
  const uid = ctx.from.id;
  const draft = broadcastDrafts.get(uid);
  if (!draft) return false;

  const msg = ctx.message;
  let mediaType = null;
  let fileId = null;
  const text = msg.text || '';
  const caption = msg.caption || '';

  if (msg.photo) { mediaType = 'photo'; fileId = msg.photo[msg.photo.length - 1].file_id; }
  else if (msg.video) { mediaType = 'video'; fileId = msg.video.file_id; }
  else if (msg.document) { mediaType = 'document'; fileId = msg.document.file_id; }
  else if (msg.audio) { mediaType = 'audio'; fileId = msg.audio.file_id; }
  else if (msg.voice) { mediaType = 'voice'; fileId = msg.voice.file_id; }
  else if (msg.animation) { mediaType = 'animation'; fileId = msg.animation.file_id; }
  else if (msg.text) { mediaType = 'text'; }

  if (!mediaType) return false;

  // ডিলিট এডমিন সেন্ট মেসেজ
  try { await ctx.deleteMessage(); } catch (e) {}
  stopInput(uid);

  draft.mediaType = mediaType;
  draft.fileId = fileId;
  draft.text = text;
  draft.caption = caption;

  const preview = `👀 BROADCAST PREVIEW (${mediaType.toUpperCase()})\n\n${text || caption || 'No Text'}\n\nReady to send?`;
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🗑 Delete', `bc_delete_${mediaType}`)],
    [Markup.button.callback('📤 Send Broadcast', `bc_confirm_${mediaType}`)],
    [Markup.button.callback('❌ Cancel', 'broadcast')],
  ]);

  try {
    await ctx.telegram.editMessageText(draft.panelChat, draft.panelMsg, null, preview, keyboard);
  } catch (e) {
    await ctx.reply(preview, keyboard);
  }
  return true;
}

// ব্রডকাস্ট এক্সেকিউশন
async function runBroadcastEngine(bot, ctx, mediaType) {
  if (BROADCAST_RUNNING) return ctx.answerCbQuery('Broadcast is already running.', { show_alert: true });

  const uid = ctx.from.id;
  const draft = broadcastDrafts.get(uid);
  if (!draft) return ctx.answerCbQuery('Draft expired.', { show_alert: true });

  BROADCAST_RUNNING = true;
  BROADCAST_STOP = false;

  const users = db.prepare('SELECT id FROM users').all();
  const total = users.length;
  let success = 0;
  let failed = 0;

  await ctx.editMessageText(`⏳ BROADCAST STARTING\nTotal Users: ${total}`);

  for (let i = 0; i < total; i++) {
    if (BROADCAST_STOP) break;
    const targetId = users[i].id;

    try {
      if (mediaType === 'text') await bot.telegram.sendMessage(targetId, draft.text);
      else if (mediaType === 'photo') await bot.telegram.sendPhoto(targetId, draft.fileId, { caption: draft.caption });
      else if (mediaType === 'video') await bot.telegram.sendVideo(targetId, draft.fileId, { caption: draft.caption });
      else if (mediaType === 'document') await bot.telegram.sendDocument(targetId, draft.fileId, { caption: draft.caption });
      else if (mediaType === 'audio') await bot.telegram.sendAudio(targetId, draft.fileId, { caption: draft.caption });
      else if (mediaType === 'voice') await bot.telegram.sendVoice(targetId, draft.fileId, { caption: draft.caption });
      else if (mediaType === 'animation') await bot.telegram.sendAnimation(targetId, draft.fileId, { caption: draft.caption });
      success++;
    } catch (e) {
      failed++;
    }

    if (i % 20 === 0) {
      try {
        await ctx.editMessageText(
          `📤 BROADCASTING...\nProgress: ${i}/${total}\n✅ ${success} | ❌ ${failed}`,
          Markup.inlineKeyboard([[Markup.button.callback('🛑 Stop', 'bc_stop')]])
        );
      } catch (e) {}
    }
  }

  const stopped = BROADCAST_STOP;
  BROADCAST_RUNNING = false;
  BROADCAST_STOP = false;

  db.prepare(`
    INSERT INTO broadcast_history (admin_id, media_type, content, caption, total, processed, success, failed, stopped)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid, mediaType, draft.text || draft.fileId, draft.caption, total, success + failed, success, failed, stopped ? 1 : 0);

  await ctx.reply(`Broadcast finished!\n✅ Success: ${success}\n❌ Failed: ${failed}`);
}
