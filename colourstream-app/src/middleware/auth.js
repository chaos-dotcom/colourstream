const bcrypt = require('bcrypt');

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.redirect('/admin/login');
    }
};

// Admin credentials validation middleware
const validateAdminCredentials = async (username, password) => {
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    if (!adminUsername || !adminPassword) {
        throw new Error('Admin credentials not configured');
    }

    // For simplicity, we're doing a direct comparison since the credentials are from env
    // In a production environment, you would want to hash these passwords
    return username === adminUsername && password === adminPassword;
};

// Rate limiting for login attempts
const loginAttempts = new Map();

const rateLimitLogin = (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    
    if (loginAttempts.has(ip)) {
        const attempts = loginAttempts.get(ip);
        
        // Clear old attempts (older than 15 minutes)
        const recentAttempts = attempts.filter(time => now - time < 15 * 60 * 1000);
        
        if (recentAttempts.length >= 5) {
            return res.status(429).render('error', {
                error: 'Too many login attempts. Please try again in 15 minutes.'
            });
        }
        
        loginAttempts.set(ip, [...recentAttempts, now]);
    } else {
        loginAttempts.set(ip, [now]);
    }
    
    next();
};

// Clear successful login attempts
const clearLoginAttempts = (ip) => {
    loginAttempts.delete(ip);
};

module.exports = {
    authenticateAdmin,
    validateAdminCredentials,
    rateLimitLogin,
    clearLoginAttempts
};
