import type { BotContext } from "../types";
/**
 * @fileoverview QRIS Payment Service
 * Handles QRIS payment generation and verification
 * 
 * API Documentation: https://docs.qris.id (adjust based on your provider)
 */

const axios = require('axios');
const logger = require('../utils/logger');
const qrisDinamis = require('@agungjsp/qris-dinamis');

// Import config properly
let config: any;
try {
  config = require('../config').default || require('../config');
} catch (e) {
  config = require('../config');
}

interface QRISResponse {
  success: boolean;
  data?: {
    qr_string: string;
    qr_image_url?: string;
    invoice_id: string;
    amount: number;
    expired_at: string;
    payment_method?: 'midtrans' | 'static_qris';
  };
  error?: string;
}

interface PaymentStatus {
  success: boolean;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  invoice_id?: string;
  amount?: number;
  paid_at?: string;
  error?: string;
}

/**
 * Generate QRIS payment
 * @param amount - Payment amount in IDR
 * @param userId - User ID for reference
 * @returns QRIS response with QR code data
 */
async function generateQRIS(amount: number, userId: string): Promise<QRISResponse> {
  try {
    logger.info(`Generating QRIS for amount: ${amount}, user: ${userId}`);

    // Generate unique order ID
    const orderId = `ORDER-${Date.now()}-${userId}`;

    // Check if Midtrans credentials are configured (priority)
    if (config.MERCHANT_ID && config.SERVER_KEY) {
      logger.info('Using Midtrans payment gateway');

      // Midtrans API Configuration
      const isProduction = process.env.MIDTRANS_ENV === 'production';
      const apiUrl = isProduction
        ? 'https://api.midtrans.com/v2/charge'
        : 'https://api.sandbox.midtrans.com/v2/charge';

      // Create server key authorization (Base64 encoded)
      const serverKey = config.SERVER_KEY; // Midtrans Server Key
      const authString = Buffer.from(serverKey + ':').toString('base64');

      // Midtrans Charge Request
      const requestBody = {
        payment_type: 'gopay',
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        gopay: {
          enable_callback: true,
          callback_url: `http://localhost:${config.PORT}/api/payment/callback`
        },
        customer_details: {
          first_name: `User`,
          last_name: userId,
          email: `user${userId}@telegram.local`,
          phone: '08123456789'
        }
      };

      logger.info(`Calling Midtrans API (Merchant: ${config.MERCHANT_ID}):`, apiUrl);

      try {
        const response = await axios.post(apiUrl, requestBody, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authString}`
          },
          timeout: 15000
        });

        if (response.data && response.data.status_code === '201') {
          logger.info(`QRIS generated successfully via Midtrans: ${orderId}`);

          // Extract QR code string and actions
          const qrString = response.data.actions?.find((a: any) => a.name === 'generate-qr-code')?.url || '';
          const deeplink = response.data.actions?.find((a: any) => a.name === 'deeplink-redirect')?.url || '';

          return {
            success: true,
            data: {
              qr_string: qrString,
              qr_image_url: qrString, // Midtrans provides QR image URL directly
              invoice_id: orderId,
              amount: amount,
              expired_at: response.data.transaction_time,
              payment_method: 'midtrans'
            }
          };
        } else {
          throw new Error(response.data?.status_message || 'Failed to generate QRIS via Midtrans');
        }
      } catch (midtransError: any) {
        logger.error('Midtrans API error:', midtransError.response?.data || midtransError.message);

        // Fallback to static QRIS if Midtrans fails and DATA_QRIS is available
        if (config.DATA_QRIS) {
          logger.warn('Midtrans failed, falling back to static QRIS');
          return {
            success: true,
            data: {
              qr_string: config.DATA_QRIS,
              invoice_id: orderId,
              amount: amount,
              expired_at: new Date(Date.now() + 24 * 60 * 60000).toISOString(), // 24 hours for static
              payment_method: 'static_qris'
            }
          };
        }

        throw midtransError;
      }
    }

    // Use static QRIS if Midtrans credentials not available
    if (config.DATA_QRIS) {
      logger.info('Using static QRIS payment (no Midtrans credentials)');

      try {
        // Generate dynamic QRIS with amount embedded using @agungjsp/qris-dinamis
        // API: makeString(qris, { nominal: 'amount' })
        const dynamicQRIS = qrisDinamis.makeString(config.DATA_QRIS, {
          nominal: amount.toString()
        });

        logger.info(`Generated dynamic QRIS with amount: ${amount}`);

        return {
          success: true,
          data: {
            qr_string: dynamicQRIS,
            invoice_id: orderId,
            amount: amount,
            expired_at: new Date(Date.now() + 24 * 60 * 60000).toISOString(), // 24 hours for manual verification
            payment_method: 'static_qris'
          }
        };
      } catch (qrisError: any) {
        logger.error('Error generating dynamic QRIS:', qrisError.message);
        // Fallback to original static QRIS if dynamic generation fails
        logger.warn('Falling back to original static QRIS (user must input amount manually)');
        return {
          success: true,
          data: {
            qr_string: config.DATA_QRIS,
            invoice_id: orderId,
            amount: amount,
            expired_at: new Date(Date.now() + 24 * 60 * 60000).toISOString(),
            payment_method: 'static_qris'
          }
        };
      }
    }

    // No payment method available
    logger.error('No payment method configured (neither Midtrans nor static QRIS)');
    return {
      success: false,
      error: 'Payment system not configured. Please contact administrator.'
    };
  } catch (error: any) {
    logger.error('Error generating QRIS:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.status_message || error.message || 'Failed to generate QRIS code'
    };
  }
}

/**
 * Check payment status
 * @param invoiceId - Invoice ID to check
 * @returns Payment status
 */
async function checkPaymentStatus(invoiceId: string, paymentMethod?: string): Promise<PaymentStatus> {
  try {
    logger.info(`Checking payment status for order: ${invoiceId}, method: ${paymentMethod || 'unknown'}`);

    // For static QRIS, check database status (manual verification)
    if (paymentMethod === 'static_qris' || !config.SERVER_KEY) {
      // Static QRIS requires manual verification, return pending until admin approves
      const { getPendingDeposit } = require('../repositories/depositRepository');
      const deposit = await getPendingDeposit(invoiceId);

      if (!deposit) {
        return {
          success: false,
          status: 'failed',
          error: 'Deposit not found'
        };
      }

      // Map database status to payment status
      let status: 'pending' | 'paid' | 'expired' | 'failed' = 'pending';
      if (deposit.status === 'paid') {
        status = 'paid';
      } else if (deposit.status === 'awaiting_verification') {
        status = 'pending'; // Show as pending to user
      } else if (deposit.status === 'rejected') {
        status = 'failed';
      } else if (deposit.status === 'expired') {
        status = 'expired';
      }

      return {
        success: true,
        status: status,
        invoice_id: invoiceId,
        amount: deposit.amount
      };
    }

    // For Midtrans, check via API
    const isProduction = process.env.MIDTRANS_ENV === 'production';
    const apiUrl = isProduction
      ? `https://api.midtrans.com/v2/${invoiceId}/status`
      : `https://api.sandbox.midtrans.com/v2/${invoiceId}/status`;

    const serverKey = config.SERVER_KEY;
    const authString = Buffer.from(serverKey + ':').toString('base64');

    const response = await axios.get(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`
      },
      timeout: 10000
    });

    if (response.data) {
      // Midtrans transaction status mapping
      const transactionStatus = response.data.transaction_status;
      const fraudStatus = response.data.fraud_status;

      let status: 'pending' | 'paid' | 'expired' | 'failed' = 'pending';

      if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
        if (fraudStatus === 'accept') {
          status = 'paid';
        }
      } else if (transactionStatus === 'pending') {
        status = 'pending';
      } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
        status = transactionStatus === 'expire' ? 'expired' : 'failed';
      }

      logger.info(`Midtrans status for ${invoiceId}: ${transactionStatus} -> ${status}`);

      return {
        success: true,
        status: status,
        invoice_id: invoiceId,
        amount: parseInt(response.data.gross_amount),
        paid_at: response.data.settlement_time || response.data.transaction_time
      };
    } else {
      throw new Error('Invalid response from Midtrans');
    }
  } catch (error: any) {
    // If order not found, it might be pending
    if (error.response?.status === 404) {
      logger.warn(`Order ${invoiceId} not found in Midtrans (might still be pending)`);
      return {
        success: true,
        status: 'pending',
        invoice_id: invoiceId
      };
    }

    logger.error('Error checking payment status:', error.response?.data || error.message);
    return {
      success: false,
      status: 'failed',
      error: error.response?.data?.status_message || error.message
    };
  }
}

/**
 * Generate QR code image from string
 * Uses a free QR code generator API
 * @param qrString - QRIS string
 * @returns QR code image URL
 */
function generateQRImageURL(qrString: string): string {
  // Use free QR code generator API
  const encodedQR = encodeURIComponent(qrString);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedQR}`;
}

/**
 * Validate QRIS configuration
 * @returns true if any QRIS payment method is properly configured
 */
function isQRISConfigured(): boolean {
  // Return true if either Midtrans OR static QRIS is configured
  return !!((config.MERCHANT_ID && config.SERVER_KEY) || config.DATA_QRIS);
}

/**
 * Check if static QRIS is configured
 * @returns true if static QRIS is available (with or without Midtrans)
 */
function isStaticQRISConfigured(): boolean {
  return !!(config.DATA_QRIS && !config.MERCHANT_ID && !config.SERVER_KEY);
}

module.exports = {
  generateQRIS,
  checkPaymentStatus,
  generateQRImageURL,
  isQRISConfigured,
  isStaticQRISConfigured
};
