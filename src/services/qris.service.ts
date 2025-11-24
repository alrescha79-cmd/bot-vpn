import type { BotContext } from "../types";
/**
 * @fileoverview QRIS Payment Service
 * Handles QRIS payment generation and verification
 * 
 * API Documentation: https://docs.qris.id (adjust based on your provider)
 */

const axios = require('axios');
const logger = require('../utils/logger');

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

    // Check if QRIS credentials are configured
    if (!config.MERCHANT_ID || !config.API_KEY) {
      logger.error('Midtrans credentials not configured');
      return {
        success: false,
        error: 'QRIS payment system not configured. Please contact administrator.'
      };
    }

    // Generate unique order ID
    const orderId = `ORDER-${Date.now()}-${userId}`;
    
    // Midtrans API Configuration
    const isProduction = process.env.MIDTRANS_ENV === 'production';
    const apiUrl = isProduction 
      ? 'https://api.midtrans.com/v2/charge'
      : 'https://api.sandbox.midtrans.com/v2/charge';
    
    // Create server key authorization (Base64 encoded)
    const serverKey = config.API_KEY; // Midtrans Server Key
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
          expired_at: response.data.transaction_time // Midtrans doesn't return expiry, use transaction time
        }
      };
    } else {
      throw new Error(response.data?.status_message || 'Failed to generate QRIS via Midtrans');
    }
  } catch (error: any) {
    logger.error('Error generating QRIS via Midtrans:', error.response?.data || error.message);
    
    // Fallback: Use static QRIS if API fails
    if (config.DATA_QRIS) {
      logger.warn('Using static QRIS as fallback');
      const orderId = `ORDER-${Date.now()}-${userId}`;
      return {
        success: true,
        data: {
          qr_string: config.DATA_QRIS,
          invoice_id: orderId,
          amount: amount,
          expired_at: new Date(Date.now() + 30 * 60000).toISOString()
        }
      };
    }
    
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
async function checkPaymentStatus(invoiceId: string): Promise<PaymentStatus> {
  try {
    logger.info(`Checking payment status for order: ${invoiceId}`);

    if (!config.API_KEY) {
      return {
        success: false,
        status: 'failed',
        error: 'Midtrans credentials not configured'
      };
    }

    // Midtrans Status Check API
    const isProduction = process.env.MIDTRANS_ENV === 'production';
    const apiUrl = isProduction 
      ? `https://api.midtrans.com/v2/${invoiceId}/status`
      : `https://api.sandbox.midtrans.com/v2/${invoiceId}/status`;
    
    const serverKey = config.API_KEY;
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
 * @returns true if QRIS is properly configured
 */
function isQRISConfigured(): boolean {
  return !!(config.MERCHANT_ID && config.API_KEY && config.DATA_QRIS);
}

module.exports = {
  generateQRIS,
  checkPaymentStatus,
  generateQRImageURL,
  isQRISConfigured
};
