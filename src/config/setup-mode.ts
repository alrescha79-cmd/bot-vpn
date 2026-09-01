/**
 * Setup Mode Handler
 * Manages initial application setup and configuration wizard
 */

import fs from 'fs';
import path from 'path';
import express, { Express, Request, Response, NextFunction } from 'express';
const { configService } = require('../services/config.service');

const SETUP_HTML_PATH = path.resolve(__dirname, '../frontend/config-setup.html');

/**
 * Check if app is in setup mode
 */
export function isSetupMode(): boolean {
  // If config already loaded and isSetupMode is false, we are NOT in setup mode
  const currentConfig = require('./index').default || require('./index');
  if (currentConfig && !currentConfig.isSetupMode) {
    return false;
  }
  return !configService.isConfigured();
}

/**
 * Setup mode middleware
 * Redirects to setup page if configuration doesn't exist
 */
export function setupModeMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip for setup-related routes
  if (req.path.startsWith('/api/config') || req.path === '/setup') {
    return next();
  }

  // Check if in setup mode
  if (isSetupMode()) {
    // Redirect to setup page
    return res.redirect('/setup');
  }

  next();
}

/**
 * Configure setup routes
 */
export function configureSetupRoutes(app: Express): void {
  // Setup page route
  app.get('/setup', (req: Request, res: Response) => {
    if (fs.existsSync(SETUP_HTML_PATH)) {
      res.sendFile(SETUP_HTML_PATH);
    } else {
      res.status(404).send('Setup page not found');
    }
  });

  // Config edit page route (same page, different mode)
  app.get('/config/edit', (req: Request, res: Response) => {
    if (fs.existsSync(SETUP_HTML_PATH)) {
      res.sendFile(SETUP_HTML_PATH);
    } else {
      res.status(404).send('Config page not found');
    }
  });

  // Health check endpoint (doesn't require config)
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      setupMode: isSetupMode(),
      timestamp: new Date().toISOString()
    });
  });
}

/**
 * Log setup mode status
 */
export function logSetupStatus(port?: number): void {
  const actualPort = port || 50123;
  
  if (isSetupMode()) {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔧 APPLICATION IN SETUP MODE');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Configuration file not found.');
    console.log('Please complete the initial setup:');
    console.log('');
    console.log(`👉 Setup Page: http://localhost:${actualPort}/setup`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  } else {
    console.log('✅ Configuration loaded successfully');
  }
}

// CommonJS export for compatibility
module.exports = {
  isSetupMode,
  setupModeMiddleware,
  configureSetupRoutes,
  logSetupStatus
};
