import { Router } from 'express';
import { orders, inventory, customers } from '../data/store.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();
const analyticsRoles = requireRole('manager', 'admin');

/** GET /api/analytics/summary — revenue, order counts, top categories. */
router.get('/summary', analyticsRoles, (req, res) => {
  const paid = orders.filter((o) => o.status === 'paid');
  const all = orders;

  const revenue = paid.reduce((s, o) => s + o.total, 0);
  const avgOrder = paid.length ? revenue / paid.length : 0;

  // Top selling items by total qty across all orders.
  const itemTotals = {};
  for (const o of all) {
    for (const i of o.items) {
      itemTotals[i.name] = (itemTotals[i.name] || 0) + i.qty;
    }
  }
  const topItems = Object.entries(itemTotals)
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  const statusCounts = {};
  for (const o of all) statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

  const lowStock = inventory.filter((i) => i.stock <= i.reorderLevel).length;

  res.json({
    summary: {
      revenue,
      orderCount: all.length,
      paidCount: paid.length,
      avgOrder,
      customerCount: customers.length,
      topItems,
      statusCounts,
      lowStock,
    },
  });
});

export default router;
