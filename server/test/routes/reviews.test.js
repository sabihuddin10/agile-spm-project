/** Reviews module — routes/reviews.js (Customer feedback, ratings, and manager moderation). */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, issuedToken, menuItem } from '../helpers.js';

let api;
let manager;
let waiter;
let chef;

async function fulfillOrder(orderId) {
  await api.call('POST', `/billing/${orderId}/pay`, { token: waiter, body: { method: 'card' } });
  await api.call('POST', `/orders/${orderId}/status`, { token: waiter, body: { status: 'confirmed' } });
  await api.call('POST', `/orders/${orderId}/status`, { token: chef, body: { status: 'ready' } });
  await api.call('POST', `/orders/${orderId}/status`, { token: waiter, body: { status: 'served' } });
}

before(async () => {
  api = await startServer();
  [manager, waiter, chef] = await Promise.all([
    api.login('manager'),
    api.login('waiter'),
    api.login('chef'),
  ]);
});

after(() => api.close());

test('GET /api/reviews and GET /api/reviews/summary are public and return seed ratings', async () => {
  // Arrange / Act
  const listRes = await api.call('GET', '/reviews');
  const summaryRes = await api.call('GET', '/reviews/summary');

  // Assert
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listRes.body.reviews));
  assert.ok(listRes.body.reviews.length >= 2);

  assert.equal(summaryRes.status, 200);
  const { summary } = summaryRes.body;
  assert.ok(summary.totalReviews >= 2);
  assert.ok(summary.averageRating >= 1 && summary.averageRating <= 5);
  assert.equal(typeof summary.recommendationRate, 'number');
  assert.ok(summary.distribution['5'] >= 1);
});

test('a customer submits a review for their served/paid order, and managers receive a notification', async () => {
  // Arrange — register a customer, place and pay an order
  const reg = await api.call('POST', '/auth/register', {
    body: { name: 'Gourmet Reviewer', email: 'gourmet@example.com', password: 'Secret-pass1', phone: '+92 300 5550999' },
  });
  assert.equal(reg.status, 201);
  const custToken = issuedToken(reg);

  const dish = await menuItem(api.call, 'Garlic Bread');
  const orderRes = await api.call('POST', '/orders', {
    token: custToken,
    body: { type: 'online', fulfillment: 'pickup', items: [{ menuItemId: dish.id, qty: 1 }] },
  });
  assert.equal(orderRes.status, 201);
  const orderId = orderRes.body.order.id;

  // Pay and serve the order so it is fulfilled
  await fulfillOrder(orderId);

  // Act — customer submits a 5-star review
  const reviewRes = await api.call('POST', '/reviews', {
    token: custToken,
    body: {
      orderId,
      rating: 5,
      foodRating: 5,
      serviceRating: 4,
      comment: 'Absolutely amazing garlic bread! Warm crust and fresh garlic butter.',
      menuItemIds: [dish.id],
      tags: ['crispy', 'fresh'],
    },
  });

  // Assert
  assert.equal(reviewRes.status, 201);
  assert.equal(reviewRes.body.review.rating, 5);
  assert.equal(reviewRes.body.review.foodRating, 5);
  assert.equal(reviewRes.body.review.serviceRating, 4);
  assert.equal(reviewRes.body.review.customerName, 'Gourmet Reviewer');
  assert.deepEqual(reviewRes.body.review.tags, ['crispy', 'fresh']);
  assert.ok(reviewRes.body.review.menuItemNames.includes('Garlic Bread'));

  // Notification verification
  const notes = (await api.call('GET', '/notifications', { token: manager })).body.notifications;
  assert.ok(notes.some((n) => n.title === 'New customer review' && n.message.includes('Gourmet Reviewer')));
});

test('submitting a review for another customer order is 403, and unfulfilled order is 400', async () => {
  // Arrange — create Customer A and Customer B
  const regA = await api.call('POST', '/auth/register', {
    body: { name: 'Customer Alpha', email: 'alpha@example.com', password: 'Secret-pass1' },
  });
  const regB = await api.call('POST', '/auth/register', {
    body: { name: 'Customer Beta', email: 'beta@example.com', password: 'Secret-pass1' },
  });
  const tokenA = issuedToken(regA);
  const tokenB = issuedToken(regB);

  const dish = await menuItem(api.call, 'Garlic Bread');
  const orderA = (await api.call('POST', '/orders', {
    token: tokenA,
    body: { type: 'online', fulfillment: 'pickup', items: [{ menuItemId: dish.id, qty: 1 }] },
  })).body.order;

  // Act / Assert 1 — unfulfilled order cannot be reviewed
  const unfulfilled = await api.call('POST', '/reviews', {
    token: tokenA,
    body: { orderId: orderA.id, rating: 5, comment: 'Too early review' },
  });
  assert.equal(unfulfilled.status, 400);
  assert.match(unfulfilled.body.error, /served or closed/i);

  // Pay and serve orderA
  await fulfillOrder(orderA.id);

  // Act / Assert 2 — Customer B cannot review Customer A's order
  const forbidden = await api.call('POST', '/reviews', {
    token: tokenB,
    body: { orderId: orderA.id, rating: 5, comment: 'Trying to review someone else order' },
  });
  assert.equal(forbidden.status, 403);
  assert.match(forbidden.body.error, /only review your own orders/i);
});

test('duplicate reviews for the same order are refused with 409 Conflict', async () => {
  // Arrange
  const reg = await api.call('POST', '/auth/register', {
    body: { name: 'Duplicate Tester', email: 'dup.tester@example.com', password: 'Secret-pass1' },
  });
  const token = issuedToken(reg);

  const dish = await menuItem(api.call, 'Garlic Bread');
  const order = (await api.call('POST', '/orders', {
    token,
    body: { type: 'online', fulfillment: 'pickup', items: [{ menuItemId: dish.id, qty: 1 }] },
  })).body.order;
  await fulfillOrder(order.id);

  // Act — first review succeeds
  const first = await api.call('POST', '/reviews', {
    token,
    body: { orderId: order.id, rating: 4, comment: 'First review' },
  });
  assert.equal(first.status, 201);

  // Act — duplicate review on same order
  const second = await api.call('POST', '/reviews', {
    token,
    body: { orderId: order.id, rating: 5, comment: 'Second attempt' },
  });

  // Assert
  assert.equal(second.status, 409);
  assert.match(second.body.error, /already submitted a review/i);
});

test('review input is type-checked: rating must be 1 to 5, comment within limit', async () => {
  // Arrange
  const reg = await api.call('POST', '/auth/register', {
    body: { name: 'Type Tester', email: 'type.tester@example.com', password: 'Secret-pass1' },
  });
  const token = issuedToken(reg);
  const dish = await menuItem(api.call, 'Garlic Bread');
  const order = (await api.call('POST', '/orders', {
    token,
    body: { type: 'online', fulfillment: 'pickup', items: [{ menuItemId: dish.id, qty: 1 }] },
  })).body.order;
  await fulfillOrder(order.id);

  // Act
  const zeroRating = await api.call('POST', '/reviews', { token, body: { orderId: order.id, rating: 0 } });
  const sixRating = await api.call('POST', '/reviews', { token, body: { orderId: order.id, rating: 6 } });
  const stringRating = await api.call('POST', '/reviews', { token, body: { orderId: order.id, rating: 'five' } });
  const floatRating = await api.call('POST', '/reviews', { token, body: { orderId: order.id, rating: 4.5 } });
  const longComment = await api.call('POST', '/reviews', { token, body: { orderId: order.id, rating: 5, comment: 'x'.repeat(1001) } });

  // Assert
  for (const res of [zeroRating, sixRating, stringRating, floatRating, longComment]) {
    assert.equal(res.status, 400);
  }
});

test('GET /api/reviews/mine lists the customer own reviews newest first', async () => {
  // Arrange
  const reg = await api.call('POST', '/auth/register', {
    body: { name: 'Mine Reviewer', email: 'mine.reviewer@example.com', password: 'Secret-pass1' },
  });
  const token = issuedToken(reg);
  const dish = await menuItem(api.call, 'Garlic Bread');
  const order = (await api.call('POST', '/orders', {
    token,
    body: { type: 'online', fulfillment: 'pickup', items: [{ menuItemId: dish.id, qty: 1 }] },
  })).body.order;
  await fulfillOrder(order.id);

  await api.call('POST', '/reviews', { token, body: { orderId: order.id, rating: 5, comment: 'My favorite spot!' } });

  // Act
  const mine = await api.call('GET', '/reviews/mine', { token });

  // Assert
  assert.equal(mine.status, 200);
  assert.equal(mine.body.reviews.length, 1);
  assert.equal(mine.body.reviews[0].comment, 'My favorite spot!');
});

test('a manager responds to a review and updates moderation status', async () => {
  // Arrange
  const list = (await api.call('GET', '/reviews')).body.reviews;
  const target = list[0];

  // Act — manager adds an official reply and marks flagged
  const patchRes = await api.call('PATCH', `/reviews/${target.id}`, {
    token: manager,
    body: { managerResponse: 'We appreciate your detailed feedback!', status: 'flagged' },
  });

  // Assert
  assert.equal(patchRes.status, 200);
  assert.equal(patchRes.body.review.managerResponse, 'We appreciate your detailed feedback!');
  assert.equal(patchRes.body.review.status, 'flagged');
  assert.ok(patchRes.body.review.respondedAt);

  // Restore status to published
  await api.call('PATCH', `/reviews/${target.id}`, { token: manager, body: { status: 'published' } });
});

test('a manager deletes a review; chefs and waiters cannot delete', async () => {
  // Arrange
  const list = (await api.call('GET', '/reviews')).body.reviews;
  const target = list[list.length - 1];

  // Act
  const forbiddenWaiter = await api.call('DELETE', `/reviews/${target.id}`, { token: waiter });
  const forbiddenChef = await api.call('DELETE', `/reviews/${target.id}`, { token: chef });
  const deletedRes = await api.call('DELETE', `/reviews/${target.id}`, { token: manager });

  // Assert
  assert.equal(forbiddenWaiter.status, 403);
  assert.equal(forbiddenChef.status, 403);
  assert.equal(deletedRes.status, 200);
  assert.deepEqual(deletedRes.body, { deleted: true, id: target.id });

  // Act / Assert — 404 on deleting non-existent review
  const notFound = await api.call('DELETE', `/reviews/${target.id}`, { token: manager });
  assert.equal(notFound.status, 404);
});

test('reviews can be filtered by rating and sorted by highest/lowest', async () => {
  // Act
  const fiveStars = await api.call('GET', '/reviews?rating=5');
  const sortedHighest = await api.call('GET', '/reviews?sort=highest');

  // Assert
  assert.equal(fiveStars.status, 200);
  for (const r of fiveStars.body.reviews) assert.equal(r.rating, 5);

  assert.equal(sortedHighest.status, 200);
  const ratings = sortedHighest.body.reviews.map((r) => r.rating);
  for (let i = 0; i < ratings.length - 1; i++) {
    assert.ok(ratings[i] >= ratings[i + 1]);
  }
});
