import dotenv from 'dotenv';
dotenv.config();

export const BOT_NAME = process.env.BOT_NAME || 'GH PRIME STORE';
export const TOKEN = process.env.BOT_TOKEN;
export const OWNER_ID = parseInt(process.env.OWNER_ID || '0', 10);
export const KEY_API_URL = process.env.KEY_API_URL || '';
export const KEY_API_SECRET = process.env.KEY_API_SECRET || '';
