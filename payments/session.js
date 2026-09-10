const SESSION = new Map();

export function create(userId) {
  SESSION.set(userId, {
    step: 'method',
    message_id: null,
    method: null,
    number: null,
    amount: null,
    trx: null,
    photo: null,
    time: Date.now(),
  });
}

export function exists(userId) {
  return SESSION.has(userId);
}

export function get(userId) {
  return SESSION.get(userId) || null;
}

export function set(userId, key, value) {
  if (!SESSION.has(userId)) {
    create(userId);
  }
  SESSION.get(userId)[key] = value;
}

export function value(userId, key) {
  if (!SESSION.has(userId)) return null;
  return SESSION.get(userId)[key] ?? null;
}

export function clear(userId) {
  SESSION.delete(userId);
}

export function expired(userId) {
  if (!SESSION.has(userId)) return true;
  return (Date.now() - SESSION.get(userId).time) > 600000; // 10 মিনিট
}

export function setMessage(userId, messageId) {
  if (!SESSION.has(userId)) create(userId);
  SESSION.get(userId).message_id = messageId;
}

export function message(userId) {
  if (!SESSION.has(userId)) return null;
  return SESSION.get(userId).message_id;
}
