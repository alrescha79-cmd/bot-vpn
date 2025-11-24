#!/bin/bash

###############################################################################
# Bot VPN - Production Auto Installer
# 
# This script automatically installs and configures the Bot VPN application
# on a production server.
#
# Usage:
#   ./install-production.sh [--version v1.0.0] [--path /var/www/bot-vpn]
#
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_INSTALL_PATH="/var/www/bot-vpn"
DEFAULT_VERSION="latest"
REPO_OWNER="alrescha79-cmd"
REPO_NAME="bot-vpn"
NODE_VERSION="20"

# Parse command line arguments
INSTALL_PATH="${DEFAULT_INSTALL_PATH}"
VERSION="${DEFAULT_VERSION}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --path)
            INSTALL_PATH="$2"
            shift 2
            ;;
        --help)
            echo "Bot VPN Production Installer"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --version VERSION   Specify version to install (default: latest)"
            echo "  --path PATH        Installation path (default: /var/www/bot-vpn)"
            echo "  --help             Show this help message"
            echo ""
            echo "Example:"
            echo "  $0 --version v1.0.0 --path /opt/bot-vpn"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

###############################################################################
# Helper Functions
###############################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

###############################################################################
# Pre-flight Checks
###############################################################################

log_info "Starting Bot VPN Production Installer..."
echo ""

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    log_warning "Running as root. This is not recommended for security reasons."
    log_info "Consider running as a regular user with sudo privileges."
fi

# Check OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    log_success "OS detected: Linux"
else
    log_error "Unsupported OS: $OSTYPE"
    log_info "This script is designed for Linux systems only."
    exit 1
fi

###############################################################################
# Install Dependencies
###############################################################################

log_info "Checking and installing dependencies..."

# Update package list (if sudo available)
if command_exists sudo; then
    log_info "Updating package list..."
    sudo apt-get update -qq || log_warning "Could not update package list"
fi

# Check and install Node.js
if command_exists node; then
    CURRENT_NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    log_success "Node.js is already installed (version: $(node --version))"
    
    if [ "$CURRENT_NODE_VERSION" -lt "$NODE_VERSION" ]; then
        log_warning "Node.js version is older than recommended (v${NODE_VERSION})"
        log_info "Consider upgrading Node.js for better compatibility"
    fi
else
    log_info "Installing Node.js v${NODE_VERSION}..."
    
    if command_exists sudo; then
        # Install Node.js using NodeSource
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        sudo apt-get install -y nodejs
        log_success "Node.js installed successfully"
    else
        log_error "Node.js is not installed and sudo is not available"
        log_info "Please install Node.js manually: https://nodejs.org/"
        exit 1
    fi
fi

# Check npm
if command_exists npm; then
    log_success "npm is available (version: $(npm --version))"
else
    log_error "npm is not installed"
    exit 1
fi

# Check/install required tools
for tool in curl wget unzip tar; do
    if ! command_exists $tool; then
        log_info "Installing $tool..."
        if command_exists sudo; then
            sudo apt-get install -y $tool
        else
            log_error "$tool is required but not installed"
            exit 1
        fi
    fi
done

# Check/install PM2
if ! command_exists pm2; then
    log_info "Installing PM2 process manager..."
    if command_exists sudo; then
        sudo npm install -g pm2
        log_success "PM2 installed successfully"
    else
        npm install -g pm2
        log_success "PM2 installed successfully"
    fi
else
    log_success "PM2 is already installed"
fi

###############################################################################
# Download Release
###############################################################################

log_info "Preparing to download Bot VPN ${VERSION}..."

# Get download URL
if [ "$VERSION" = "latest" ]; then
    log_info "Fetching latest release information..."
    RELEASE_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest"
    
    # Get latest version and download URL
    RELEASE_DATA=$(curl -s "$RELEASE_URL")
    VERSION=$(echo "$RELEASE_DATA" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
    DOWNLOAD_URL=$(echo "$RELEASE_DATA" | grep '"browser_download_url":.*tar.gz"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
    
    if [ -z "$VERSION" ] || [ -z "$DOWNLOAD_URL" ]; then
        log_error "Could not fetch latest release information"
        log_info "Please check your internet connection or specify a version manually"
        exit 1
    fi
    
    log_info "Latest version: ${VERSION}"
else
    # Construct download URL for specific version
    DOWNLOAD_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${VERSION}/bot-vpn-production-${VERSION}.tar.gz"
fi

log_info "Download URL: ${DOWNLOAD_URL}"

###############################################################################
# Create Installation Directory
###############################################################################

log_info "Creating installation directory: ${INSTALL_PATH}"

if [ -d "$INSTALL_PATH" ]; then
    log_warning "Directory ${INSTALL_PATH} already exists"
    
    # Check if it's an existing installation
    if [ -f "${INSTALL_PATH}/index.js" ]; then
        log_info "Existing installation detected"
        
        # Backup existing installation
        BACKUP_PATH="${INSTALL_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
        log_info "Creating backup: ${BACKUP_PATH}"
        
        if command_exists sudo && [ ! -w "$INSTALL_PATH" ]; then
            sudo cp -r "$INSTALL_PATH" "$BACKUP_PATH"
        else
            cp -r "$INSTALL_PATH" "$BACKUP_PATH"
        fi
        
        log_success "Backup created successfully"
        
        # Preserve config and data
        if [ -f "${INSTALL_PATH}/.vars.json" ]; then
            log_info "Preserving existing configuration..."
            cp "${INSTALL_PATH}/.vars.json" "/tmp/.vars.json.preserve"
        fi
        
        if [ -d "${INSTALL_PATH}/data" ]; then
            log_info "Preserving existing database..."
            cp -r "${INSTALL_PATH}/data" "/tmp/data.preserve"
        fi
    fi
else
    if command_exists sudo; then
        sudo mkdir -p "$INSTALL_PATH"
    else
        mkdir -p "$INSTALL_PATH"
    fi
fi

# Ensure we have write permissions
if [ ! -w "$INSTALL_PATH" ]; then
    if command_exists sudo; then
        sudo chown -R $(whoami):$(whoami) "$INSTALL_PATH"
    else
        log_error "No write permission to ${INSTALL_PATH}"
        exit 1
    fi
fi

###############################################################################
# Download and Extract
###############################################################################

log_info "Downloading Bot VPN ${VERSION}..."

TEMP_DIR=$(mktemp -d)
ARCHIVE_FILE="${TEMP_DIR}/bot-vpn-production.tar.gz"

# Download the release
if ! curl -L -o "$ARCHIVE_FILE" "$DOWNLOAD_URL"; then
    log_error "Failed to download release"
    log_info "Please check the version number and your internet connection"
    rm -rf "$TEMP_DIR"
    exit 1
fi

log_success "Download completed"

# Verify download
if [ ! -f "$ARCHIVE_FILE" ]; then
    log_error "Downloaded file not found"
    rm -rf "$TEMP_DIR"
    exit 1
fi

FILE_SIZE=$(du -h "$ARCHIVE_FILE" | cut -f1)
log_info "Downloaded file size: ${FILE_SIZE}"

# Extract archive
log_info "Extracting files to ${INSTALL_PATH}..."

if ! tar -xzf "$ARCHIVE_FILE" -C "$INSTALL_PATH"; then
    log_error "Failed to extract archive"
    rm -rf "$TEMP_DIR"
    exit 1
fi

log_success "Files extracted successfully"

# Cleanup temp files
rm -rf "$TEMP_DIR"

###############################################################################
# Restore Configuration and Data
###############################################################################

# Restore preserved config
if [ -f "/tmp/.vars.json.preserve" ]; then
    log_info "Restoring previous configuration..."
    cp "/tmp/.vars.json.preserve" "${INSTALL_PATH}/.vars.json"
    rm "/tmp/.vars.json.preserve"
    log_success "Configuration restored"
fi

# Restore preserved database
if [ -d "/tmp/data.preserve" ]; then
    log_info "Restoring previous database..."
    cp -r "/tmp/data.preserve" "${INSTALL_PATH}/data"
    rm -rf "/tmp/data.preserve"
    log_success "Database restored"
fi

###############################################################################
# Install Dependencies
###############################################################################

log_info "Installing application dependencies..."

cd "$INSTALL_PATH"

# Install production dependencies only
if ! npm install --omit=dev; then
    log_error "Failed to install dependencies"
    exit 1
fi

log_success "Dependencies installed successfully"

###############################################################################
# Setup Application
###############################################################################

# Create data directory if not exists
if [ ! -d "${INSTALL_PATH}/data" ]; then
    log_info "Creating data directory..."
    mkdir -p "${INSTALL_PATH}/data"
fi

# Set correct permissions
chmod 755 "${INSTALL_PATH}/data"
if [ -f "${INSTALL_PATH}/data/botvpn.db" ]; then
    chmod 644 "${INSTALL_PATH}/data/botvpn.db"
fi

# Set permissions for config file if exists
if [ -f "${INSTALL_PATH}/.vars.json" ]; then
    chmod 600 "${INSTALL_PATH}/.vars.json"
fi

###############################################################################
# PM2 Setup
###############################################################################

log_info "Setting up PM2 process manager..."

# Stop existing process if running
if pm2 list | grep -q "bot-vpn"; then
    log_info "Stopping existing bot-vpn process..."
    pm2 stop bot-vpn
    pm2 delete bot-vpn
fi

# Start with PM2
log_info "Starting application with PM2..."
cd "$INSTALL_PATH"
pm2 start index.js --name bot-vpn

# Save PM2 process list
pm2 save

# Setup auto-start on reboot (only once)
if ! pm2 startup | grep -q "already configured"; then
    log_info "Setting up PM2 auto-start on reboot..."
    
    # Get startup command
    STARTUP_CMD=$(pm2 startup | grep "sudo env" | tail -1)
    
    if [ -n "$STARTUP_CMD" ]; then
        log_info "Please run the following command to enable auto-start:"
        echo ""
        echo -e "${GREEN}${STARTUP_CMD}${NC}"
        echo ""
    fi
fi

log_success "PM2 setup completed"

###############################################################################
# Post-Installation Steps
###############################################################################

echo ""
log_success "✅ Installation completed successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}📦 Bot VPN ${VERSION} has been installed${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📁 Installation path: ${INSTALL_PATH}"
echo ""

# Check if configuration exists
if [ ! -f "${INSTALL_PATH}/.vars.json" ]; then
    echo -e "${YELLOW}⚠️  Configuration Required${NC}"
    echo ""
    echo "This is a fresh installation. Please complete the setup:"
    echo ""
    echo "1. The application is now running in setup mode"
    echo "2. Open your browser and navigate to:"
    echo ""
    echo -e "   ${BLUE}http://YOUR_SERVER_IP:50123/setup${NC}"
    echo ""
    echo "3. Fill in the configuration form with:"
    echo "   - Telegram Bot Token (from @BotFather)"
    echo "   - Admin User ID"
    echo "   - Group ID"
    echo "   - Store name and payment details"
    echo ""
    echo "4. After saving, restart the application:"
    echo -e "   ${GREEN}pm2 restart bot-vpn${NC}"
    echo ""
else
    echo -e "${GREEN}✅ Configuration found${NC}"
    echo ""
    echo "The application is running with existing configuration."
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📝 Useful Commands:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Check status:    pm2 status bot-vpn"
echo "  View logs:       pm2 logs bot-vpn"
echo "  Restart app:     pm2 restart bot-vpn"
echo "  Stop app:        pm2 stop bot-vpn"
echo "  Monitor:         pm2 monit"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📚 Documentation:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Deployment:  ${INSTALL_PATH}/docs/DEPLOYMENT.md"
echo "  Quick Start: ${INSTALL_PATH}/docs/QUICKSTART.md"
echo "  Troubleshooting: ${INSTALL_PATH}/docs/TROUBLESHOOTING.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check application status
sleep 2
echo ""
log_info "Checking application status..."
pm2 status bot-vpn

echo ""
log_success "Installation script completed! 🚀"
echo ""
