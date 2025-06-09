const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const config = require('../config/config');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No se proporcionó token de autenticación',
                code: 'NO_TOKEN'
            });
        }

        // Verificar el token
        const decoded = jwt.verify(token, config.jwt.secret);

        // Buscar el usuario en la base de datos
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido - usuario no encontrado',
                code: 'INVALID_TOKEN'
            });
        }

        // VERIFICACIÓN CRÍTICA: Comprobar si el usuario está baneado
        if (user.isBanned) {
            const banInfo = {
                reason: user.banReason || 'Cuenta suspendida',
                bannedAt: user.bannedAt,
                expiresAt: user.banExpiresAt,
                isPermanent: !user.banExpiresAt
            };

            // Si es un ban temporal, verificar si ya expiró
            if (user.banExpiresAt && new Date() > user.banExpiresAt) {
                console.log(`Ban temporal expirado para usuario ${user.username}, desbaneando automáticamente`);

                // Desbanear automáticamente
                user.isBanned = false;
                user.banReason = null;
                user.bannedAt = null;
                user.banExpiresAt = null;
                user.bannedBy = null;

                // Agregar al historial
                user.moderationHistory.push({
                    action: 'auto_unban',
                    reason: 'Ban temporal expirado automáticamente',
                    date: new Date(),
                    details: 'Sistema desbaneó automáticamente al expirar el ban temporal'
                });

                await user.save();

                // Continuar con la autenticación normal
                req.user = user;
                next();
            } else {
                // Usuario aún está baneado
                console.log(`Usuario baneado intentando acceso: ${user.username}`);

                return res.status(403).json({
                    success: false,
                    message: banInfo.isPermanent
                        ? 'Tu cuenta ha sido suspendida permanentemente'
                        : 'Tu cuenta está temporalmente suspendida',
                    code: 'USER_BANNED',
                    banInfo: banInfo
                });
            }
        } else {
            // Usuario no baneado, continuar normalmente
            req.user = user;
            next();
        }

    } catch (error) {
        console.error('Error en middleware de autenticación:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Token inválido',
                code: 'INVALID_TOKEN'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error interno en autenticación',
            code: 'AUTH_ERROR'
        });
    }
};

// Middleware adicional para verificar ban en tiempo real (para rutas críticas)
const checkBanStatus = async (req, res, next) => {
    try {
        if (!req.user || !req.user._id) {
            return next();
        }

        // Re-verificar el estado de ban del usuario en tiempo real
        const user = await User.findById(req.user._id).select('isBanned banReason bannedAt banExpiresAt');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        }

        if (user.isBanned) {
            const banInfo = {
                reason: user.banReason || 'Cuenta suspendida',
                bannedAt: user.bannedAt,
                expiresAt: user.banExpiresAt,
                isPermanent: !user.banExpiresAt
            };

            // Verificar si el ban temporal expiró
            if (user.banExpiresAt && new Date() > user.banExpiresAt) {
                // Desbanear automáticamente
                await User.findByIdAndUpdate(user._id, {
                    isBanned: false,
                    banReason: null,
                    bannedAt: null,
                    banExpiresAt: null,
                    bannedBy: null,
                    $push: {
                        moderationHistory: {
                            action: 'auto_unban',
                            reason: 'Ban temporal expirado automáticamente',
                            date: new Date(),
                            details: 'Sistema desbaneó automáticamente al expirar el ban temporal'
                        }
                    }
                });

                console.log(`Ban temporal expirado y removido para usuario ${req.user.username}`);
                next();
            } else {
                // Usuario aún baneado
                console.log(`Usuario baneado bloqueado en acción: ${req.user.username}`);

                return res.status(403).json({
                    success: false,
                    message: banInfo.isPermanent
                        ? 'Tu cuenta ha sido suspendida permanentemente'
                        : 'Tu cuenta está temporalmente suspendida',
                    code: 'ACCOUNT_BANNED',
                    banInfo: banInfo
                });
            }
        } else {
            next();
        }

    } catch (error) {
        console.error('Error verificando estado de ban:', error);
        res.status(500).json({
            success: false,
            message: 'Error verificando estado de cuenta',
            code: 'BAN_CHECK_ERROR'
        });
    }
};

// Middleware para invalidar sesiones de usuarios baneados
const invalidateBannedUserSessions = async (userId) => {
    try {
        const TokenBlacklist = require('../models/tokenBlackList.model');

        // Agregar todas las sesiones del usuario a la blacklist
        await TokenBlacklist.create({
            userId: userId,
            reason: 'user_banned',
            invalidatedAt: new Date(),
            note: 'Sesiones invalidadas por ban de usuario'
        });

        console.log(`Sesiones invalidadas para usuario baneado: ${userId}`);
    } catch (error) {
        console.error('Error invalidando sesiones:', error);
    }
};

module.exports = {
    auth,
    checkBanStatus,
    invalidateBannedUserSessions
};