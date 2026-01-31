const express = require('express');
const router = express.Router();
const TransactionController = require('./transaction.controller');

// Routes called by the Bot
router.post('/', TransactionController.createTransaction);
router.get('/balance/:user_id_telegram', TransactionController.getBalance);
router.get('/report/:user_id_telegram', TransactionController.getReport);
router.get('/history/:user_id_telegram', TransactionController.getHistory);

module.exports = router;
