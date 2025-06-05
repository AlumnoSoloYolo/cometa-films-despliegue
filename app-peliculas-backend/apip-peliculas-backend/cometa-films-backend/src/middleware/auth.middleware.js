// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const config = require('../config/config');

exports.auth = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ message: 'No hay token de autenticación' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, config.jwt.secret);

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        // === NUEVAS VERIFICACIONES DE SEGURIDAD ===
        
        // 1. Verificar si la cuenta está activa
        if (!user.isActive) {
            return res.status(403).json({ 
                message: 'Tu cuenta está desactivada. Contacta al administrador.',
                code: 'ACCOUNT_DEACTIVATED'
            });
        }

        // 2. Verificar ban temporal (auto-desbanear si ha expirado)
        if (user.isBanned && user.banExpiresAt && new Date() > user.banExpiresAt) {
            console.log(`Auto-desbaneando usuario ${user.username} - ban temporal expirado`);
            
            user.isBanned = false;
            user.banReason = null;
            user.bannedAt = null;
            user.banExpiresAt = null;
            user.bannedBy = null;
            
            // Agregar al historial
            user.moderationHistory.push({
                action: 'unban',
                reason: 'Ban temporal expirado automáticamente',
                date: new Date(),
                details: 'Desban automático por expiración'
            });
            
            await user.save();
        }

        // 3. Verificar si está baneado
        if (user.isBanned) {
            const banInfo = {
                message: 'Tu cuenta está suspendida',
                code: 'ACCOUNT_BANNED',
                banReason: user.banReason,
                bannedAt: user.bannedAt
            };
            
            // Si es ban temporal, incluir cuándo expira
            if (user.banExpiresAt) {
                banInfo.banExpiresAt = user.banExpiresAt;
                banInfo.message = 'Tu cuenta está suspendida temporalmente';
                
                // Calcular tiempo restante
                const timeLeft = user.banExpiresAt - new Date();
                const hoursLeft = Math.ceil(timeLeft / (1000 * 60 * 60));
                banInfo.hoursRemaining = hoursLeft > 0 ? hoursLeft : 0;
            }
            
            return res.status(403).json(banInfo);
        }

        // Todo OK - usuario autenticado y activo
        req.user = user;
        next();
        
    } catch (error) {
        console.error('Error en middleware de autenticación:', error);
        res.status(401).json({ message: 'Token inválido', error: error.message });
    }
};

// === MIDDLEWARE OPCIONAL: Solo verificar token sin verificar bans ===
// Útil para endpoints donde usuarios baneados pueden ver cierta información (como su perfil para ver el motivo del ban)
exports.authOnly = async (req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ message: 'No hay token de autenticación' });
        }

        const token = authHeader.replace('Bearer ', '');
        const decoded = jwt.verify(token, config.jwt.secret);

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            throw new Error('Usuario no encontrado');
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Token inválido', error: error.message });
    }
};