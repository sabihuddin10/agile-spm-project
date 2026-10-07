/** Analytics module — routes/analytics.js (US10.1–US10.6). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, localDate } from '../helpers.js';

let api;
let manager;
before(async () => {
  api = await startServer();
  manager = await api.login('manager');
});
after(() => api.close());

const inDays = (n) => localDate(new Date(Date.now() + n * 86400000));

test('US10.1 revenue and order trends follow the selected period', async () => {
  // Act
  const daily = (await api.call('GET', '/analytics/dashboard?granularity=day', { token: manager })).body;

  // Assert
  assert.equal(daily.trend.length, 30);
  assert.ok(daily.trend.every((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.period)));

  // Act — the same range, grouped weekly
  const weekly = (await api.call('GET', '/analytics/dashboard?granularity=week', { token: manager })).body;
  // Assert — totals agree regardless of grouping
  assert.ok(weekly.trend.length >= 5 && weekly.trend.length <= 6);
  const total = (list) => Math.round(list.reduce((s, b) => s + b.revenue, 0) * 100);
  assert.equal(total(daily.trend), total(weekly.trend));
  assert.equal(total(daily.trend), Math.round(daily.kpis.revenue * 100));

  // Act / Assert — only managers can see analytics
  assert.equal((await api.call('GET', '/analytics/dashboard', { token: await api.login('waiter') })).status, 403);
});

test('US10.2–US10.6 dishes, tables, peak hours, inventory health and no-show rate', async () => {
  // Act
  const d = (await api.call('GET', '/analytics/dashboard?from=' + inDays(-59) + '&to=' + inDays(0), { token: manager })).body;

  // Assert — top dishes
  const byQty = [...d.dishes].sort((a, b) => b.qty - a.qty);
  assert.equal(byQty[0].name, 'Margherita Pizza');
  assert.ok(d.dishes.every((x) => x.revenue > 0));

  // Assert — table occupancy and turnover
  assert.ok(d.tables.length >= 8 && d.tables.every((t) => t.occupancyRate >= 0 && t.occupancyRate <= 100));
  assert.ok(d.tables.some((t) => t.turns > 0 && t.avgTurnoverMinutes > 30));
  assert.ok(d.zones.map((z) => z.zone).includes('Terrace'));

  // Assert — peak hours
  const busiest = [...d.peakHours].sort((a, b) => b.orders - a.orders)[0];
  assert.ok([19, 20, 13].includes(busiest.hour), `peak at ${busiest.hour}:00`);

  // Assert — inventory health and no-show rate
  assert.equal(d.inventory[0].status, 'low', 'riskiest stock first');
  const r = d.reservations;
  assert.equal(r.noShowRate, Math.round((r.noShows / (r.seated + r.noShows)) * 1000) / 10);
  assert.ok(r.noShowRate > 0 && r.noShowRate < 40);
});
