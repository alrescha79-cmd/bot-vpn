/**
 * @fileoverview Tripay Payment Service
 * Handles Tripay payment generation, signature verification, and status checking
 *
 * API Documentation: https://tripay.co.id/developer
 */

import axios from 'axios';
import crypto from 'crypto';

const logger = require('../utils/logger');

let config: any;
try {
  config = require('../config').default || require('../config');
} catch (e) {
  config = require('../config');
}

export interface TripayTransactionResponse {
  success: boolean;
  data?: {
    reference: string;
    merchant_ref: string;
    payment_method: string;
    payment_name: string;
    amount: number;
    fee: number;
    total_amount: number;
    qr_string?: string;
    qr_url?: string;
    pay_code?: string;
    checkout_url?: string;
    status: string;
    expired_time: number;
    instructions?: any[];
  };
  error?: string;
}

export interface TripayPaymentStatus {
  success: boolean;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  invoice_id?: string;
  reference?: string;
  amount?: number;
  paid_at?: string;
  payment_method?: string;
  error?: string;
}

/**
 * Get Tripay Base URL based on environment
 */
function getTripayBaseUrl(): string {
  const env = config.TRIPAY_ENV || process.env.TRIPAY_ENV || 'production';
  return env.toLowerCase() === 'sandbox'
    ? 'https://tripay.co.id/api-sandbox'
    : 'https://tripay.co.id/api';
}

/**
 * Check if Tripay credentials are configured
 */
export function isTripayConfigured(): boolean {
  return !!(
    config.TRIPAY_API_KEY &&
    config.TRIPAY_PRIVATE_KEY &&
    config.TRIPAY_MERCHANT_CODE
  );
}

/**
 * Generate HMAC-SHA256 signature for Tripay transaction creation
 */
export function generateTripayCreateSignature(merchantRef: string, amount: number): string {
  const payload = `${config.TRIPAY_MERCHANT_CODE}${merchantRef}${amount}`;
  return crypto
    .createHmac('sha256', config.TRIPAY_PRIVATE_KEY)
    .update(payload)
    .digest('hex');
}

/**
 * Verify incoming Tripay webhook signature
 */
export function verifyTripayWebhookSignature(rawBody: string, receivedSignature: string): boolean {
  if (!config.TRIPAY_PRIVATE_KEY) return false;
  const hash = crypto
    .createHmac('sha256', config.TRIPAY_PRIVATE_KEY)
    .update(rawBody)
    .digest('hex');
  return hash === receivedSignature;
}

/**
 * Generate a Tripay payment transaction (default: QRIS2 / QRIS)
 * @param amount - Deposit amount in IDR
 * @param userId - Telegram user ID
 * @param method - Payment channel (default: QRIS2)
 */
export async function generateTripayPayment(
  amount: number,
  userId: string,
  method: string = 'QRIS2'
): Promise<TripayTransactionResponse> {
  try {
    if (!isTripayConfigured()) {
      return {
        success: false,
        error: 'Tripay payment gateway is not configured'
      };
    }

    const merchantRef = `ORDER-${Date.now()}-${userId}`;
    const signature = generateTripayCreateSignature(merchantRef, amount);
    const expiryTimestamp = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes

    const payload = {
      method: method,
      merchant_ref: merchantRef,
      amount: amount,
      customer_name: `User ${userId}`,
      customer_email: `user${userId}@telegram.vpn`,
      customer_phone: '081234567890',
      order_items: [
        {
          name: 'Deposit Saldo Bot VPN',
          price: amount,
          quantity: 1
        }
      ],
      expired_time: expiryTimestamp,
      signature: signature
    };

    logger.info(`Creating Tripay payment: ${merchantRef} (${amount} IDR, method: ${method})`);

    const response = await axios.post(
      `${getTripayBaseUrl()}/transaction/create`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${config.TRIPAY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    if (response.data && response.data.success && response.data.data) {
      const data = response.data.data;
      logger.info(`Tripay transaction created successfully: ${data.reference} (${merchantRef})`);

      return {
        success: true,
        data: {
          reference: data.reference,
          merchant_ref: data.merchant_ref,
          payment_method: data.payment_method,
          payment_name: data.payment_name,
          amount: data.amount,
          fee: data.total_fee,
          total_amount: data.amount_received ? data.amount : data.amount + (data.total_fee || 0),
          qr_string: data.qr_string || data.pay_code,
          qr_url: data.qr_url,
          pay_code: data.pay_code,
          checkout_url: data.checkout_url,
          status: data.status,
          expired_time: data.expired_time,
          instructions: data.instructions
        }
      };
    }

    throw new Error(response.data?.message || 'Failed to create Tripay payment');
  } catch (error: any) {
    logger.error('Error in generateTripayPayment:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create Tripay payment'
    };
  }
}

/**
 * Check payment status on Tripay
 * @param reference - Tripay reference number or merchant_ref
 */
export async function checkTripayPaymentStatus(reference: string): Promise<TripayPaymentStatus> {
  try {
    if (!isTripayConfigured()) {
      return {
        success: false,
        status: 'failed',
        error: 'Tripay not configured'
      };
    }

    logger.info(`Checking Tripay payment status for reference/order: ${reference}`);

    const response = await axios.get(
      `${getTripayBaseUrl()}/transaction/detail`,
      {
        params: { reference: reference },
        headers: {
          Authorization: `Bearer ${config.TRIPAY_API_KEY}`
        },
        timeout: 10000
      }
    );

    if (response.data && response.data.success && response.data.data) {
      const data = response.data.data;
      let status: 'pending' | 'paid' | 'expired' | 'failed' = 'pending';

      switch (data.status) {
        case 'PAID':
          status = 'paid';
          break;
        case 'EXPIRED':
          status = 'expired';
          break;
        case 'FAILED':
        case 'REFUND':
          status = 'failed';
          break;
        case 'UNPAID':
        default:
          status = 'pending';
          break;
      }

      return {
        success: true,
        status: status,
        invoice_id: data.merchant_ref,
        reference: data.reference,
        amount: data.amount,
        paid_at: data.paid_at ? new Date(data.paid_at * 1000).toISOString() : undefined,
        payment_method: data.payment_name || data.payment_method
      };
    }

    return {
      success: false,
      status: 'failed',
      error: response.data?.message || 'Failed to retrieve transaction'
    };
  } catch (error: any) {
    logger.error('Error checking Tripay payment status:', error.response?.data || error.message);
    return {
      success: false,
      status: 'failed',
      error: error.response?.data?.message || error.message
    };
  }
}

module.exports = {
  isTripayConfigured,
  generateTripayPayment,
  checkTripayPaymentStatus,
  verifyTripayWebhookSignature,
  generateTripayCreateSignature
};
