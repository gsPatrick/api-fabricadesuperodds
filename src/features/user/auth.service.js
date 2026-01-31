require('dotenv').config();

class AuthService {
    login(email, password) {
        // Strict check against env vars
        if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
            // Return a simple "token" (in a real app, use JWT). 
            // We'll trust the frontend to send this back or just set a session.
            // For this task, we'll return a static secret token that means "logged in".
            return { token: 'admin-session-token-12345', user: { email, name: 'Admin' } };
        }
        throw new Error('Credenciais inválidas');
    }
}

module.exports = new AuthService();
