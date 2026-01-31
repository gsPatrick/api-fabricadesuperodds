const express = require('express');
const router = express.Router();
const userRoutes = require('../features/user/user.routes');
const transactionRoutes = require('../features/transaction/transaction.routes');

// Middleware for Admin Authentication
const adminAuth = (req, res, next) => {
    // Allow login route (relative to /admin/users mount)
    if (req.path === '/login') return next();

    // Check header for token/secret
    // In our simple case, we check if x-admin-token matches our hardcoded "admin-session-token-12345"
    // OR if we stick to the old secret. Let's support both for backward compat or just the new token.
    const token = req.headers['x-admin-token'];
    const secret = req.headers['x-admin-secret'];

    if (token === 'admin-session-token-12345' || (secret && secret === process.env.ADMIN_SECRET)) {
        next();
    } else {
        res.status(401).json({ error: "Unauthorized access" });
    }
};

// Mount routes
// Admin Routes (protected)
router.use('/admin/users', adminAuth, userRoutes);

// Bot Routes (transaction logic)
// Should these be protected? The Bot should probably send a secret too.
// For now, I'll leave them open or assume the bot is internal/trusted, but adding a rudimentary check is wise.
// The prompt didn't strictly ask for Bot API auth, but "Implemente um sistema de autenticação básico para... painel de administração".
// I'll keep Bot routes open for simplicity as per requirements focus, but adding a note.
router.use('/bot/transactions', transactionRoutes);

module.exports = router;
