/**
 * Protocol Modules Index
 * Centralized export for all VPN protocol handlers
 */

// SSH
const { createssh } = require('./protocols/ssh/createSSH');
const { renewssh } = require('./protocols/ssh/renewSSH');
const { trialssh } = require('./protocols/ssh/trialSSH');

// VMESS
const { createvmess } = require('./protocols/vmess/createVMESS');
const { renewvmess } = require('./protocols/vmess/renewVMESS');
const { trialvmess } = require('./protocols/vmess/trialVMESS');

// VLESS
const { createvless } = require('./protocols/vless/createVLESS');
const { renewvless } = require('./protocols/vless/renewVLESS');
const { trialvless } = require('./protocols/vless/trialVLESS');

// TROJAN
const { createtrojan } = require('./protocols/trojan/createTROJAN');
const { renewtrojan } = require('./protocols/trojan/renewTROJAN');
const { trialtrojan } = require('./protocols/trojan/trialTROJAN');

// SHADOWSOCKS
const { createshadowsocks } = require('./protocols/shadowsocks/createSHADOWSOCKS');
const { renewshadowsocks } = require('./protocols/shadowsocks/renewSHADOWSOCKS');
const { trialshadowsocks } = require('./protocols/shadowsocks/trialSHADOWSOCKS');

module.exports = {
  // SSH
  createssh,
  renewssh,
  trialssh,
  
  // VMESS
  createvmess,
  renewvmess,
  trialvmess,
  
  // VLESS
  createvless,
  renewvless,
  trialvless,
  
  // TROJAN
  createtrojan,
  renewtrojan,
  trialtrojan,
  
  // SHADOWSOCKS
  createshadowsocks,
  renewshadowsocks,
  trialshadowsocks
};
