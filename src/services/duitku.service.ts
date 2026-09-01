/**
 * @fileoverview Duitku Payment Service
 * Handles Duitku payment generation, MD5 signature verification, and status checking
 *
 * API Documentation: https://docs.duitku.com/
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

export interface DuitkuTransactionResponse {
  success: boolean;
  data?: {
    merchant_code: string;
    reference: string;
    payment_url: string;
    qr_string?: string;
    va_number?: string;
    amount: number;
    status_code: string;
    status_message: string;
    invoice_id: string;
  };
  error?: string;
}

export interface DuitkuPaymentStatus {
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
 * Get Duitku Base URL based on environment
 */
function getDuitkuBaseUrl(): string {
  const env = config.DUITKU_ENV || process.env.DUITKU_ENV || 'production';
  return env.toLowerCase() === 'sandbox'
    ? 'https://sandbox.duitku.com/webapi/api/merchant/v2'
    : 'https://passport.duitku.com/webapi/api/merchant/v2';
}

/**
 * Check if Duitku credentials are configured
 */
export function isDuitkuConfigured(): boolean {
  return !!(config.DUITKU_MERCHANT_CODE && config.DUITKU_API_KEY);
}

/**
 * Generate MD5 signature for Duitku payment request
 */
export function generateDuitkuRequestSignature(merchantOrderId: string, amount: number): string {
  const raw = `${config.DUITKU_MERCHANT_CODE}${merchantOrderId}${amount}${config.DUITKU_API_KEY}`;
  return crypto.createHash('md5').update(raw).digest('hex');
}

/**
 * Verify Duitku callback signature
 */
export function verifyDuitkuCallbackSignature(
  merchantCode: string,
  amount: string | number,
  merchantOrderId: string,
  signature: string
): boolean {
  const raw = `${merchantCode}${amount}${merchantOrderId}${config.DUITKU_API_KEY}`;
  const hash = crypto.createHash('md5').update(raw).digest('hex');
  return hash === signature;
}

/**
 * Generate Duitku payment (QRIS / payment URL)
 * @param amount - Deposit amount in IDR
 * @param userId - Telegram user ID
 * @param paymentMethod - Payment method code (e.g., 'SP' for ShopeePay QRIS, 'LQ' for LinkAja QRIS, 'NQ' for Nobu QRIS, default 'QRIS')
 */
export async function generateDuitkuPayment(
  amount: number,
  userId: string,
  paymentMethod: string = 'SP'
): Promise<DuitkuTransactionResponse> {
  try {
    if (!isDuitkuConfigured()) {
      return {
        success: false,
        error: 'Duitku payment gateway is not configured'
      };
    }

    const orderId = `ORDER-${Date.now()}-${userId}`;
    const signature = generateDuitkuRequestSignature(orderId, amount);

    const payload = {
      merchantCode: config.DUITKU_MERCHANT_CODE,
      paymentAmount: amount,
      paymentMethod: paymentMethod,
      merchantOrderId: orderId,
      productDetails: 'Deposit Saldo Bot VPN',
      additionalParam: userId,
      merchantUserInfo: `user_${userId}`,
      customerVaName: `User ${userId}`,
      email: `user${userId}@telegram.vpn`,
      phoneNumber: '081234567890',
      callbackUrl: `http://localhost:${config.PORT || 50123}/api/duitku/notification`,
      returnUrl: `http://localhost:${config.PORT || 50123}/health`,
      signature: signature,
      expiryPeriod: 30
    };

    logger.info(`Creating Duitku payment: ${orderId} (${amount} IDR, method: ${paymentMethod})`);

    const response = await axios.post(
      `${getDuitkuBaseUrl()}/inquiry`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    if (response.data && (response.data.statusCode === '00' || response.data.paymentUrl)) {
      const data = response.data;
      logger.info(`Duitku payment generated successfully: ${orderId} (Ref: ${data.reference || 'N/A'})`);

      return {
        success: true,
        data: {
          merchant_code: config.DUITKU_MERCHANT_CODE,
          reference: data.reference || orderId,
          payment_url: data.paymentUrl,
          qr_string: data.qrString || data.paymentUrl,
          va_number: data.vaNumber,
          amount: amount,
          status_code: data.statusCode || '00',
          status_message: data.statusMessage || 'SUCCESS',
          invoice_id: orderId
        }
      };
    }

    throw new Error(response.data?.statusMessage || 'Failed to create Duitku payment');
  } catch (error: any) {
    logger.error('Error in generateDuitkuPayment:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.statusMessage || error.message || 'Failed to create Duitku payment'
    };
  }
}

/**
 * Check Duitku transaction status
 */
export async function checkDuitkuPaymentStatus(merchantOrderId: string): Promise<DuitkuPaymentStatus> {
  try {
    if (!isDuitkuConfigured()) {
      return {
        success: false,
        status: 'failed',
        error: 'Duitku not configured'
      };
    }

    const signature = crypto
      .createHash('md5')
      .update(`${config.DUITKU_MERCHANT_CODE}${merchantOrderId}${config.DUITKU_API_KEY}`)
      .digest('hex');

    const payload = {
      merchantCode: config.DUITKU_MERCHANT_CODE,
      merchantOrderId: merchantOrderId,
      signature: signature
    };

    const response = await axios.post(
      `${getDuitkuBaseUrl()}/transactionStatus`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );

    if (response.data) {
      const data = response.data;
      let status: 'pending' | 'paid' | 'expired' | 'failed' = 'pending';

      // Duitku statusCode: "00" = Success/Paid, "01" = Pending, "02" = Canceled/Expired
      if (data.statusCode === '00') {
        status = 'paid';
      } else if (data.statusCode === '02') {
        status = 'expired';
      } else if (data.statusCode === '01') {
        status = 'pending';
      } else {
        status = 'failed';
      }

      return {
        success: true,
        status: status,
        invoice_id: merchantOrderId,
        reference: data.reference,
        amount: Number(data.amount),
        payment_method: 'duitku'
      };
    }

    return {
      success: false,
      status: 'failed',
      error: 'Invalid response from Duitku'
    };
  } catch (error: any) {
    logger.error('Error checking Duitku payment status:', error.response?.data || error.message);
    return {
      success: false,
      status: 'failed',
      error: error.response?.data?.statusMessage || error.message
    };
  }
}

module.exports = {
  isDuitkuConfigured,
  generateDuitkuPayment,
  checkDuitkuPaymentStatus,
  generateDuitkuRequestSignature,
  verifyDuitkuCallbackSignature
};
