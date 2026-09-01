import type { BotContext } from "../types";
/**
 * @fileoverview QRIS & Multi-Gateway Payment Service
 * Handles QRIS payment generation and verification across Tripay, Duitku, Pakasir, Midtrans, and Static QRIS
 */

const axios = require('axios');
const logger = require('../utils/logger');
const qrisDinamis = require('@agungjsp/qris-dinamis');

// Import Payment Gateway Services
const { isTripayConfigured, generateTripayPayment, checkTripayPaymentStatus } = require('./tripay.service');
const { isDuitkuConfigured, generateDuitkuPayment, checkDuitkuPaymentStatus } = require('./duitku.service');
const { isPakasirConfigured, generatePakasirPayment, checkPakasirPaymentStatus } = require('./pakasir.service');

// Import config properly
let config: any;
try {
  config = require('../config').default || require('../config');
} catch (e) {
  config = require('../config');
}

export type PaymentGatewayType = 'tripay' | 'duitku' | 'pakasir' | 'midtrans' | 'static_qris';

export interface QRISResponse {
  success: boolean;
  data?: {
    qr_string: string;
    qr_image_url?: string;
    invoice_id: string;
    amount: number;
    expired_at: string;
    payment_method?: PaymentGatewayType;
    fee?: number;
    total_payment?: number;
    checkout_url?: string;
  };
  error?: string;
}

export interface PaymentStatus {
  success: boolean;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  invoice_id?: string;
  amount?: number;
  paid_at?: string;
  error?: string;
}

/**
 * Generate QRIS / Payment through active gateway
 * Priority: Tripay -> Duitku -> Pakasir -> Midtrans -> Static QRIS
 * @param amount - Payment amount in IDR
 * @param userId - User ID for reference
 */
async function generateQRIS(amount: number, userId: string): Promise<QRISResponse> {
  try {
    logger.info(`Generating QRIS/Payment for amount: ${amount}, user: ${userId}`);
    const orderId = `ORDER-${Date.now()}-${userId}`;

    // 1. Tripay (Priority 1)
    if (isTripayConfigured()) {
      logger.info('Using Tripay payment gateway');
      const tripayRes = await generateTripayPayment(amount, userId, 'QRIS2');
      if (tripayRes.success && tripayRes.data) {
        const d = tripayRes.data;
        const qrString = d.qr_string || d.pay_code || '';
        const qrImg = d.qr_url || (qrString ? generateQRImageURL(qrString) : undefined);
        const expDate = d.expired_time ? new Date(d.expired_time * 1000).toISOString() : new Date(Date.now() + 30 * 60000).toISOString();

        return {
          success: true,
          data: {
            qr_string: qrString,
            qr_image_url: qrImg,
            invoice_id: d.merchant_ref,
            amount: d.amount,
            fee: d.fee,
            total_payment: d.total_amount,
            expired_at: expDate,
            payment_method: 'tripay',
            checkout_url: d.checkout_url
          }
        };
      }
      logger.warn('Tripay generation failed, attempting next configured gateway:', tripayRes.error);
    }

    // 2. Duitku (Priority 2)
    if (isDuitkuConfigured()) {
      logger.info('Using Duitku payment gateway');
      const duitkuRes = await generateDuitkuPayment(amount, userId, 'SP');
      if (duitkuRes.success && duitkuRes.data) {
        const d = duitkuRes.data;
        const qrString = d.qr_string || d.payment_url;
        return {
          success: true,
          data: {
            qr_string: qrString,
            qr_image_url: generateQRImageURL(qrString),
            invoice_id: d.invoice_id,
            amount: d.amount,
            expired_at: new Date(Date.now() + 30 * 60000).toISOString(),
            payment_method: 'duitku',
            checkout_url: d.payment_url
          }
        };
      }
      logger.warn('Duitku generation failed, attempting next configured gateway:', duitkuRes.error);
    }

    // 3. Pakasir (Priority 3)
    if (isPakasirConfigured()) {
      logger.info('Using Pakasir payment gateway');
      const pakasirRes = await generatePakasirPayment(amount, userId, 'qris');
      if (pakasirRes.success && pakasirRes.data) {
        return {
          success: true,
          data: {
            qr_string: pakasirRes.data.qr_string,
            qr_image_url: pakasirRes.data.qr_image_url,
            invoice_id: pakasirRes.data.invoice_id,
            amount: pakasirRes.data.amount,
            fee: pakasirRes.data.fee,
            total_payment: pakasirRes.data.total_payment,
            expired_at: pakasirRes.data.expired_at,
            payment_method: 'pakasir'
          }
        };
      }
      logger.warn('Pakasir generation failed, attempting next configured gateway:', pakasirRes.error);
    }

    // 4. Midtrans (Priority 4)
    if (config.MERCHANT_ID && config.SERVER_KEY) {
      logger.info('Using Midtrans payment gateway');
      const isProduction = process.env.MIDTRANS_ENV === 'production';
      const apiUrl = isProduction
        ? 'https://api.midtrans.com/v2/charge'
        : 'https://api.sandbox.midtrans.com/v2/charge';

      const authString = Buffer.from(config.SERVER_KEY + ':').toString('base64');
      const requestBody = {
        payment_type: 'gopay',
        transaction_details: {
          order_id: orderId,
          gross_amount: amount
        },
        gopay: {
          enable_callback: true,
          callback_url: `http://localhost:${config.PORT || 50123}/api/payment/callback`
        },
        customer_details: {
          first_name: 'User',
          last_name: userId,
          email: `user${userId}@telegram.vpn`,
          phone: '081234567890'
        }
      };

      try {
        const response = await axios.post(apiUrl, requestBody, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Basic ${authString}`
          },
          timeout: 15000
        });

        if (response.data && response.data.status_code === '201') {
          const qrString = response.data.actions?.find((a: any) => a.name === 'generate-qr-code')?.url || '';
          return {
            success: true,
            data: {
              qr_string: qrString,
              qr_image_url: qrString,
              invoice_id: orderId,
              amount: amount,
              expired_at: response.data.transaction_time || new Date(Date.now() + 30 * 60000).toISOString(),
              payment_method: 'midtrans'
            }
          };
        }
      } catch (midtransErr: any) {
        logger.warn('Midtrans API failed:', midtransErr.response?.data || midtransErr.message);
      }
    }

    // 5. Static QRIS Dinamis (Fallback)
    if (config.DATA_QRIS) {
      logger.info('Using dynamic/static QRIS fallback');
      try {
        const dynamicQRIS = qrisDinamis.makeString(config.DATA_QRIS, {
          nominal: amount.toString()
        });

        return {
          success: true,
          data: {
            qr_string: dynamicQRIS,
            qr_image_url: generateQRImageURL(dynamicQRIS),
            invoice_id: orderId,
            amount: amount,
            expired_at: new Date(Date.now() + 24 * 60 * 60000).toISOString(),
            payment_method: 'static_qris'
          }
        };
      } catch (qrisError: any) {
        logger.warn('Error generating dynamic QRIS string, using raw QRIS:', qrisError.message);
        return {
          success: true,
          data: {
            qr_string: config.DATA_QRIS,
            qr_image_url: generateQRImageURL(config.DATA_QRIS),
            invoice_id: orderId,
            amount: amount,
            expired_at: new Date(Date.now() + 24 * 60 * 60000).toISOString(),
            payment_method: 'static_qris'
          }
        };
      }
    }

    return {
      success: false,
      error: 'Tidak ada metode pembayaran yang dikonfigurasi. Hubungi Admin.'
    };
  } catch (error: any) {
    logger.error('Error generating QRIS:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message || 'Gagal membuat QRIS pembayaran'
    };
  }
}

/**
 * Check payment status across gateways
 */
async function checkPaymentStatus(invoiceId: string, paymentMethod?: string): Promise<PaymentStatus> {
  try {
    logger.info(`Checking status for ${invoiceId} (method: ${paymentMethod || 'auto'})`);

    if (paymentMethod === 'tripay' || (!paymentMethod && isTripayConfigured())) {
      const res = await checkTripayPaymentStatus(invoiceId);
      if (res.success) return res;
    }

    if (paymentMethod === 'duitku' || (!paymentMethod && isDuitkuConfigured())) {
      const res = await checkDuitkuPaymentStatus(invoiceId);
      if (res.success) return res;
    }

    if (paymentMethod === 'pakasir' || (!paymentMethod && isPakasirConfigured())) {
      const { getPendingDeposit } = require('../repositories/depositRepository');
      const deposit = await getPendingDeposit(invoiceId);
      if (deposit) {
        return await checkPakasirPaymentStatus(invoiceId, deposit.amount);
      }
    }

    if (paymentMethod === 'static_qris') {
      const { getPendingDeposit } = require('../repositories/depositRepository');
      const deposit = await getPendingDeposit(invoiceId);
      if (!deposit) return { success: false, status: 'failed', error: 'Deposit not found' };

      let status: 'pending' | 'paid' | 'expired' | 'failed' = 'pending';
      if (deposit.status === 'paid') status = 'paid';
      else if (deposit.status === 'rejected') status = 'failed';
      else if (deposit.status === 'expired') status = 'expired';

      return { success: true, status: status, invoice_id: invoiceId, amount: deposit.amount };
    }

    if (paymentMethod === 'midtrans' || (config.MERCHANT_ID && config.SERVER_KEY)) {
      const isProduction = process.env.MIDTRANS_ENV === 'production';
      const apiUrl = isProduction
        ? `https://api.midtrans.com/v2/${invoiceId}/status`
        : `https://api.sandbox.midtrans.com/v2/${invoiceId}/status`;

      const authString = Buffer.from(config.SERVER_KEY + ':').toString('base64');
      const response = await axios.get(apiUrl, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Basic ${authString}`
        },
        timeout: 10000
      });

      if (response.data) {
        const txStatus = response.data.transaction_status;
        const fraudStatus = response.data.fraud_status;
        let status: 'pending' | 'paid' | 'expired' | 'failed' = 'pending';

        if (txStatus === 'capture' || txStatus === 'settlement') {
          if (fraudStatus === 'accept' || !fraudStatus) status = 'paid';
        } else if (txStatus === 'pending') {
          status = 'pending';
        } else if (txStatus === 'deny' || txStatus === 'cancel' || txStatus === 'expire') {
          status = txStatus === 'expire' ? 'expired' : 'failed';
        }

        return {
          success: true,
          status: status,
          invoice_id: invoiceId,
          amount: parseInt(response.data.gross_amount),
          paid_at: response.data.settlement_time || response.data.transaction_time
        };
      }
    }

    return {
      success: true,
      status: 'pending',
      invoice_id: invoiceId
    };
  } catch (error: any) {
    if (error.response?.status === 404) {
      return { success: true, status: 'pending', invoice_id: invoiceId };
    }
    logger.error('Error checking payment status:', error.response?.data || error.message);
    return {
      success: false,
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * Generate QR code image from string via fast CDN
 */
function generateQRImageURL(qrString: string): string {
  const encodedQR = encodeURIComponent(qrString);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedQR}`;
}

/**
 * Check if any payment gateway is configured
 */
function isQRISConfigured(): boolean {
  return !!(
    isTripayConfigured() ||
    isDuitkuConfigured() ||
    isPakasirConfigured() ||
    (config.MERCHANT_ID && config.SERVER_KEY) ||
    config.DATA_QRIS
  );
}

/**
 * Get active payment method name
 */
function getActivePaymentMethod(): string {
  if (isTripayConfigured()) return 'Tripay';
  if (isDuitkuConfigured()) return 'Duitku';
  if (isPakasirConfigured()) return 'Pakasir';
  if (config.MERCHANT_ID && config.SERVER_KEY) return 'Midtrans';
  if (config.DATA_QRIS) return 'Static QRIS';
  return 'Not configured';
}

module.exports = {
  generateQRIS,
  checkPaymentStatus,
  generateQRImageURL,
  isQRISConfigured,
  getActivePaymentMethod
};
