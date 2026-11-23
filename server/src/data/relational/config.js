/** settings (one row), sequences (id counters and the order number). */
import { num } from './sql.js';

const snake = (k) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (k) => k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const SETTINGS_TYPES = {
  restaurant_name: 'text', address: 'text', tax_rate: 'numeric', service_charge_rate: 'numeric', point_value: 'numeric',
  kitchen_delay_minutes: 'integer', reservation_duration_minutes: 'integer', reservation_grace_minutes: 'integer',
  opening_hour: 'integer', closing_hour: 'integer', late_grace_minutes: 'integer', late_penalty: 'numeric',
  auto_break_minutes: 'integer', auto_break_after_hours: 'integer',
};

export function save(s) {
  const row = { id: 1 };
  for (const [k, v] of Object.entries(s.settings)) row[snake(k)] = v;
  const defs = ['id smallint', ...Object.keys(SETTINGS_TYPES).map((c) => `${c} ${SETTINGS_TYPES[c]}`)].join(', ');
  return [
    ['settings', defs, [row], { identity: false }],
    ['sequences', 'name text, last_value bigint', [
      { name: 'order_seq', last_value: s.orderSeq.lastNumber },
      ...Object.entries(s.counters).map(([prefix, n]) => ({ name: `id:${prefix}`, last_value: n })),
    ], { identity: false }],
  ];
}

export function load(r) {
  const settings = {};
  for (const [k, v] of Object.entries(r.settings[0] ?? {})) {
    if (k === 'id') continue;
    settings[camel(k)] = SETTINGS_TYPES[k] === 'numeric' ? num(v) : v;
  }
  const counters = {};
  let lastNumber;
  for (const { name, last_value } of r.sequences) {
    if (name === 'order_seq') lastNumber = Number(last_value);
    else if (name.startsWith('id:')) counters[name.slice(3)] = Number(last_value);
  }
  return { settings, counters, orderSeq: lastNumber === undefined ? {} : { lastNumber } };
}
