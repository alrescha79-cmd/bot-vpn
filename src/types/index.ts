/**
 * Global Type Definitions
 * Centralized type definitions for the entire application
 */

import { Context } from 'telegraf';
import type { Update } from 'telegraf/types';

// ==================== Database Types ====================

export interface DatabaseUser {
  id: number;
  user_id: number;
  saldo: number;
  role: 'user' | 'reseller' | 'admin';
  reseller_level: 'silver' | 'gold' | 'platinum';
  has_trial: number;
  username: string | null;
  first_name: string | null;
  last_trial_date: string | null;
  trial_count_today: number;
}

export interface DatabaseServer {
  id: number;
  domain: string;
  auth: string;
  harga: number;
  nama_server: string;
  quota: number;
  iplimit: number;
  batas_create_akun: number;
  total_create_akun: number;
  isp: string | null;
  lokasi: string | null;
}

export interface DatabaseAccount {
  id: number;
  user_id: number;
  jenis: string;
  username: string;
  server_id: number;
  created_at: string;
}

export interface DatabaseTransaction {
  id: number;
  user_id: number;
  type: string;
  username: string;
  created_at: string;
}

export interface DatabaseResellerSale {
  id: number;
  reseller_id: number;
  buyer_id: number;
  akun_type: string;
  username: string;
  komisi: number;
  created_at: string;
}

export interface DatabasePendingDeposit {
  unique_code: string;
  user_id: number;
  amount: number;
  original_amount: number;
  timestamp: number;
  status: string;
  qr_message_id: number | null;
}

export interface DatabaseTrialLog {
  id: number;
  user_id: number;
  username: string;
  jenis: string;
  created_at: string;
}

// ==================== SSH & Protocol Types ====================

export interface SSHConnectionConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface SSHCommandResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface VPNAccountCredentials {
  username: string;
  password: string;
  domain: string;
  port?: number;
  uuid?: string;
  link?: string;
  qr?: string;
}

export interface ProtocolCreationParams {
  username: string;
  password: string;
  duration: number;
  serverId: number;
  userId: number;
  serverDomain: string;
  serverAuth: string;
}

export interface ProtocolRenewalParams {
  username: string;
  duration: number;
  serverId: number;
  userId: number;
  serverDomain: string;
  serverAuth: string;
}

export interface ProtocolTrialParams {
  username: string;
  serverId: number;
  userId: number;
  serverDomain: string;
  serverAuth: string;
}

// ==================== Service Types ====================

export interface CreateAccountParams {
  userId: number;
  protocol: 'ssh' | 'vmess' | 'vless' | 'trojan' | 'shadowsocks';
  serverId: number;
  duration: number;
  username: string;
  password?: string;
}

export interface RenewAccountParams {
  userId: number;
  protocol: string;
  serverId: number;
  duration: number;
  username: string;
}

export interface TrialAccountParams {
  userId: number;
  protocol: string;
  serverId: number;
}

export interface DepositParams {
  userId: number;
  amount: number;
}

export interface TransferParams {
  fromUserId: number;
  toUserId: number;
  amount: number;
}

// ==================== Repository Return Types ====================

export interface RepositoryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== Telegraf Context Types ====================

export interface BotContext extends Context<Update> {
  session?: {
    [key: string]: any;
  };
  state: {
    user?: DatabaseUser;
    [key: string]: any;
  };
}

export type NextFunction = () => Promise<void>;

export type MiddlewareFunction = (ctx: BotContext, next: NextFunction) => Promise<void>;

// ==================== QR Payment Types ====================

export interface QRISPaymentData {
  qr_string: string;
  qr_link: string;
  amount: number;
  unique_code: string;
  expired_at: number;
  payment_method?: 'midtrans' | 'static_qris' | 'pakasir';
  fee?: number;
  total_payment?: number;
}

export interface PaymentCheckResult {
  paid: boolean;
  amount?: number;
  transaction_id?: string;
}

// ==================== Stats & Analytics ====================

export interface SystemStats {
  totalUsers: number;
  totalResellers: number;
  totalServers: number;
  totalAccounts: number;
  activeAccounts: number;
}

export interface ResellerStats {
  reseller_id: number;
  username: string | null;
  total_komisi: number;
  total_create: number;
  level: string;
}

export interface ServerStats {
  server_id: number;
  nama_server: string;
  total_accounts: number;
  available_slots: number;
  usage_percentage: number;
}

// ==================== Error Types ====================

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public data?: any
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, data?: any) {
    super(message, 'DATABASE_ERROR', 500, data);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, data?: any) {
    super(message, 'VALIDATION_ERROR', 400, data);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_ERROR', 401);
    this.name = 'AuthenticationError';
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(message: string = 'Saldo tidak mencukupi') {
    super(message, 'INSUFFICIENT_BALANCE', 402);
    this.name = 'InsufficientBalanceError';
  }
}

// ==================== Utility Types ====================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type AsyncReturnType<T extends (...args: any) => Promise<any>> = T extends (...args: any) => Promise<infer R> ? R : any;

// ==================== Export All ====================

export default {
  // Re-export everything for convenience
};
