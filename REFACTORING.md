# Refactored Structure Documentation

## 📁 Project Structure

The project has been refactored into a more maintainable and organized structure while maintaining all existing functionality.

```
bot-tele/
├── src/
│   ├── config/
│   │   ├── index.js          # Configuration loader
│   │   └── constants.js      # Application constants
│   ├── database/
│   │   ├── connection.js     # Database connection & promisified methods
│   │   ├── schema.js         # Database schema initialization
│   │   └── queries/
│   │       ├── users.js      # User-related queries
│   │       ├── servers.js    # Server-related queries
│   │       ├── transactions.js # Transaction queries
│   │       └── accounts.js   # Active account queries
│   ├── services/
│   │   ├── user.service.js   # User business logic
│   │   ├── reseller.service.js # Reseller & commission logic
│   │   └── ssh.service.js    # SSH connection management
│   ├── middleware/
│   │   ├── auth.js           # Authentication middleware
│   │   └── errorHandler.js   # Error handling middleware
│   ├── utils/
│   │   ├── logger.js         # Winston logger configuration
│   │   ├── markdown.js       # Markdown formatting helpers
│   │   ├── validation.js     # Input validation functions
│   │   └── keyboard.js       # Telegram keyboard builders
│   └── modules/
│       ├── index.js          # Protocol modules index
│       ├── renew.js          # General renew module
│       ├── stats.js          # Statistics module
│       └── protocols/
│           ├── ssh/          # SSH protocol handlers
│           ├── vmess/        # VMESS protocol handlers
│           ├── vless/        # VLESS protocol handlers
│           ├── trojan/       # TROJAN protocol handlers
│           └── shadowsocks/  # SHADOWSOCKS protocol handlers
├── modules/                  # (Legacy - can be removed after testing)
├── app.js                    # Main application (updated to use new structure)
├── app-old.js               # Original backup
├── .vars.json               # Configuration file
├── sellvpn.db               # SQLite database
└── package.json

```

## 🔄 What Was Refactored

### 1. **Configuration Management**
- **Before**: Configuration scattered in app.js with hardcoded values
- **After**: Centralized in `src/config/` with constants in separate file
- **Files**: 
  - `src/config/index.js` - Loads .vars.json
  - `src/config/constants.js` - All magic numbers and constants

### 2. **Database Layer**
- **Before**: Database operations mixed throughout app.js
- **After**: Separated into connection, schema, and query modules
- **Files**:
  - `src/database/connection.js` - Promisified DB methods
  - `src/database/schema.js` - Table initialization
  - `src/database/queries/*.js` - Organized query functions

### 3. **Business Logic (Services)**
- **Before**: Business logic embedded in command handlers
- **After**: Extracted to service classes
- **Files**:
  - `src/services/user.service.js` - User management
  - `src/services/reseller.service.js` - Commission & levels
  - `src/services/ssh.service.js` - SSH operations

### 4. **Middleware**
- **Before**: Auth checks repeated in every handler
- **After**: Reusable middleware functions
- **Files**:
  - `src/middleware/auth.js` - isAdmin, isReseller, rateLimit
  - `src/middleware/errorHandler.js` - Global error handling

### 5. **Utilities**
- **Before**: Helper functions scattered in app.js
- **After**: Organized utility modules
- **Files**:
  - `src/utils/logger.js` - Winston logger
  - `src/utils/markdown.js` - Text formatting
  - `src/utils/validation.js` - Input validation
  - `src/utils/keyboard.js` - Keyboard builders

### 6. **Protocol Modules**
- **Before**: Flat modules/ directory
- **After**: Organized by protocol type
- **Structure**: `src/modules/protocols/{protocol}/`

## 🚀 Usage Examples

### Using New Database Queries

```javascript
// Before
db.get('SELECT * FROM users WHERE user_id = ?', [userId], (err, user) => {
  if (err) {
    logger.error(err);
  } else {
    // do something
  }
});

// After
const UserQueries = require('./src/database/queries/users');
const user = await UserQueries.findById(userId);
```

### Using Services

```javascript
// Before
const komisi = Math.floor(totalHarga * 0.1);
db.run('INSERT INTO reseller_sales ...', ...);

// After
const ResellerService = require('./src/services/reseller.service');
const result = await ResellerService.recordSale({
  resellerId,
  buyerId,
  accountType,
  username,
  totalPrice
});
```

### Using Middleware

```javascript
// Before
bot.command('admin', async (ctx) => {
  if (!adminIds.includes(String(ctx.from.id))) {
    return ctx.reply('⛔ Admin only');
  }
  // handler code
});

// After
const { isAdmin } = require('./src/middleware/auth');
bot.command('admin', isAdmin, async (ctx) => {
  // handler code
});
```

### Using Constants

```javascript
// Before
const commission = Math.floor(price * 0.1);
if (trialCount >= 1) { ... }

// After
const { COMMISSION_RATE, DAILY_TRIAL_LIMITS } = require('./src/config/constants');
const commission = Math.floor(price * COMMISSION_RATE);
if (trialCount >= DAILY_TRIAL_LIMITS.user) { ... }
```

## ✅ Testing

After refactoring, test these key features:

1. **Bot Startup**: `node app.js` should start without errors
2. **Commands**: Test /start, /menu, /admin
3. **Create Account**: Test account creation flow
4. **Trial System**: Test trial account creation
5. **Reseller Functions**: Test commission recording
6. **Database**: Verify all queries work correctly

## 🔄 Migration Guide

### Step 1: Install & Test
```bash
# Backup is already created as app-old.js
node app.js
```

### Step 2: Gradually Update Handlers (Optional)
You can now gradually refactor command handlers to use the new services:

```javascript
// Example: Refactor a command handler
bot.command('saldo', async (ctx) => {
  const UserService = require('./src/services/user.service');
  const user = await UserService.getUserById(ctx.from.id);
  // ...
});
```

### Step 3: Remove Old Files (After Testing)
Once everything works:
```bash
rm -rf modules/  # Remove old modules directory
rm app-old.js    # Remove backup if not needed
```

## 📚 Key Improvements

1. **Maintainability**: Code organized by concern
2. **Reusability**: Services and utilities can be reused
3. **Testability**: Each module can be tested independently
4. **Readability**: Clear structure and naming conventions
5. **Scalability**: Easy to add new features
6. **Type Safety**: JSDoc comments for better IDE support

## 🐛 Troubleshooting

### Error: Cannot find module './src/...'
- Ensure all files in src/ are created
- Check file paths in require() statements

### Database errors
- Database structure unchanged
- All original db operations preserved
- Check `src/database/connection.js` is properly imported

### Bot not responding
- Check logger output in `bot-combined.log`
- Verify .vars.json is properly configured
- Ensure all protocol modules are in place

## 📝 Notes

- **Backward Compatibility**: app.js still works with existing database
- **No Breaking Changes**: All existing functionality preserved
- **Legacy Code**: Original app.js backed up as app-old.js
- **Gradual Migration**: Can adopt new patterns gradually

## 🎯 Next Steps

1. Test all functionality thoroughly
2. Update documentation for new services
3. Consider adding unit tests
4. Gradually refactor remaining handlers
5. Add TypeScript definitions (optional)
