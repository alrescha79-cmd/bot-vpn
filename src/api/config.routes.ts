/**
 * Configuration API Routes
 * Provides REST API for configuration management and payment webhooks
 */

import { Router, Request, Response } from 'express';
const { configService } = require('../services/config.service');
const { handleMidtransNotification } = require('./midtrans.webhook');
const { handlePakasirNotification } = require('./pakasir.webhook');
const { handleTripayNotification } = require('./tripay.webhook');
const { handleDuitkuNotification } = require('./duitku.webhook');

const router = Router();

/**
 * GET /api/config
 * Get current configuration status and data
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    const status = configService.getConfigStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Error getting config:', error);
    res.status(500).json({
      error: 'Failed to read configuration',
      message: error.message
    });
  }
});

/**
 * POST /api/config
 * Save configuration
 */
router.post('/config', (req: Request, res: Response) => {
  try {
    const config = req.body;

    if (!config || Object.keys(config).length === 0) {
      return res.status(400).json({
        error: 'Configuration data is required'
      });
    }

    // Save configuration
    configService.writeConfig(config);

    res.json({
      success: true,
      message: 'Konfigurasi berhasil disimpan!'
    });
  } catch (error: any) {
    console.error('Error saving config:', error);
    res.status(400).json({
      error: 'Failed to save configuration',
      message: error.message
    });
  }
});

/**
 * POST /api/tripay/notification
 * Handle payment notification from Tripay webhook
 */
router.post('/tripay/notification', (req: Request, res: Response) => {
  const bot = (req as any).app.get('bot');
  handleTripayNotification(req, res, bot);
});

/**
 * POST /api/duitku/notification
 * Handle payment notification from Duitku webhook
 */
router.post('/duitku/notification', (req: Request, res: Response) => {
  const bot = (req as any).app.get('bot');
  handleDuitkuNotification(req, res, bot);
});

/**
 * POST /api/midtrans/notification
 * Handle payment notification from Midtrans webhook
 */
router.post('/midtrans/notification', (req: Request, res: Response) => {
  const bot = (req as any).app.get('bot');
  handleMidtransNotification(req, res, bot);
});

/**
 * POST /api/pakasir/notification
 * Handle payment notification from Pakasir webhook
 */
router.post('/pakasir/notification', (req: Request, res: Response) => {
  const bot = (req as any).app.get('bot');
  handlePakasirNotification(req, res, bot);
});

// Export using CommonJS for compatibility with index.js
module.exports = router;
