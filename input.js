const USER_INPUT_STATE = new Map();

export function startInput(userId, stateName) {
  USER_INPUT_STATE.set(userId, stateName);
}

export function stopInput(userId) {
  USER_INPUT_STATE.delete(userId);
}

export function currentInput(userId) {
  return USER_INPUT_STATE.get(userId) || null;
}
