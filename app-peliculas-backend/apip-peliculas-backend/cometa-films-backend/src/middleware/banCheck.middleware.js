const User = require('../models/user.model');
const TokenBlackList = require('../models/tokenBlackList.model');

/**
 * Middleware para verificar si el usuario está baneado en cada request
 */
exports.checkBanStatus = async (req, res, next) => {
    try {
        // Solo aplicar si el usuario está autenticado
        if (!req.user || !req.user.id) {
            return next();
        }

        // Verificar si hay invalidación de sesiones por baneo
        const blacklistEntry = await TokenBlacklist.findOne({
            userId: req.user.id,
            reason: 'user_banned'
        }).sort({ invalidatedAt: -1 });

        if (blacklistEntry) {
            // Si la fecha del token es anterior al baneo, invalidar
            const tokenIssuedAt = new Date(req.user.iat * 1000); // JWT iat está en segundos
            if (tokenIssuedAt < blacklistEntry.invalidatedAt) {
                return res.status(401).json({
                    success: false,
                    code: 'USER_BANNED_SESSION_INVALID',
                    message: 'Tu sesión ha sido invalidada debido a un baneo'
                });
            }
        }

        // Verificar estado actual del usuario
        const currentUser = await User.findById(req.user.id).select('isBanned banReason banExpiresAt');

        if (!currentUser) {
            return res.status(401).json({
                success: false,
                code: 'USER_NOT_FOUND',
                message: 'Usuario no encontrado'
            });
        }

        if (currentUser.isBanned) {
            // Verificar si el ban ha expirado
            if (currentUser.banExpiresAt && new Date() > currentUser.banExpiresAt) {
                // Auto-desbanear si el tiempo ha expirado
                await User.findByIdAndUpdate(req.user.id, {
                    isBanned: false,
                    banReason: null,
                    bannedAt: null,
                    banExpiresAt: null,
                    bannedBy: null
                });

                console.log(`Auto-desbaneado: ${currentUser.username} (ban expirado)`);
                return next();
            }

            // Usuario sigue baneado
            const banInfo = {
                reason: currentUser.banReason,
                expiresAt: currentUser.banExpiresAt,
                isPermanent: !currentUser.banExpiresAt
            };

            return res.status(403).json({
                success: false,
                code: 'USER_BANNED',
                message: 'Tu cuenta está suspendida',
                banInfo
            });
        }

        next();
    } catch (error) {
        console.error('Error en checkBanStatus:', error);
        next(); // Continuar en caso de error para no romper la app
    }
};

/**
 * Middleware específico para rutas de login
 */
exports.checkBanOnLogin = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email) {
            return next();
        }

        const user = await User.findOne({ email }).select('isBanned banReason banExpiresAt bannedAt');

        if (user && user.isBanned) {
            // Verificar si el ban ha expirado
            if (user.banExpiresAt && new Date() > user.banExpiresAt) {
                // Auto-desbanear
                await User.findByIdAndUpdate(user._id, {
                    isBanned: false,
                    banReason: null,
                    bannedAt: null,
                    banExpiresAt: null,
                    bannedBy: null
                });

                return next(); // Permitir login
            }

            // Usuario sigue baneado
            const banInfo = {
                reason: user.banReason,
                bannedAt: user.bannedAt,
                expiresAt: user.banExpiresAt,
                isPermanent: !user.banExpiresAt
            };

            return res.status(403).json({
                success: false,
                code: 'USER_BANNED',
                message: 'Tu cuenta está suspendida y no puedes iniciar sesión',
                banInfo
            });
        }

        next();
    } catch (error) {
        console.error('Error en checkBanOnLogin:', error);
        next();
    }
};