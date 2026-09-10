import db from '../database.js';

export function methods() {
  return db.prepare(`
    SELECT *
    FROM payment_methods
    WHERE status = 1
    ORDER BY id
  `).all();
}

export function method(mid) {
  return db.prepare(`
    SELECT *
    FROM payment_methods
    WHERE id = ?
  `).get(mid);
}

export function trxExists(trx) {
  const row = db.prepare(`
    SELECT id
    FROM payments
    WHERE trxid = ?
  `).get(trx);
  return !!row;
}

export function createPayment(user, method, amount, trxid, screenshot) {
  const info = db.prepare(`
    INSERT INTO payments (
      user,
      method,
      amount,
      trxid,
      screenshot,
      status,
      date
    )
    VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).run(user, method, amount, trxid, screenshot);

  return info.lastInsertRowid;
}

export function pending() {
  return db.prepare(`
    SELECT *
    FROM payments
    WHERE status = 'pending'
    ORDER BY id DESC
  `).all();
}

export function payment(pid) {
  return db.prepare(`
    SELECT *
    FROM payments
    WHERE id = ?
  `).get(pid);
}

export function approve(pid) {
  db.prepare("UPDATE payments SET status = 'approved' WHERE id = ?").run(pid);
}

export function reject(pid) {
  db.prepare("UPDATE payments SET status = 'rejected' WHERE id = ?").run(pid);
}

export function addBalance(userId, amount) {
  db.prepare(`
    UPDATE users
    SET balance = balance + ?
    WHERE id = ?
  `).run(amount, userId);
}

export function pendingPayment(user) {
  return db.prepare(`
    SELECT id
    FROM payments
    WHERE user = ?
    AND status = 'pending'
  `).get(user);
}

export function addMethod(name, number) {
  const info = db.prepare(`
    INSERT INTO payment_methods (
      name,
      number,
      status
    )
    VALUES (?, ?, 1)
  `).run(name, number);

  return info.lastInsertRowid;
}

export function allMethods() {
  return db.prepare(`
    SELECT *
    FROM payment_methods
    ORDER BY id
  `).all();
}

export function methodById(mid) {
  return db.prepare(`
    SELECT *
    FROM payment_methods
    WHERE id = ?
  `).get(mid);
}

export function deleteMethod(mid) {
  db.prepare('DELETE FROM payment_methods WHERE id = ?').run(mid);
}

export function setMethodStatus(mid, status) {
  db.prepare(`
    UPDATE payment_methods
    SET status = ?
    WHERE id = ?
  `).run(status, mid);
}

export function updateMethodName(mid, name) {
  db.prepare(`
    UPDATE payment_methods
    SET name = ?
    WHERE id = ?
  `).run(name, mid);
}

export function updateMethodNumber(mid, number) {
  db.prepare(`
    UPDATE payment_methods
    SET number = ?
    WHERE id = ?
  `).run(number, mid);
}
