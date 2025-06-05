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

// ========================================
// RUTAS DE GESTIÓN PREMIUM
// ========================================

// Ver estado premium (requiere auth)
router.get('/status', auth, getPremiumStatus);

// Crear suscripción (requiere auth)
router.post('/subscribe', auth, createSubscription);

// Capturar pago (requiere auth)
router.post('/capture', auth, capturePayment);

// Cancelar suscripción (requiere auth)
router.post('/cancel', auth, cancelSubscription);

// Webhook no requiere autenticación (viene directamente de PayPal)
router.post('/webhook', handleWebhook);

module.exports = router;