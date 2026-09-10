export const ROUTES = new Map();

export function route(name) {
  return function (handler) {
    ROUTES.set(name, handler);
    return handler;
  };
}

export async function openPage(ctx, data) {
  if (ROUTES.has(data)) {
    console.log('EXACT:', data);
    await ROUTES.get(data)(ctx);
    return true;
  }

  const prefixes = Array.from(ROUTES.keys()).sort((a, b) => b.length - a.length);

  for (const prefix of prefixes) {
    if (data.startsWith(`${prefix}_`)) {
      console.log('MATCH:', prefix);
      await ROUTES.get(prefix)(ctx);
      return true;
    }

    if (prefix.endsWith('_') && data.startsWith(prefix)) {
      console.log('MATCH:', prefix);
      await ROUTES.get(prefix)(ctx);
      return true;
    }
  }

  console.log('NO ROUTE:', data);
  return false;
}
