const SESSION = new Map();

export function set(userId, key, val) {
  if (!SESSION.has(userId)) {
    SESSION.set(userId, {});
  }
  SESSION.get(userId)[key] = val;
}

export function value(userId, key) {
  if (!SESSION.has(userId)) return null;
  return SESSION.get(userId)[key] ?? null;
}

export function clear(userId) {
  SESSION.delete(userId);
}
