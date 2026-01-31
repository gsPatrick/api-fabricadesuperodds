const UserService = require('./user.service');
const AuthService = require('./auth.service');
const AnalyticsService = require('../transaction/analytics.service');

class UserController {
    async login(req, res) {
        try {
            const { email, password } = req.body;
            const result = AuthService.login(email, password);
            res.json(result);
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    }

    async getAnalytics(req, res) {
        try {
            const stats = await AnalyticsService.getDashboardStats();
            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Admin Panel Actions
    async listUsers(req, res) {
        try {
            const users = await UserService.listUsers();
            res.json(users);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async allowUser(req, res) {
        try {
            const { id_telegramOrUsername, startDate, endDate } = req.body;
            if (!id_telegramOrUsername) {
                return res.status(400).json({ error: "id_telegramOrUsername is required" });
            }
            const user = await UserService.allowUser(id_telegramOrUsername, startDate, endDate);
            res.json(user);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async createInvite(req, res) {
        try {
            const { days = 30, name } = req.body;
            const { Invite } = require('../../models');

            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24); // Token valid for 24h

            const invite = await Invite.create({
                name,
                days,
                expires_at: expiresAt
            });

            // Construct Link
            const botUser = process.env.BOT_USERNAME || 'FabricaSuperOddsBot';
            const link = `https://t.me/${botUser}?start=${invite.token}`;

            res.json({ link, token: invite.token, expires_at: expiresAt, name: invite.name });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to generate invite link" });
        }
    }

    async revokeUser(req, res) {
        try {
            const { id_telegramOrUsername } = req.body;
            if (!id_telegramOrUsername) {
                return res.status(400).json({ error: "id_telegramOrUsername is required" });
            }
            const result = await UserService.revokeUser(id_telegramOrUsername);
            res.json({ message: "Access revoked", result });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async removeUser(req, res) {
        try {
            const { id_telegram } = req.body; // Can also take from Params depending on route design. Let's assume body for safety.
            if (!id_telegram) {
                return res.status(400).json({ error: "id_telegram is required" });
            }
            await UserService.removeUser(id_telegram);
            res.json({ message: "User removed" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // Internal/Bot use: Update info if needed?
    // Probably not exposed via HTTP mostly, or maybe used by Bot to sync username?
    // We'll leave it simple for now. 
}

module.exports = new UserController();
