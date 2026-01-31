const { User, sequelize } = require('../../models');
const { Op } = require('sequelize');
const BotService = require('../bot/bot.service');

class UserService {
    async createUser(id_telegram, username) {
        // Only create if not exists. If exists, do nothing (or update username).
        // Using findOrCreate to be safe.
        // Special case: if id_telegram is null or undefined, we might be creating via username pre-auth (BUT we need a placeholder ID? No, this won't work well without ID. 
        // Logic change: If we pre-authorize by username, we might not have ID yet.
        // Hmmm, the prompt says: "Se o usuário ainda não existir no banco de dados, essa função será chamada quando o administrador liberar o acesso, mesmo que o usuário não tenha interagido com o bot."
        // AND "O sistema deve ser capaz de receber qualquer um dos dois" (ID or Username).
        // IF we only have username, we can create a user record with NULL id_telegram? No, id_telegram is PK. 
        // Strategy: 
        // If we only have username, we create the user with a temporary negative ID or we allow id_telegram to be nullable?
        // Prompt says: `id_telegram`: (INTEGER, UNIQUE, NOT NULL). So we MUST have an ID.
        // Wait, if admin enables via username, we don't know the ID yet. 
        // Re-reading prompt: "O back-end deve tentar obter o @username do usuário a partir do ID do Telegram...". 
        // "Permitir a liberação de acesso para usuários mesmo que eles nunca tenham interagido com o bot... o administrador pode liberar o acesso a um usuário com base no ID do Telegram ou @username".
        // If the admin provides @username ONLY, we CANNOT know the Telegram ID. Telegram API doesn't allow looking up ID by username easily without user interaction or a user bot (not simple bot). 
        // HOWEVER, maybe the requirement assumes we *can* or that we just store the username and wait for the match?
        // Let's look at the Model again: `id_telegram` is NOT NULL. 
        // If I create a user with just username, I can't fill id_telegram.
        // I will MODIFY the logic to allow `id_telegram` to be 0 or dynamic if not known? No, that breaks uniqueness.
        // Alternative: The user might enter the ID manually (it's visible in some clients). 
        // BUT if the admin enters valid @username, and we don't have ID, maybe we defer creation?
        // NO, prompt says "O sistema deve criar automaticamente uma entrada no banco de dados".
        // Let's assume for now that if only Username is provided for Pre-Auth, we search if a user with that username ALREADY exists (maybe they interacted but were not allowed?). 
        // If they NEVER interacted and we only have username, we technically cannot create a valid User record with a real Telegram ID.
        // WORKAROUND: We might need a separate mechanism or the Admin MUST provide the ID if the user hasn't interacted. 
        // OR, simply allow `id_telegram` to be nullable? The prompt specified `NOT NULL`.
        // Let's stick to the most robust path:
        // 1. If Admin provides ID: easy.
        // 2. If Admin provides Username: Find user by username. If found, update allowed. If NOT found... well, we can't create a record without ID.
        // UNLESS we use a placeholder ID? But that's risky.
        // Wait, maybe I can make id_telegram explicitly NOT the primary key in Sequelize but use a generic ID? 
        // No, the prompt spec is strict: `id_telegram`: (INTEGER, UNIQUE, NOT NULL).
        // I will implement `allowUser` such that if only username is given and user not found, it throws an error saying "User not found. To whitelist by username, the user must have interacted at least once OR you must provide the Telegram ID."
        // ...Actually, looking at `allowUser` spec: "Se o usuário não existir, a função createUser deve ser chamada implicitamente ANTES de permitir o acesso."
        // This implies creating a user. 
        // I will implement a trick: If we don't have ID, we can't create. 
        // Let's re-read CAREFULLY: "Permitir a liberação de acesso para usuários mesmo que eles nunca tenham interagido com o bot."
        // If the admin uses ID, it works (we create user with ID, username null).
        // If admin uses Username, we are stuck without ID.
        // I will assume for now the Admin will provide ID if the user is completely new. If they verify by username, it might be they are looking up an existing (but unauthorized) user?
        // Or maybe I relax the constraint on my own? No, constraints are requirements.
        // Let's proceed with: `createUser` needs ID. `allowUser` tries to resolve.

        // Actually, let's assume `id_telegram` IS required for creation.
        // If allowUser is called with username, we try to find. If not found, we CANNOT create without ID. We will return error.

        try {
            const [user, created] = await User.findOrCreate({
                where: { id_telegram },
                defaults: { username }
            });
            if (!created && username) {
                user.username = username; // Update username if provided
                await user.save();
            }
            return user;
        } catch (error) {
            throw error;
        }
    }

    async updateUsername(id_telegram, username) {
        return await User.update({ username }, { where: { id_telegram } });
    }

    async allowUser(id_telegramOrUsername, startDate, endDate) {
        let user;
        const isId = /^\d+$/.test(id_telegramOrUsername); // Check if it's all numbers

        if (isId) {
            const id = id_telegramOrUsername;
            user = await User.findOne({ where: { id_telegram: id } });
            if (!user) {
                // Create if not exists with ID
                user = await User.create({ id_telegram: id, allowed: true, start_date: startDate, end_date: endDate });
            }
        } else {
            // It's a username
            let username = id_telegramOrUsername.replace('@', '');
            user = await User.findOne({ where: { username } });
            if (!user) {
                throw new Error("Cannot pre-authorize by username alone if user has never interacted (ID unknown). Please provide Telegram ID.");
            }
        }

        user.allowed = true;
        user.start_date = startDate;
        user.end_date = endDate;
        return await user.save();
    }

    // Refined `allowUser` based on strict requirement:
    // "O sistema deve ser capaz de receber qualquer um dos dois"
    // "Permitir a liberação de acesso para usuários mesmo que eles nunca tenham interagido com o bot."
    // If I really MUST support username-only creation, I would need to change the schema to allow null ID or use a UUID PK.
    // Given the constraints:
    // I will stick to the logic: Try to find. If ID provided -> Create. If Username provided -> Must exist. 
    // This is the only technical possibility without changing the schema provided in prompt.

    async revokeUser(id_telegramOrUsername) {
        let where = {};
        if (/^\d+$/.test(id_telegramOrUsername)) {
            where = { id_telegram: id_telegramOrUsername };
        } else {
            where = { username: id_telegramOrUsername.replace('@', '') };
        }

        return await User.update({ allowed: false, start_date: null, end_date: null }, { where });
    }

    async removeUser(id_telegram) {
        return await User.destroy({ where: { id_telegram } });
    }

    async listUsers() {
        return await User.findAll({
            attributes: ['id_telegram', 'username', 'allowed', 'start_date', 'end_date', 'last_interaction']
            // Sorting by last interaction usually helpful
        });
    }

    async getUser(id_telegram) {
        return await User.findOne({ where: { id_telegram } });
    }

    async getUserByUsername(username) {
        return await User.findOne({ where: { username: username.replace('@', '') } });
    }

    async updateLastInteraction(id_telegram) {
        return await User.update({ last_interaction: new Date() }, { where: { id_telegram } });
    }
}

module.exports = new UserService();
