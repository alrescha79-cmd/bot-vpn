/**
 * @fileoverview Pakasir Payment Service
 * Handles Pakasir payment generation and verification
 * 
 * API Documentation: https://app.pakasir.com
 * 
 * Flow mirip dengan Midtrans:
 * 1. Generate payment via API
 * 2. Return QR code/VA number
 * 3. Check payment status
 * 4. Receive webhook notification
 */

import axios from 'axios';

// Use require for CommonJS modules
const logger = require('../utils/logger');

// Import config properly
let config: any;
try {
  config = require('../config').default || require('../config');
} catch (e) {
  config = require('../config');
}

// Mark as module
export {};

// Pakasir API Base URL
const PAKASIR_API_URL = 'https://app.pakasir.com/api';

// Supported payment methods
const PAKASIR_PAYMENT_METHODS = [
  'qris',
  'cimb_niaga_va',
  'bni_va',
  'sampoerna_va',
  'bnc_va',
  'maybank_va',
  'permata_va',
  'atm_bersama_va',
  'artha_graha_va',
  'bri_va'
] as const;

type PakasirPaymentMethod = typeof PAKASIR_PAYMENT_METHODS[number];

interface PakasirTransactionResponse {
  success: boolean;
  data?: {
    qr_string: string;
    qr_image_url?: string;
    payment_number?: string;
    invoice_id: string;
    amount: number;
    fee: number;
    total_payment: number;
    expired_at: string;
    payment_method: 'pakasir';
  };
  error?: string;
}

interface PakasirPaymentStatus {
  success: boolean;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  invoice_id?: string;
  amount?: number;
  paid_at?: string;
  payment_method?: string;
  error?: string;
}

interface PakasirApiResponse {
  payment?: {
    project: string;
    order_id: string;
    amount: number;
    fee: number;
    total_payment: number;
    payment_method: string;
    payment_number: string;
    expired_at: string;
  };
  transaction?: {
    amount: number;
    order_id: string;
    project: string;
    status: string;
    payment_method: string;
    completed_at?: string;
  };
  error?: string;
}

/**
 * Check if Pakasir is configured
 * @returns true if Pakasir credentials are available
 */
function isPakasirConfigured(): boolean {
  const isConfigured = !!(config.PAKASIR_PROJECT && config.PAKASIR_API_KEY);
  logger.info(`Pakasir config check: PROJECT=${config.PAKASIR_PROJECT ? 'set' : 'not set'}, API_KEY=${config.PAKASIR_API_KEY ? 'set' : 'not set'}, configured=${isConfigured}`);
  return isConfigured;
}

/**
 * Generate Pakasir payment
 * @param amount - Payment amount in IDR
 * @param userId - User ID for reference
 * @param method - Payment method (default: qris)
 * @returns Pakasir response with payment data
 */
async function generatePakasirPayment(
  amount: number,
  userId: string,
  method: PakasirPaymentMethod = 'qris'
): Promise<PakasirTransactionResponse> {
  try {
    if (!isPakasirConfigured()) {
      return {
        success: false,
        error: 'Pakasir payment gateway not configured'
      };
    }

    const orderId = `ORDER-${Date.now()}-${userId}`;
    
    logger.info(`Generating Pakasir payment for amount: ${amount}, user: ${userId}, method: ${method}`);

    const requestBody = {
      project: config.PAKASIR_PROJECT,
      order_id: orderId,
      amount: amount,
      api_key: config.PAKASIR_API_KEY
    };

    const response = await axios.post(
      `${PAKASIR_API_URL}/transactioncreate/${method}`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const apiResponse: PakasirApiResponse = response.data;

    if (apiResponse.payment) {
      const payment = apiResponse.payment;
      
      logger.info(`Pakasir payment created successfully: ${orderId}`);
      
      // Generate QR image URL for QRIS payments
      let qrImageUrl: string | undefined;
      if (method === 'qris' && payment.payment_number) {
        qrImageUrl = generateQRImageURL(payment.payment_number);
      }

      return {
        success: true,
        data: {
          qr_string: payment.payment_number,
          qr_image_url: qrImageUrl,
          payment_number: payment.payment_number,
          invoice_id: orderId,
          amount: payment.amount,
          fee: payment.fee,
          total_payment: payment.total_payment,
          expired_at: payment.expired_at,
          payment_method: 'pakasir'
        }
      };
    } else {
      throw new Error(apiResponse.error || 'Failed to create Pakasir payment');
    }
  } catch (error: any) {
    logger.error('Error generating Pakasir payment:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to generate Pakasir payment'
    };
  }
}

/**
 * Check Pakasir payment status
 * @param orderId - Order ID to check
 * @param amount - Original transaction amount
 * @returns Payment status
 */
async function checkPakasirPaymentStatus(orderId: string, amount: number): Promise<PakasirPaymentStatus> {
  try {
    if (!isPakasirConfigured()) {
      return {
        success: false,
        status: 'failed',
        error: 'Pakasir payment gateway not configured'
      };
    }

    logger.info(`Checking Pakasir payment status for order: ${orderId}`);

    const response = await axios.get(
      `${PAKASIR_API_URL}/transactiondetail`,
      {
        params: {
          project: config.PAKASIR_PROJECT,
          amount: amount,
          order_id: orderId,
          api_key: config.PAKASIR_API_KEY
        },
        timeout: 10000
      }
    );

    const apiResponse: PakasirApiResponse = response.data;

    if (apiResponse.transaction) {
      const transaction = apiResponse.transaction;
      
      // Map Pakasir status to our standard status
      let status: 'pending' | 'paid' | 'expired' | 'failed' = 'pending';
      
      if (transaction.status === 'completed') {
        status = 'paid';
      } else if (transaction.status === 'expired') {
        status = 'expired';
      } else if (transaction.status === 'cancelled' || transaction.status === 'failed') {
        status = 'failed';
      }

      logger.info(`Pakasir status for ${orderId}: ${transaction.status} -> ${status}`);

      return {
        success: true,
        status: status,
        invoice_id: orderId,
        amount: transaction.amount,
        paid_at: transaction.completed_at,
        payment_method: transaction.payment_method
      };
    } else {
      // Transaction not found, might still be pending
      return {
        success: true,
        status: 'pending',
        invoice_id: orderId
      };
    }
  } catch (error: any) {
    // If 404, transaction might still be pending
    if (error.response?.status === 404) {
      logger.warn(`Order ${orderId} not found in Pakasir (might still be pending)`);
      return {
        success: true,
        status: 'pending',
        invoice_id: orderId
      };
    }

    logger.error('Error checking Pakasir payment status:', error.response?.data || error.message);
    return {
      success: false,
      status: 'failed',
      error: error.response?.data?.error || error.message
    };
  }
}

/**
 * Cancel Pakasir payment
 * @param orderId - Order ID to cancel
 * @param amount - Transaction amount
 * @returns Success status
 */
async function cancelPakasirPayment(orderId: string, amount: number): Promise<boolean> {
  try {
    if (!isPakasirConfigured()) {
      return false;
    }

    logger.info(`Cancelling Pakasir payment: ${orderId}`);

    const requestBody = {
      project: config.PAKASIR_PROJECT,
      order_id: orderId,
      amount: amount,
      api_key: config.PAKASIR_API_KEY
    };

    await axios.post(
      `${PAKASIR_API_URL}/transactioncancel`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    logger.info(`Pakasir payment cancelled: ${orderId}`);
    return true;
  } catch (error: any) {
    logger.error('Error cancelling Pakasir payment:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Simulate Pakasir payment (for sandbox/testing)
 * @param orderId - Order ID to simulate payment for
 * @param amount - Transaction amount
 * @returns Success status
 */
async function simulatePakasirPayment(orderId: string, amount: number): Promise<boolean> {
  try {
    if (!isPakasirConfigured()) {
      return false;
    }

    logger.info(`Simulating Pakasir payment: ${orderId}`);

    const requestBody = {
      project: config.PAKASIR_PROJECT,
      order_id: orderId,
      amount: amount,
      api_key: config.PAKASIR_API_KEY
    };

    await axios.post(
      `${PAKASIR_API_URL}/paymentsimulation`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    logger.info(`Pakasir payment simulation completed: ${orderId}`);
    return true;
  } catch (error: any) {
    logger.error('Error simulating Pakasir payment:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Generate URL-based payment link (alternative to API)
 * @param amount - Payment amount
 * @param orderId - Order ID
 * @param options - Additional options
 * @returns Payment URL
 */
function generatePakasirPaymentURL(
  amount: number,
  orderId: string,
  options?: {
    redirectUrl?: string;
    qrisOnly?: boolean;
    usePaypal?: boolean;
  }
): string | null {
  if (!config.PAKASIR_PROJECT) {
    return null;
  }

  const baseUrl = options?.usePaypal 
    ? `https://app.pakasir.com/paypal/${config.PAKASIR_PROJECT}/${amount}`
    : `https://app.pakasir.com/pay/${config.PAKASIR_PROJECT}/${amount}`;

  const params = new URLSearchParams();
  params.append('order_id', orderId);

  if (options?.redirectUrl) {
    params.append('redirect', options.redirectUrl);
  }

  if (options?.qrisOnly) {
    params.append('qris_only', '1');
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate QR code image URL from string
 * @param qrString - QRIS string
 * @returns QR code image URL
 */
function generateQRImageURL(qrString: string): string {
  const encodedQR = encodeURIComponent(qrString);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedQR}`;
}

/**
 * Get available Pakasir payment methods
 * @returns Array of available payment methods
 */
function getAvailablePaymentMethods(): typeof PAKASIR_PAYMENT_METHODS {
  return PAKASIR_PAYMENT_METHODS;
}

module.exports = {
  isPakasirConfigured,
  generatePakasirPayment,
  checkPakasirPaymentStatus,
  cancelPakasirPayment,
  simulatePakasirPayment,
  generatePakasirPaymentURL,
  generateQRImageURL,
  getAvailablePaymentMethods,
  PAKASIR_PAYMENT_METHODS
};
