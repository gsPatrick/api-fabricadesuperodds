const express = require('express');
const router = express.Router();
const UserController = require('./user.controller');

// Public Auth
router.post('/login', UserController.login);

// Protected Routes (Applied via main index middleware)
router.get('/analytics', UserController.getAnalytics);
router.get('/', UserController.listUsers);
router.post('/allow', UserController.allowUser);
router.post('/invite', UserController.createInvite);
router.post('/revoke', UserController.revokeUser);
router.delete('/remove', UserController.removeUser); // Or POST /remove if preferred

module.exports = router;
