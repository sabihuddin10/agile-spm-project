/** The application's account service, wired to the live store. Routes import `accounts` from here. */
import { AccountService } from './account-service.js';
import { userDirectory, customers, tables, createUser, nextId } from '../data/store.js';

export const accounts = new AccountService({ directory: userDirectory, customers, tables, createUser, nextId });
