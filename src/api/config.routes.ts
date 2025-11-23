/**
 * Configuration API Routes
 * Provides REST API for configuration management
 */

import { Router, Request, Response } from 'express';
const { configService } = require('../services/config.service');

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

// Export using CommonJS for compatibility with index.js
module.exports = router;
