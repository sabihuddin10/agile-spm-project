/**
 * Test harness: boots the API on a random port. `node --test` runs each test
 * file in its own process, so every file gets a fresh seeded in-memory store.
 */
import { createApp } from '../src/app.js';

export async function startServer() {
  const server = createApp({ logging: false }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function call(method, path, { token, body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  async function login(who, password = 'password') {
    const email = who.includes('@') ? who : `${who}@rest.test`;
    const res = await call('POST', '/auth/login', { body: { email, password } });
    if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status}`);
    return res.body.token;
  }

  async function close() {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }

  return { base, call, login, close };
}

/** First menu item with the given name, from the public menu. */
export async function menuItem(call, name) {
  const { body } = await call('GET', '/menu');
  return body.menu.flatMap((c) => c.items).find((i) => i.name === name);
}

export async function tableByNumber(call, token, number) {
  const { body } = await call('GET', '/tables', { token });
  return body.tables.find((t) => t.number === number);
}

const pad = (n) => String(n).padStart(2, '0');
export const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const localTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
