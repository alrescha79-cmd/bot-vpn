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
MANUAL_CONFIG=false
SETUP_PUBLIC_ACCESS=false

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
        --manual-config)
            MANUAL_CONFIG=true
            shift
            ;;
        --public-access)
            SETUP_PUBLIC_ACCESS=true
            shift
            ;;
        --help)
            echo "Bot VPN Production Installer"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --version VERSION    Specify version to install (default: latest)"
            echo "  --path PATH         Installation path (default: /var/www/bot-vpn)"
            echo "  --manual-config     Setup configuration manually via terminal prompts"
            echo "  --public-access     Setup firewall and nginx for public web access"
            echo "  --help              Show this help message"
            echo ""
            echo "Example:"
            echo "  $0 --version v1.0.0 --path /opt/bot-vpn"
            echo "  $0 --manual-config --public-access"
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

# Stop and remove existing PM2 process first
if command_exists pm2; then
    if pm2 list | grep -q "bot-vpn"; then
        log_info "Stopping and removing existing bot-vpn process..."
        pm2 stop bot-vpn 2>/dev/null || true
        pm2 delete bot-vpn 2>/dev/null || true
        log_success "Existing process removed"
    fi
fi

if [ -d "$INSTALL_PATH" ]; then
    log_warning "Directory ${INSTALL_PATH} already exists"
    
    # Check if it's an existing installation
    if [ -f "${INSTALL_PATH}/index.js" ]; then
        log_info "Existing installation detected - will perform clean reinstall"
        
        # Backup existing installation
        BACKUP_PATH="${INSTALL_PATH}.backup.$(date +%Y%m%d_%H%M%S)"
        log_info "Creating backup: ${BACKUP_PATH}"
        
        if command_exists sudo && [ ! -w "$INSTALL_PATH" ]; then
            sudo cp -r "$INSTALL_PATH" "$BACKUP_PATH"
        else
            cp -r "$INSTALL_PATH" "$BACKUP_PATH"
        fi
        
        log_success "Backup created successfully"
        
        # Preserve config and data unless manual config is requested
        if [ "$MANUAL_CONFIG" = false ]; then
            if [ -f "${INSTALL_PATH}/.vars.json" ]; then
                log_info "Preserving existing configuration..."
                cp "${INSTALL_PATH}/.vars.json" "/tmp/.vars.json.preserve"
            fi
        else
            log_info "Manual config requested - will not preserve old configuration"
        fi
        
        if [ -d "${INSTALL_PATH}/data" ]; then
            log_info "Preserving existing database..."
            cp -r "${INSTALL_PATH}/data" "/tmp/data.preserve"
        fi
        
        # Remove old installation
        log_info "Removing old installation..."
        if command_exists sudo && [ ! -w "$INSTALL_PATH" ]; then
            sudo rm -rf "$INSTALL_PATH"
        else
            rm -rf "$INSTALL_PATH"
        fi
        log_success "Old installation removed"
    fi
fi

# Create fresh directory
if command_exists sudo; then
    sudo mkdir -p "$INSTALL_PATH"
else
    mkdir -p "$INSTALL_PATH"
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

# Restore preserved config (only if not requesting manual config)
if [ -f "/tmp/.vars.json.preserve" ] && [ "$MANUAL_CONFIG" = false ]; then
    log_info "Restoring previous configuration..."
    cp "/tmp/.vars.json.preserve" "${INSTALL_PATH}/.vars.json"
    rm "/tmp/.vars.json.preserve"
    log_success "Configuration restored"
elif [ -f "/tmp/.vars.json.preserve" ]; then
    # Remove preserved config if manual config requested
    rm "/tmp/.vars.json.preserve"
    log_info "Previous config not restored (manual config mode)"
fi

# Restore preserved database
if [ -d "/tmp/data.preserve" ]; then
    log_info "Restoring previous database..."
    cp -r "/tmp/data.preserve" "${INSTALL_PATH}/data"
    rm -rf "/tmp/data.preserve"
    log_success "Database restored"
fi

###############################################################################
# Manual Configuration Setup Function
###############################################################################

setup_configuration() {
    log_info "Starting configuration setup..."
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}📝 Konfigurasi Awal Aplikasi${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Silakan masukkan informasi berikut untuk konfigurasi aplikasi."
    echo "Tekan Enter untuk menggunakan nilai default (jika ada)."
    echo ""
    
    # Redirect stdin from terminal for interactive input
    exec < /dev/tty
    
    # Prompt for each configuration value with better formatting
    echo -e "${BLUE}1. Bot Configuration${NC}"
    read -p "   Masukkan Bot Token Anda (dari @BotFather): " BOT_TOKEN
    while [ -z "$BOT_TOKEN" ]; do
        echo -e "   ${RED}Bot Token tidak boleh kosong!${NC}"
        read -p "   Masukkan Bot Token Anda: " BOT_TOKEN
    done
    
    echo ""
    echo -e "${BLUE}2. Admin Configuration${NC}"
    read -p "   Masukkan User ID Admin Anda (dapatkan dari @userinfobot): " USER_ID
    while [ -z "$USER_ID" ]; do
        echo -e "   ${RED}User ID tidak boleh kosong!${NC}"
        read -p "   Masukkan User ID Admin Anda: " USER_ID
    done
    
    read -p "   Masukkan Admin Username Anda (tanpa @): " ADMIN_USERNAME
    while [ -z "$ADMIN_USERNAME" ]; do
        echo -e "   ${RED}Admin Username tidak boleh kosong!${NC}"
        read -p "   Masukkan Admin Username Anda: " ADMIN_USERNAME
    done
    
    echo ""
    echo -e "${BLUE}3. Group & Store Configuration${NC}"
    read -p "   Masukkan Group ID (untuk notifikasi, kosongkan jika tidak ada): " GROUP_ID
    
    read -p "   Masukkan Nama Store Anda: " NAMA_STORE
    while [ -z "$NAMA_STORE" ]; do
        echo -e "   ${RED}Nama Store tidak boleh kosong!${NC}"
        read -p "   Masukkan Nama Store Anda: " NAMA_STORE
    done
    
    echo ""
    echo -e "${BLUE}4. Server Configuration${NC}"
    read -p "   Masukkan Port aplikasi (default: 50123): " PORT
    PORT=${PORT:-50123}
    
    echo ""
    echo -e "${BLUE}5. Payment Configuration (QRIS)${NC}"
    read -p "   Masukkan Data QRIS: " DATA_QRIS
    while [ -z "$DATA_QRIS" ]; do
        echo -e "   ${RED}Data QRIS tidak boleh kosong!${NC}"
        read -p "   Masukkan Data QRIS: " DATA_QRIS
    done
    
    read -p "   Masukkan Merchant ID: " MERCHANT_ID
    while [ -z "$MERCHANT_ID" ]; do
        echo -e "   ${RED}Merchant ID tidak boleh kosong!${NC}"
        read -p "   Masukkan Merchant ID: " MERCHANT_ID
    done
    
    read -p "   Masukkan API Key: " API_KEY
    while [ -z "$API_KEY" ]; do
        echo -e "   ${RED}API Key tidak boleh kosong!${NC}"
        read -p "   Masukkan API Key: " API_KEY
    done
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}Verifikasi Konfigurasi:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Bot Token       : ${BOT_TOKEN:0:10}..."
    echo "User ID Admin   : ${USER_ID}"
    echo "Admin Username  : ${ADMIN_USERNAME}"
    echo "Group ID        : ${GROUP_ID:-<tidak diisi>}"
    echo "Nama Store      : ${NAMA_STORE}"
    echo "Port            : ${PORT}"
    echo "Data QRIS       : ${DATA_QRIS:0:20}..."
    echo "Merchant ID     : ${MERCHANT_ID}"
    echo "API Key         : ${API_KEY:0:10}..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    read -p "Apakah konfigurasi sudah benar? (y/n): " CONFIRM
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo ""
        log_warning "Konfigurasi dibatalkan. Silakan jalankan script lagi dengan --manual-config"
        return 1
    fi
    
    # Create .vars.json file
    echo ""
    log_info "Membuat file konfigurasi..."
    cat > "${INSTALL_PATH}/.vars.json" <<EOF
{
  "BOT_TOKEN": "${BOT_TOKEN}",
  "USER_ID": "${USER_ID}",
  "GROUP_ID": "${GROUP_ID}",
  "NAMA_STORE": "${NAMA_STORE}",
  "PORT": "${PORT}",
  "DATA_QRIS": "${DATA_QRIS}",
  "MERCHANT_ID": "${MERCHANT_ID}",
  "API_KEY": "${API_KEY}",
  "ADMIN_USERNAME": "${ADMIN_USERNAME}"
}
EOF
    
    chmod 600 "${INSTALL_PATH}/.vars.json"
    log_success "File konfigurasi berhasil dibuat!"
    echo ""
    
    return 0
}

###############################################################################
# Ask User for Configuration Method
###############################################################################

ask_configuration_method() {
    # Only ask if no existing config and not already in manual config mode
    if [ ! -f "${INSTALL_PATH}/.vars.json" ]; then
        # Redirect stdin from terminal for interactive input
        exec < /dev/tty
        
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo -e "${YELLOW}⚙️  Metode Konfigurasi${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "Aplikasi perlu dikonfigurasi sebelum dapat digunakan."
        echo ""
        echo "Pilihan metode konfigurasi:"
        echo "  1. Konfigurasi Manual (via terminal) - Cepat & langsung"
        echo "  2. Konfigurasi via Web Interface - Lebih user-friendly"
        echo ""
        read -p "Apakah Anda ingin konfigurasi manual sekarang? (y/n): " SETUP_MANUAL
        echo ""
        
        if [[ "$SETUP_MANUAL" =~ ^[Yy]$ ]]; then
            MANUAL_CONFIG=true
            return 0
        else
            MANUAL_CONFIG=false
            return 1
        fi
    fi
    return 1
}

# Run manual config if flag is set OR user chooses manual config
if [ "$MANUAL_CONFIG" = true ]; then
    if [ ! -f "${INSTALL_PATH}/.vars.json" ]; then
        setup_configuration
    fi
else
    # Ask user for configuration method if no config exists
    ask_configuration_method
    if [ "$MANUAL_CONFIG" = true ] && [ ! -f "${INSTALL_PATH}/.vars.json" ]; then
        setup_configuration
    fi
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
# Setup Public Access (Firewall & Nginx)
###############################################################################

if [ "$SETUP_PUBLIC_ACCESS" = true ]; then
    log_info "Setting up public access..."
    echo ""
    
    # Get port from .vars.json if exists
    if [ -f "${INSTALL_PATH}/.vars.json" ]; then
        APP_PORT=$(grep -oP '"PORT":\s*"\K[^"]+' "${INSTALL_PATH}/.vars.json" 2>/dev/null || echo "50123")
    else
        APP_PORT="50123"
    fi
    
    # Setup UFW Firewall
    if command_exists ufw; then
        log_info "Configuring UFW firewall..."
        
        # Allow SSH (important!)
        if command_exists sudo; then
            sudo ufw allow 22/tcp >/dev/null 2>&1
            log_success "Allowed SSH (port 22)"
            
            # Allow application port
            sudo ufw allow ${APP_PORT}/tcp >/dev/null 2>&1
            log_success "Allowed application port ${APP_PORT}"
            
            # Allow HTTP and HTTPS for nginx
            sudo ufw allow 80/tcp >/dev/null 2>&1
            sudo ufw allow 443/tcp >/dev/null 2>&1
            log_success "Allowed HTTP (80) and HTTPS (443)"
            
            # Enable firewall if not already enabled
            echo "y" | sudo ufw enable >/dev/null 2>&1
            log_success "UFW firewall enabled"
        else
            log_warning "sudo not available, skipping firewall configuration"
        fi
    else
        log_warning "UFW not installed, skipping firewall setup"
    fi
    
    # Setup Nginx
    if ! command_exists nginx; then
        log_info "Installing Nginx..."
        if command_exists sudo; then
            sudo apt-get update -qq
            sudo apt-get install -y nginx >/dev/null 2>&1
            log_success "Nginx installed"
        else
            log_warning "Cannot install nginx without sudo"
        fi
    fi
    
    if command_exists nginx; then
        log_info "Configuring Nginx reverse proxy..."
        
        # Get server IP
        SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
        
        # Create nginx config
        NGINX_CONFIG="/etc/nginx/sites-available/bot-vpn"
        
        if command_exists sudo; then
            sudo tee "$NGINX_CONFIG" > /dev/null <<EOF
server {
    listen 80;
    server_name ${SERVER_IP} _;
    
    location / {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
            
            # Enable site
            sudo ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/bot-vpn 2>/dev/null
            
            # Remove default site if exists
            sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null
            
            # Test nginx config
            if sudo nginx -t >/dev/null 2>&1; then
                # Restart nginx
                sudo systemctl restart nginx
                log_success "Nginx configured and restarted"
                echo ""
                log_info "✅ Web interface now accessible at:"
                echo -e "   ${GREEN}http://${SERVER_IP}${NC}"
                echo -e "   ${GREEN}http://${SERVER_IP}/setup${NC} (for initial setup)"
                echo ""
            else
                log_error "Nginx configuration test failed"
            fi
        else
            log_warning "Cannot configure nginx without sudo"
        fi
    fi
    
    echo ""
fi

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
    echo -e "${YELLOW}⚠️  Konfigurasi Belum Selesai${NC}"
    echo ""
    echo "Aplikasi telah terinstal namun konfigurasi belum lengkap."
    echo ""
    echo "Silakan setup via Web Interface:"
    
    if [ "$SETUP_PUBLIC_ACCESS" = true ]; then
        SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
        echo -e "  ${BLUE}http://${SERVER_IP}/setup${NC}"
    else
        echo -e "  ${BLUE}http://YOUR_SERVER_IP:50123/setup${NC}"
    fi
    
    echo ""
    echo "Atau jalankan ulang script dengan flag --manual-config:"
    echo -e "  ${GREEN}curl -s https://raw.githubusercontent.com/alrescha79-cmd/bot-vpn/main/scripts/install-production.sh | bash -s -- --manual-config${NC}"
    echo ""
    
elif [ -f "${INSTALL_PATH}/.vars.json" ]; then
    echo -e "${GREEN}✅ Configuration Complete${NC}"
    echo ""
    
    # Check if this is fresh config (just created)
    CONFIG_AGE=$(($(date +%s) - $(stat -c %Y "${INSTALL_PATH}/.vars.json" 2>/dev/null || stat -f %m "${INSTALL_PATH}/.vars.json" 2>/dev/null || echo 0)))
    
    if [ $CONFIG_AGE -lt 60 ]; then
        # Config was just created (less than 60 seconds old)
        # Redirect stdin from terminal for interactive input
        exec < /dev/tty
        
        # Ask about database setup
        echo -e "${BLUE}📊 Setup Database${NC}"
        echo ""
        echo "Untuk menggunakan bot, Anda perlu diset sebagai admin di database."
        echo ""
        read -p "Apakah Anda ingin mengatur admin user di database sekarang? (y/n): " SETUP_DB
        echo ""
        
        if [[ "$SETUP_DB" =~ ^[Yy]$ ]]; then
            # Get USER_ID from config
            USER_ID=$(grep -oP '"USER_ID":\s*"\K[^"]+' "${INSTALL_PATH}/.vars.json" 2>/dev/null)
            
            log_info "Menunggu database siap..."
            sleep 3
            
            # Check if database exists
            if [ -f "${INSTALL_PATH}/data/botvpn.db" ]; then
                log_info "Setting up admin user in database..."
                
                # Use sqlite3 if available
                if command_exists sqlite3; then
                    sqlite3 "${INSTALL_PATH}/data/botvpn.db" "UPDATE users SET role = 'admin' WHERE user_id = '${USER_ID}';" 2>/dev/null || {
                        log_warning "Database belum siap atau user belum terdaftar."
                        log_info "Jalankan bot terlebih dahulu dengan /start, lalu jalankan:"
                        echo -e "  ${GREEN}sqlite3 ${INSTALL_PATH}/data/botvpn.db \"UPDATE users SET role = 'admin' WHERE user_id = '${USER_ID}';\"${NC}"
                    }
                else
                    log_warning "sqlite3 tidak terinstall."
                    log_info "Install dengan: sudo apt-get install sqlite3"
                    log_info "Lalu jalankan:"
                    echo -e "  ${GREEN}sqlite3 ${INSTALL_PATH}/data/botvpn.db \"UPDATE users SET role = 'admin' WHERE user_id = '${USER_ID}';\"${NC}"
                fi
            else
                log_info "Database akan dibuat otomatis saat aplikasi pertama kali dijalankan."
                log_info "Setelah bot berjalan dan Anda mengirim /start, jalankan:"
                echo -e "  ${GREEN}sqlite3 ${INSTALL_PATH}/data/botvpn.db \"UPDATE users SET role = 'admin' WHERE user_id = '${USER_ID}';\"${NC}"
            fi
            echo ""
        fi
        
        # Restart PM2 with new config
        log_info "Restarting application dengan konfigurasi baru..."
        pm2 restart bot-vpn
        sleep 2
        
        echo ""
        log_success "✅ Aplikasi berhasil dikonfigurasi dan direstart!"
        echo ""
        echo -e "${GREEN}🚀 Langkah selanjutnya:${NC}"
        echo "1. Buka Telegram dan chat bot Anda"
        echo "2. Kirim perintah /start"
        echo "3. Bot siap digunakan!"
        
        if [ "$SETUP_PUBLIC_ACCESS" = true ]; then
            SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
            echo ""
            echo "🌐 Web Interface:"
            echo -e "   ${BLUE}http://${SERVER_IP}${NC}"
            echo -e "   ${BLUE}http://${SERVER_IP}/config/edit${NC} (edit config)"
        fi
        echo ""
    else
        # Existing config (restored or old)
        echo "Aplikasi berjalan dengan konfigurasi yang ada."
        
        if [ "$SETUP_PUBLIC_ACCESS" = true ]; then
            SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
            echo ""
            echo "🌐 Web Interface:"
            echo -e "   ${BLUE}http://${SERVER_IP}${NC}"
            echo -e "   ${BLUE}http://${SERVER_IP}/config/edit${NC} (edit config)"
        fi
        echo ""
    fi
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
