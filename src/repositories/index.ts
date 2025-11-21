
import type { BotContext, DatabaseUser, DatabaseServer } from "../types";
/**
 * Repositories Index
 * Barrel export for all repository modules
 * @module repositories
 */

const userRepository = require('./userRepository');
const serverRepository = require('./serverRepository');
const accountRepository = require('./accountRepository');
const transactionRepository = require('./transactionRepository');
const resellerRepository = require('./resellerRepository');
const trialRepository = require('./trialRepository');
const depositRepository = require('./depositRepository');

module.exports = {
  userRepository,
  serverRepository,
  accountRepository,
  transactionRepository,
  resellerRepository,
  trialRepository,
  depositRepository
};
