const cron = require('node-cron');
const User = require('../models/user.model');

// Ejecutar todos los días a la medianoche
cron.schedule('0 0 * * *', async () => {
    console.log('Ejecutando verificación de suscripciones expiradas');

    try {
        const now = new Date();

        // Encontrar usuarios con suscripciones expiradas
        const expiredUsers = await User.find({
            isPremium: true,
            premiumExpiry: { $lt: now }
        });

        console.log(`Se encontraron ${expiredUsers.length} suscripciones expiradas`);

        // Procesar cada usuario
        for (const user of expiredUsers) {
            console.log(`Desactivando suscripción premium para usuario ${user.username}`);

            // Actualizar usuario
            await User.findByIdAndUpdate(user._id, {
                isPremium: false,
                $push: {
                    premiumHistory: {
                        action: 'expired',
                        date: new Date(),
                        details: 'Suscripción Premium expirada automáticamente'
                    }
                }
            });
        }

        console.log('Verificación de suscripciones completada');
    } catch (error) {
        console.error('Error en verificación de suscripciones:', error);
    }
});