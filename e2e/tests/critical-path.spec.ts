import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Critical-path journeys (bolt 001), run against production builds.
 *
 * One order travels the whole way through the real stack — browser, Next.js
 * /api proxy, Express API, session cookie, seeded in-memory state:
 *
 *   customer places a pickup order  ->  waiter confirms it  ->  chef sees it in the kitchen
 *
 * The accounts are the public demo seeds from the README (server/src/data/store.js),
 * used only against the throwaway in-memory API this suite starts itself.
 */

const DEMO_PASSWORD = 'password';

/**
 * Navigates, retrying if the browser aborts the navigation because the previous page was still
 * settling (Firefox reports this as NS_BINDING_ABORTED).
 */
async function visit(page: Page, path: string) {
  await expect(async () => {
    await page.goto(path);
  }).toPass({ timeout: 20_000 });
}

/** Opens a fresh, isolated browser session signed in as a seeded demo account. */
async function signInAs(browser: Browser, email: string, landing: string | RegExp): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await visit(page, '/login');

  const emailField = page.locator('#email');
  const passwordField = page.locator('#password');
  const submit = page.getByRole('button', { name: 'Sign in', exact: true });
  // The form is a controlled React form: text typed before hydration finishes is wiped when React
  // takes over (slow engines or a busy machine hit this). Type until the values actually stick.
  await expect(async () => {
    await emailField.fill(email);
    await passwordField.fill(DEMO_PASSWORD);
    await expect(emailField).toHaveValue(email, { timeout: 1_000 });
    await expect(passwordField).toHaveValue(DEMO_PASSWORD, { timeout: 1_000 });
    await expect(submit).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await submit.click();
  await expect(page).toHaveURL(typeof landing === 'string' ? new RegExp(`${landing}$`) : landing);
  return page;
}

test.describe.serial('critical path: order -> confirm -> kitchen', () => {
  let orderNumber = '';

  test('customer signs in, places a pickup order and finds it in My account', async ({ browser }) => {
    // Arrange
    const page = await signInAs(browser, 'customer@rest.test', '/');

    // Act: add the first available dish and check out for pickup, paying by cash
    await visit(page, '/menu');
    await page.waitForLoadState('networkidle'); // let the menu load and React hydrate before clicking
    await page.getByRole('button', { name: /^Add .+ to order$/ }).first().click();
    // A dish with modifiers opens an options dialog; a plain dish goes straight to the cart.
    // Wait for whichever happens, instead of guessing how fast the browser is.
    const options = page.getByRole('dialog');
    const cart = page.getByRole('button', { name: /^View your order/ });
    await expect(options.or(cart)).toBeVisible();
    if (await options.isVisible()) {
      // Accept the default options.
      await options.getByRole('button').last().click();
    }
    await cart.click();
    await page.getByRole('button', { name: /^Checkout/ }).click();
    await page.getByRole('radio', { name: /Pickup/ }).click();
    await page.getByRole('radio', { name: /Cash/ }).click();
    await page.getByRole('button', { name: /place order/i }).click();

    // Assert: the API accepted it and showed an order number
    const received = page.getByRole('heading', { name: /Order #\d+ received/ });
    await expect(received).toBeVisible();
    orderNumber = ((await received.textContent()) ?? '').match(/#(\d+)/)?.[1] ?? '';
    expect(orderNumber).not.toBe('');

    // Assert: it is listed for this customer (session cookie + proxy + API read)
    await visit(page, '/account#orders');
    await expect(page.getByRole('heading', { name: `Order #${orderNumber}` })).toBeVisible();
    await page.context().close();
  });

  test('waiter confirms the order and it is sent to the kitchen', async ({ browser }) => {
    // Arrange
    expect(orderNumber, 'the customer journey must run first').not.toBe('');
    const page = await signInAs(browser, 'waiter@rest.test', /\/staff$/);

    // Act
    await visit(page, '/staff/orders');
    const card = page.getByLabel(`Order #${orderNumber}`, { exact: true });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Confirm', exact: true }).click();

    // Assert
    await expect(page.getByText(`Order #${orderNumber} confirmed and sent to the kitchen.`)).toBeVisible();
    await page.context().close();
  });

  test('chef sees the confirmed order in the kitchen queue and starts it', async ({ browser }) => {
    // Arrange
    expect(orderNumber, 'the customer journey must run first').not.toBe('');
    const page = await signInAs(browser, 'chef@rest.test', /\/staff$/);

    // Act
    await visit(page, '/staff/kitchen');
    const ticket = page.getByLabel(new RegExp(`^Order #${orderNumber}, queue position`));
    await expect(ticket).toBeVisible();
    await ticket.getByRole('button', { name: 'Start all' }).click();

    // Assert
    await expect(page.getByText(`Order #${orderNumber} started.`)).toBeVisible();
    await page.context().close();
  });

  test('a customer cannot open the staff kitchen display', async ({ browser }) => {
    // Arrange
    const page = await signInAs(browser, 'customer@rest.test', '/');

    // Act
    await visit(page, '/staff/kitchen');

    // Assert: sent back to the storefront, and the kitchen display never renders
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Kitchen display')).toHaveCount(0);
    await page.context().close();
  });
});
