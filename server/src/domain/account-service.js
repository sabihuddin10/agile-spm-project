/**
 * Account lifecycle rules that used to live inside the auth routes: registering a customer account (which
 * always comes with a linked customer profile) and removing an account (which must detach everything that
 * pointed at it). The route decides who may do it and what status to answer; this decides what it means.
 *
 * Collaborators are passed in, so the rules can be tested with plain arrays and no database.
 */

export class AccountError extends Error {
  /** @param {'EMAIL_TAKEN'} code */
  constructor(code, message) {
    super(message);
    this.name = 'AccountError';
    this.code = code;
  }
}

export class AccountService {
  /**
   * @param {{ directory: import('./user-directory.js').UserDirectory, customers: object[], tables: object[],
   *           createUser: Function, nextId: (prefix: string) => string, now?: () => Date }} deps
   */
  constructor({ directory, customers, tables, createUser, nextId, now = () => new Date() }) {
    this.directory = directory;
    this.customers = customers;
    this.tables = tables;
    this.createUser = createUser;
    this.nextId = nextId;
    this.now = now;
  }

  /**
   * Create a customer account and its linked customer profile. Inputs are already validated.
   * @throws {AccountError} EMAIL_TAKEN when the email already has an account
   */
  registerCustomer({ name, email, password }) {
    if (this.directory.byEmail(email)) {
      throw new AccountError('EMAIL_TAKEN', 'An account with that email already exists.');
    }
    const user = this.createUser({ name, email, password, role: 'customer' });
    this.customers.push({
      id: this.nextId('cus'),
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: '',
      type: 'online',
      loyaltyPoints: 0,
      preferences: { dietary: [], allergies: [] },
      notes: '',
      createdAt: this.now().toISOString(),
    });
    return user;
  }

  /**
   * Remove an account and detach what pointed at it: the customer profile keeps its history but loses its
   * login, and a table loses its assigned waiter. Returns the removed user, or undefined when none matches.
   */
  removeAccount(id) {
    const removed = this.directory.remove(id);
    if (!removed) return undefined;
    for (const customer of this.customers) if (customer.userId === removed.id) customer.userId = null;
    for (const table of this.tables) if (table.waiterId === removed.id) table.waiterId = null;
    return removed;
  }
}
