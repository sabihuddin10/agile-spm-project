/** Auth middleware — middleware/auth.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, optionalAuth, requireAdmin, requireRole } from '../../src/middleware/auth.js';
import { signToken } from '../../src/lib/jwt.js';
import { findUserById } from '../../src/data/store.js';

function mockReq(token) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}

function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

function mockNext() {
  const calls = { count: 0 };
  const next = () => {
    calls.count += 1;
  };
  next.calls = calls;
  return next;
}

test('authenticate attaches req.user for a valid token and calls next', () => {
  // Arrange
  const waiter = findUserById('usr_waiter');
  const token = signToken(waiter);
  const req = mockReq(token);
  const res = mockRes();
  const next = mockNext();

  // Act
  authenticate(req, res, next);

  // Assert
  assert.equal(next.calls.count, 1);
  assert.equal(req.user.id, 'usr_waiter');
  assert.equal(res.statusCode, null);
});

test('authenticate rejects a missing token with 401', () => {
  // Arrange
  const req = mockReq(null);
  const res = mockRes();
  const next = mockNext();

  // Act
  authenticate(req, res, next);

  // Assert
  assert.equal(next.calls.count, 0);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Authentication required.');
});

test('authenticate rejects an invalid token with 401', () => {
  // Arrange
  const req = mockReq('garbage-token');
  const res = mockRes();
  const next = mockNext();

  // Act
  authenticate(req, res, next);

  // Assert
  assert.equal(next.calls.count, 0);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Invalid or expired token.');
});

test('authenticate rejects a deactivated user immediately, even with a valid token (US9.4)', () => {
  // Arrange
  const waiter2 = findUserById('usr_waiter2');
  const token = signToken(waiter2);
  waiter2.active = false;
  const req = mockReq(token);
  const res = mockRes();
  const next = mockNext();

  try {
    // Act
    authenticate(req, res, next);

    // Assert
    assert.equal(next.calls.count, 0);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, 'User not found or deactivated.');
  } finally {
    waiter2.active = true;
  }
});

test('optionalAuth continues as a guest when there is no token', () => {
  // Arrange
  const req = mockReq(null);
  const res = mockRes();
  const next = mockNext();

  // Act
  optionalAuth(req, res, next);

  // Assert
  assert.equal(next.calls.count, 1);
  assert.equal(req.user, undefined);
  assert.equal(res.statusCode, null);
});

test('optionalAuth attaches req.user when a valid token is present', () => {
  // Arrange
  const manager = findUserById('usr_manager');
  const token = signToken(manager);
  const req = mockReq(token);
  const res = mockRes();
  const next = mockNext();

  // Act
  optionalAuth(req, res, next);

  // Assert
  assert.equal(next.calls.count, 1);
  assert.equal(req.user.id, 'usr_manager');
});

test('requireRole allows a listed role through and blocks everyone else', () => {
  // Arrange
  const guard = requireRole('manager', 'admin');

  const allowedReq = { user: { role: 'manager' } };
  const allowedRes = mockRes();
  const allowedNext = mockNext();

  const blockedReq = { user: { role: 'waiter' } };
  const blockedRes = mockRes();
  const blockedNext = mockNext();

  // Act
  guard(allowedReq, allowedRes, allowedNext);
  guard(blockedReq, blockedRes, blockedNext);

  // Assert
  assert.equal(allowedNext.calls.count, 1);
  assert.equal(blockedNext.calls.count, 0);
  assert.equal(blockedRes.statusCode, 403);
});

test('requireRole requires authentication to have run first', () => {
  // Arrange
  const guard = requireRole('admin');
  const req = {};
  const res = mockRes();
  const next = mockNext();

  // Act
  guard(req, res, next);

  // Assert
  assert.equal(next.calls.count, 0);
  assert.equal(res.statusCode, 401);
});

test('requireAdmin composes authenticate and requireRole("admin")', () => {
  // Arrange
  const [authStep, roleStep] = requireAdmin;
  const admin = findUserById('usr_admin');
  const adminToken = signToken(admin);
  const waiter = findUserById('usr_waiter');
  const waiterToken = signToken(waiter);

  // Act — an admin token passes both steps
  const adminReq = mockReq(adminToken);
  const adminRes = mockRes();
  const adminNext = mockNext();
  authStep(adminReq, adminRes, adminNext);
  roleStep(adminReq, adminRes, adminNext);

  // Act — a non-admin token is authenticated but blocked at the role check
  const waiterReq = mockReq(waiterToken);
  const waiterRes = mockRes();
  const waiterNext = mockNext();
  authStep(waiterReq, waiterRes, waiterNext);
  roleStep(waiterReq, waiterRes, waiterNext);

  // Assert
  assert.equal(adminNext.calls.count, 2);
  assert.equal(waiterNext.calls.count, 1, 'authenticate passed, requireRole blocked');
  assert.equal(waiterRes.statusCode, 403);
});
