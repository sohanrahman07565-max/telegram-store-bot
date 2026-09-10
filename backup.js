import fs from 'fs';
import path from 'path';
import { createRequire } from 'module'; const require = createRequire(import.meta.url); const archiver = require('archiver');
const AdmZip = require('adm-zip');
import { Markup } from 'telegraf';
import db from './database.js';

const BACKUP_FILE = 'backup.zip';

export function registerBackup(bot) {
  bot.action('backup', async (ctx) => {
    await ctx.editMessageText(
      '📦 BACKUP PANEL\n\n━━━━━━━━━━━━━━\nSelect an option below.',
      Markup.inlineKeyboard([
        [Markup.button.callback('📥 Create Backup', 'create_backup')],
        [Markup.button.callback('♻️ Restore Backup', 'restore_backup')],
        [Markup.button.callback('⬅️ Back', 'admin')],
      ])
    );
  });

  bot.action('create_backup', async (ctx) => {
    await ctx.answerCbQuery('Creating backup...');

    const output = fs.createWriteStream(BACKUP_FILE);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
      await ctx.replyWithDocument({ source: BACKUP_FILE, filename: 'backup.zip' }, {
        caption: '✅ Full Backup Created Successfully',
      });
    });

    archive.pipe(output);

    // প্রয়োজনীয় ফাইলগুলো জিপে যুক্ত করা
    const filesToInclude = ['database.db', 'bot.db', '.env', 'package.json'];
    filesToInclude.forEach((f) => {
      if (fs.existsSync(f)) archive.file(f, { name: f });
    });

    if (fs.existsSync('./src')) {
      archive.directory('./src/', 'src');
    }

    await archive.finalize();
  });

  bot.action('restore_backup', async (ctx) => {
    if (!fs.existsSync(BACKUP_FILE)) {
      return ctx.answerCbQuery('❌ Backup File Not Found', { show_alert: true });
    }

    try {
      const zip = new AdmZip(BACKUP_FILE);
      zip.extractAllTo('./', true);
      await ctx.editMessageText(
        '♻️ BACKUP RESTORED\n\n✅ Files & Database Restored.\n⚠️ Restart the process to apply changes.',
        Markup.inlineKeyboard([[Markup.button.callback('⬅️ Back', 'backup')]])
      );
    } catch (e) {
      await ctx.answerCbQuery(`❌ Restore Failed: ${e.message}`, { show_alert: true });
    }
  });
}
