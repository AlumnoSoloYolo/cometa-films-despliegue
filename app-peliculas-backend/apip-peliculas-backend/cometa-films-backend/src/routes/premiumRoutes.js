const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const {
    getPremiumStatus,
    createSubscription,
    capturePayment,
    cancelSubscription,
    handleWebhook
} = require('../controllers/premiumController');

// Todas las rutas excepto webhook requieren autenticación
router.get('/status', auth, getPremiumStatus);
router.post('/subscribe', auth, createSubscription);
router.post('/capture', auth, capturePayment);
router.post('/cancel', auth, cancelSubscription);

// Webhook no requiere autenticación (viene directamente de PayPal)
router.post('/webhook', handleWebhook);

module.exports = router;