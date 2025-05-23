const User = require('../models/user.model');
const { createPayPalClient } = require('../config/paypal.config');

// Obtener el estado premium del usuario
exports.getPremiumStatus = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId)
            .select('isPremium premiumExpiry premiumHistory');

        // Verificar si la suscripción está cancelada pero aún activa
        const canceledButActive = user.premiumHistory && 
            user.premiumHistory.length > 0 && 
            user.premiumHistory[user.premiumHistory.length - 1].action === 'canceled' &&
            user.isPremium;

        // Calcular días restantes
        let remainingDays = 0;
        if (user.isPremium && user.premiumExpiry) {
            const now = new Date();
            const expiry = new Date(user.premiumExpiry);
            remainingDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        }

        // Incluir historial reciente (últimas 5 entradas)
        const recentHistory = user.premiumHistory ? 
            user.premiumHistory.slice(-5).reverse() : 
            [];

        res.json({
            isPremium: user.isPremium,
            premiumExpiry: user.premiumExpiry,
            remainingDays: remainingDays > 0 ? remainingDays : 0,
            isCanceled: canceledButActive,
            subscriptionHistory: recentHistory
        });
    } catch (error) {
        console.error('Error al obtener estado premium:', error);
        res.status(500).json({
            message: 'Error al obtener estado premium',
            error: error.message
        });
    }
};

// Crear una orden de pago para suscripción
exports.createSubscription = async (req, res) => {
    console.log('------ INICIO createSubscription ------');
    try {
        console.log('Iniciando creación de suscripción PayPal');

        // Log de variables de entorno para depuración
        console.log('Variables de entorno PayPal:');
        console.log('- PAYPAL_CLIENT_ID:', process.env.PAYPAL_CLIENT_ID ? 'Configurado' : 'No configurado');
        console.log('- PAYPAL_CLIENT_SECRET:', process.env.PAYPAL_CLIENT_SECRET ? 'Configurado' : 'No configurado');
        console.log('- FRONTEND_URL:', process.env.FRONTEND_URL || 'No configurado');

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';

        try {
            // Obtener el cliente PayPal (que incluye el token)
            console.log('Obteniendo cliente PayPal...');
            const paypalClient = await createPayPalClient();
            console.log('Cliente PayPal obtenido correctamente');

            // Crear la orden con la API v2
            console.log('Creando orden de PayPal...');
            const orderData = {
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: 'EUR',
                        value: '5.99'
                    },
                    description: 'Suscripción Premium de CometaCine - 1 mes'
                }],
                application_context: {
                    brand_name: 'CometaCine',
                    landing_page: 'BILLING',
                    user_action: 'PAY_NOW',
                    return_url: `${frontendUrl}/premium/success`,
                    cancel_url: `${frontendUrl}/premium/cancel`
                }
            };

            console.log('Ejecutando solicitud a PayPal...');
            const response = await paypalClient.post('/v2/checkout/orders', orderData);

            console.log('Orden creada en PayPal, ID:', response.data.id);

            // Encontrar el enlace de aprobación
            const approveLink = response.data.links.find(link => link.rel === 'approve');

            if (!approveLink) {
                throw new Error('No se encontró el enlace de aprobación en la respuesta de PayPal');
            }

            const approveUrl = approveLink.href;
            console.log('URL de aprobación:', approveUrl);

            // Respuesta exitosa
            console.log('------ FIN createSubscription (Éxito) ------');
            res.json({
                orderId: response.data.id,
                approveUrl: approveUrl
            });

        } catch (paypalError) {
            console.error('Error específico de PayPal:', paypalError);
            throw paypalError; // Re-lanzar para el manejo global
        }

    } catch (error) {
        console.error('------ ERROR en createSubscription ------');
        console.error('Error completo:', error);
        console.error('Nombre del error:', error.name);
        console.error('Mensaje de error:', error.message);
        console.error('Stack de error:', error.stack);

        res.status(500).json({
            message: 'Error al iniciar el proceso de pago',
            error: error.message,
            details: 'Verifica los logs del servidor para más información'
        });
    }
};

// Capturar el pago y activar la suscripción
exports.capturePayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user.id;

        if (!orderId) {
            return res.status(400).json({ message: 'ID de orden requerido' });
        }

        // Capturar el pago con la API v2
        const paypalClient = await createPayPalClient();

        const response = await paypalClient.post(`/v2/checkout/orders/${orderId}/capture`);

        if (response.data.status === 'COMPLETED') {
            // Calcular fecha de expiración (1 mes desde ahora)
            const now = new Date();
            const expiryDate = new Date(now);
            expiryDate.setMonth(now.getMonth() + 1);

            // Actualizar usuario como premium
            await User.findByIdAndUpdate(userId, {
                isPremium: true,
                premiumExpiry: expiryDate,
                paypalSubscriptionId: orderId, // Guardar el ID de la orden como referencia
                $push: {
                    premiumHistory: {
                        action: 'subscribed',
                        date: new Date(),
                        details: `Suscripción Premium activada - Orden PayPal: ${orderId}`
                    }
                }
            });

            res.json({
                success: true,
                message: 'Suscripción Premium activada correctamente',
                premiumExpiry: expiryDate
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Error en el pago: estado no completado',
                status: response.data.status
            });
        }
    } catch (error) {
        console.error('Error al capturar pago PayPal:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar el pago',
            error: error.message
        });
    }
};

// Cancelar suscripción
exports.cancelSubscription = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user.isPremium) {
            return res.status(400).json({ message: 'No tienes una suscripción activa' });
        }

        // Si hay una suscripción en PayPal, cancelarla
        if (user.paypalSubscriptionId) {
            // Aquí iría el código para cancelar en PayPal si es necesario
            // Para pagos únicos, esto no es necesario
        }

        // Actualizar en la base de datos
        // Mantenemos el acceso premium hasta la fecha de expiración
        await User.findByIdAndUpdate(userId, {
            $push: {
                premiumHistory: {
                    action: 'canceled',
                    date: new Date(),
                    details: 'Suscripción Premium cancelada manualmente'
                }
            }
        });

        res.json({
            success: true,
            message: 'Suscripción cancelada. Mantendrás el acceso Premium hasta la fecha de expiración.',
            premiumExpiry: user.premiumExpiry
        });
    } catch (error) {
        console.error('Error al cancelar suscripción:', error);
        res.status(500).json({
            message: 'Error al cancelar suscripción',
            error: error.message
        });
    }
};

// Webhook para eventos de PayPal
exports.handleWebhook = async (req, res) => {
    try {
        const event = req.body;

        // Verificar firma del webhook (importante en producción)
        // ...código de verificación...

        // Manejar diferentes tipos de eventos
        switch (event.event_type) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                // Pago recibido
                // ...
                break;

            case 'BILLING.SUBSCRIPTION.CANCELLED':
                // Suscripción cancelada
                // ...
                break;

            // Otros eventos...
        }

        res.status(200).send('Webhook recibido');
    } catch (error) {
        console.error('Error en webhook de PayPal:', error);
        res.status(500).send('Error procesando webhook');
    }
};