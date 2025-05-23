// actualizar-usuarios-premium.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user.model');
const config = require('./config/config');

async function actualizarUsuarios() {
    try {
        // Conectarse a MongoDB
        await mongoose.connect(config.mongodb.uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('Conectado a MongoDB');

        // Encontrar usuarios sin campo isPremium
        const usuariosDesactualizados = await User.find({
            $or: [
                { isPremium: { $exists: false } },
                { premiumExpiry: { $exists: false } }
            ]
        });

        console.log(`Se encontraron ${usuariosDesactualizados.length} usuarios para actualizar`);

        // Actualizar cada usuario
        let actualizados = 0;
        for (const usuario of usuariosDesactualizados) {
            usuario.isPremium = false;
            usuario.premiumExpiry = null;
            usuario.paypalSubscriptionId = null;

            // Si el campo no existe, inicializarlo
            if (!usuario.premiumHistory) {
                usuario.premiumHistory = [];
            }

            await usuario.save();
            actualizados++;
            console.log(`Usuario actualizado: ${usuario.username} (${actualizados}/${usuariosDesactualizados.length})`);
        }

        console.log(`Se actualizaron ${actualizados} usuarios correctamente`);

    } catch (error) {
        console.error('Error al actualizar usuarios:', error);
    } finally {
        // Cerrar conexión
        await mongoose.connection.close();
        console.log('Conexión cerrada');
    }
}

actualizarUsuarios();