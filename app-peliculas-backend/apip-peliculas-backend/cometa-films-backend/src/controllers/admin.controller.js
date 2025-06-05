// src/controllers/admin.controller.js
const User = require('../models/user.model');
const Review = require('../models/review.model');
const Comment = require('../models/comment.model');
const MovieList = require('../models/movie-list.model');
const { Chat, Message } = require('../models/chat.model');
const PermissionsService = require('../services/permissions.service');
const { ROLES } = require('../config/roles.config');

// ========================================
// GESTIÓN DE USUARIOS
// ========================================

/**
 * Obtener lista de usuarios con paginación y filtros
 * GET /admin/users?page=1&limit=20&role=user&banned=false
 */
exports.getUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Filtros opcionales
        const filters = {};
        if (req.query.role) filters.role = req.query.role;
        if (req.query.banned !== undefined) filters.isBanned = req.query.banned === 'true';
        if (req.query.active !== undefined) filters.isActive = req.query.active === 'true';

        // Búsqueda por username
        if (req.query.search) {
            filters.username = { $regex: req.query.search, $options: 'i' };
        }

        const users = await User.find(filters)
            .select('-password -paypalSubscriptionId') // No enviar datos sensibles
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await User.countDocuments(filters);

        // Agregar información adicional de cada usuario
        const enrichedUsers = users.map(user => ({
            ...user,
            // Información calculada
            canBeBanned: PermissionsService.canBanUser(req.user, user),
            banTimeRemaining: user.banExpiresAt ? Math.max(0, user.banExpiresAt - new Date()) : null
        }));

        res.json({
            success: true,
            users: enrichedUsers,
            pagination: {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                hasMore: page < Math.ceil(total / limit),
                limit
            },
            filters: filters // Para que el frontend sepa qué filtros se aplicaron
        });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener usuarios',
            error: error.message
        });
    }
};

/**
 * Banear un usuario
 * POST /admin/users/:userId/ban
 * Body: { reason: string, duration?: number (horas) }
 */
exports.banUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason, duration } = req.body; // duration en horas, null/undefined = permanente

        if (!reason || reason.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'La razón del ban es obligatoria'
            });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Verificar que no esté ya baneado
        if (targetUser.isBanned) {
            return res.status(400).json({
                success: false,
                message: 'El usuario ya está baneado'
            });
        }

        // Verificar permisos (ya verificado en middleware, pero seguridad extra)
        if (!PermissionsService.canBanUser(req.user, targetUser)) {
            return res.status(403).json({
                success: false,
                message: 'No tienes permisos para banear a este usuario'
            });
        }

        // Calcular fecha de expiración si es temporal
        let banExpiresAt = null;
        if (duration && duration > 0) {
            banExpiresAt = new Date(Date.now() + (duration * 60 * 60 * 1000)); // horas a milisegundos
        }

        // Actualizar usuario
        targetUser.isBanned = true;
        targetUser.banReason = reason.trim();
        targetUser.bannedAt = new Date();
        targetUser.bannedBy = req.user._id;
        targetUser.banExpiresAt = banExpiresAt;

        // Agregar al historial de moderación
        targetUser.moderationHistory.push({
            action: 'ban',
            reason: reason.trim(),
            moderator: req.user._id,
            date: new Date(),
            details: duration ? `Ban temporal de ${duration} horas` : 'Ban permanente',
            expiresAt: banExpiresAt
        });

        await targetUser.save();

        console.log(`Usuario ${targetUser.username} baneado por ${req.user.username}. Razón: ${reason}`);

        res.json({
            success: true,
            message: `Usuario ${targetUser.username} baneado correctamente`,
            ban: {
                userId: targetUser._id,
                username: targetUser.username,
                reason: targetUser.banReason,
                bannedAt: targetUser.bannedAt,
                bannedBy: req.user.username,
                expiresAt: banExpiresAt,
                isTemporary: !!banExpiresAt,
                durationHours: duration || null
            }
        });
    } catch (error) {
        console.error('Error al banear usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al banear usuario',
            error: error.message
        });
    }
};

/**
 * Desbanear un usuario
 * POST /admin/users/:userId/unban
 * Body: { reason?: string }
 */
exports.unbanUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { reason } = req.body;

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        if (!targetUser.isBanned) {
            return res.status(400).json({
                success: false,
                message: 'Este usuario no está baneado'
            });
        }

        // Guardar info del ban anterior para el log
        const previousBan = {
            reason: targetUser.banReason,
            bannedAt: targetUser.bannedAt,
            wasTemporary: !!targetUser.banExpiresAt
        };

        // Desbanear
        targetUser.isBanned = false;
        targetUser.banReason = null;
        targetUser.bannedAt = null;
        targetUser.banExpiresAt = null;
        targetUser.bannedBy = null;

        // Agregar al historial
        targetUser.moderationHistory.push({
            action: 'unban',
            reason: reason || 'Desbaneado por moderador',
            moderator: req.user._id,
            date: new Date(),
            details: `Desbaneado por ${req.user.username}`
        });

        await targetUser.save();

        console.log(`Usuario ${targetUser.username} desbaneado por ${req.user.username}`);

        res.json({
            success: true,
            message: `Usuario ${targetUser.username} desbaneado correctamente`,
            unban: {
                userId: targetUser._id,
                username: targetUser.username,
                unbannedBy: req.user.username,
                unbannedAt: new Date(),
                previousBan
            }
        });
    } catch (error) {
        console.error('Error al desbanear usuario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al desbanear usuario',
            error: error.message
        });
    }
};

/**
 * Cambiar rol de usuario (solo admins)
 * PUT /admin/users/:userId/role
 * Body: { newRole: string, reason?: string }
 */
exports.changeUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { newRole, reason } = req.body;

        if (!newRole || !Object.values(ROLES).includes(newRole)) {
            return res.status(400).json({
                success: false,
                message: 'Rol no válido',
                validRoles: Object.values(ROLES)
            });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const oldRole = targetUser.role;

        if (oldRole === newRole) {
            return res.status(400).json({
                success: false,
                message: `El usuario ya tiene el rol ${newRole}`
            });
        }

        // Actualizar rol
        targetUser.role = newRole;

        // Agregar al historial
        targetUser.moderationHistory.push({
            action: 'role_change',
            reason: reason || `Rol cambiado de ${oldRole} a ${newRole}`,
            moderator: req.user._id,
            date: new Date(),
            details: `Cambio realizado por ${req.user.username}: ${oldRole} → ${newRole}`
        });

        await targetUser.save();

        console.log(`Rol de ${targetUser.username} cambiado de ${oldRole} a ${newRole} por ${req.user.username}`);

        res.json({
            success: true,
            message: `Rol de ${targetUser.username} cambiado correctamente`,
            roleChange: {
                userId: targetUser._id,
                username: targetUser.username,
                oldRole,
                newRole,
                changedBy: req.user.username,
                changedAt: new Date(),
                reason: reason || null
            }
        });
    } catch (error) {
        console.error('Error al cambiar rol:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar rol',
            error: error.message
        });
    }
};

// ========================================
// MODERACIÓN DE CONTENIDO
// ========================================

/**
 * Eliminar reseña como moderador
 * DELETE /admin/reviews/:reviewId
 * Body: { reason?: string }
 */
exports.deleteReviewAdmin = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { reason } = req.body;

        const review = await Review.findById(reviewId).populate('userId', 'username');
        if (!review) {
            return res.status(404).json({
                success: false,
                message: 'Reseña no encontrada'
            });
        }

        // Guardar info para el log
        const reviewInfo = {
            id: review._id,
            author: review.userId.username,
            authorId: review.userId._id,
            movieId: review.movieId,
            rating: review.rating,
            createdAt: review.createdAt
        };

        // Agregar al historial del usuario que creó la reseña
        const user = await User.findById(review.userId._id);
        if (user) {
            user.moderationHistory.push({
                action: 'content_deleted',
                reason: reason || 'Reseña eliminada por moderación',
                moderator: req.user._id,
                date: new Date(),
                details: `Reseña de película ${review.movieId} eliminada por ${req.user.username}`
            });
            await user.save();
        }

        // Eliminar comentarios asociados a la reseña
        const deletedComments = await Comment.deleteMany({ reviewId: review._id });

        // Eliminar la reseña
        await Review.findByIdAndDelete(reviewId);

        console.log(`Reseña ${reviewId} eliminada por moderador ${req.user.username}`);

        res.json({
            success: true,
            message: 'Reseña eliminada correctamente',
            deletion: {
                review: reviewInfo,
                deletedBy: req.user.username,
                deletedAt: new Date(),
                reason: reason || 'Sin razón especificada',
                commentsDeleted: deletedComments.deletedCount
            }
        });
    } catch (error) {
        console.error('Error al eliminar reseña:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar reseña',
            error: error.message
        });
    }
};

/**
 * Eliminar comentario como moderador
 * DELETE /admin/comments/:commentId
 * Body: { reason?: string }
 */
exports.deleteCommentAdmin = async (req, res) => {
    try {
        const { commentId } = req.params;
        const { reason } = req.body;

        const comment = await Comment.findById(commentId).populate('userId', 'username');
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: 'Comentario no encontrado'
            });
        }

        // Guardar info para el log
        const commentInfo = {
            id: comment._id,
            author: comment.userId.username,
            authorId: comment.userId._id,
            text: comment.text.substring(0, 100) + (comment.text.length > 100 ? '...' : ''),
            reviewId: comment.reviewId,
            createdAt: comment.createdAt
        };

        // Agregar al historial del usuario
        const user = await User.findById(comment.userId._id);
        if (user) {
            user.moderationHistory.push({
                action: 'content_deleted',
                reason: reason || 'Comentario eliminado por moderación',
                moderator: req.user._id,
                date: new Date(),
                details: `Comentario eliminado por ${req.user.username}`
            });
            await user.save();
        }

        // Eliminar respuestas al comentario
        const deletedReplies = await Comment.deleteMany({ parentId: commentId });

        // Eliminar el comentario
        await Comment.findByIdAndDelete(commentId);

        console.log(`Comentario ${commentId} eliminado por moderador ${req.user.username}`);

        res.json({
            success: true,
            message: 'Comentario eliminado correctamente',
            deletion: {
                comment: commentInfo,
                deletedBy: req.user.username,
                deletedAt: new Date(),
                reason: reason || 'Sin razón especificada',
                repliesDeleted: deletedReplies.deletedCount
            }
        });
    } catch (error) {
        console.error('Error al eliminar comentario:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar comentario',
            error: error.message
        });
    }
};

/**
 * Eliminar lista como moderador
 * DELETE /admin/lists/:listId
 * Body: { reason?: string }
 */
exports.deleteListAdmin = async (req, res) => {
    try {
        const { listId } = req.params;
        const { reason } = req.body;

        const list = await MovieList.findById(listId).populate('userId', 'username');
        if (!list) {
            return res.status(404).json({
                success: false,
                message: 'Lista no encontrada'
            });
        }

        // Guardar info para el log
        const listInfo = {
            id: list._id,
            title: list.title,
            author: list.userId.username,
            authorId: list.userId._id,
            isPublic: list.isPublic,
            moviesCount: list.movies.length,
            createdAt: list.createdAt
        };

        // Agregar al historial del usuario
        const user = await User.findById(list.userId._id);
        if (user) {
            user.moderationHistory.push({
                action: 'content_deleted',
                reason: reason || 'Lista eliminada por moderación',
                moderator: req.user._id,
                date: new Date(),
                details: `Lista "${list.title}" eliminada por ${req.user.username}`
            });
            await user.save();
        }

        // Eliminar la lista
        await MovieList.findByIdAndDelete(listId);

        console.log(`Lista ${listId} ("${list.title}") eliminada por moderador ${req.user.username}`);

        res.json({
            success: true,
            message: 'Lista eliminada correctamente',
            deletion: {
                list: listInfo,
                deletedBy: req.user.username,
                deletedAt: new Date(),
                reason: reason || 'Sin razón especificada'
            }
        });
    } catch (error) {
        console.error('Error al eliminar lista:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar lista',
            error: error.message
        });
    }
};

// ========================================
// ESTADÍSTICAS DEL SISTEMA
// ========================================

/**
 * Obtener estadísticas generales del sistema
 * GET /admin/stats
 */
exports.getSystemStats = async (req, res) => {
    try {
        // Estadísticas básicas en paralelo
        const [
            totalUsers,
            bannedUsers,
            activeUsers,
            totalReviews,
            totalComments,
            totalLists,
            totalChats,
            totalMessages
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ isBanned: true }),
            User.countDocuments({ isActive: true, isBanned: false }),
            Review.countDocuments(),
            Comment.countDocuments(),
            MovieList.countDocuments(),
            Chat.countDocuments(),
            Message.countDocuments()
        ]);

        // Usuarios por rol
        const usersByRole = await User.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]);

        // Usuarios registrados por mes (últimos 6 meses)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const userGrowth = await User.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Actividad reciente
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayStats = await Promise.all([
            Review.countDocuments({ createdAt: { $gte: today } }),
            Comment.countDocuments({ createdAt: { $gte: today } }),
            User.countDocuments({ createdAt: { $gte: today } }),
            MovieList.countDocuments({ createdAt: { $gte: today } })
        ]);

        res.json({
            success: true,
            stats: {
                overview: {
                    totalUsers,
                    activeUsers,
                    bannedUsers,
                    totalReviews,
                    totalComments,
                    totalLists,
                    totalChats,
                    totalMessages
                },
                usersByRole: usersByRole.reduce((acc, item) => {
                    acc[item._id || 'undefined'] = item.count;
                    return acc;
                }, {}),
                growth: userGrowth,
                today: {
                    newUsers: todayStats[2],
                    newReviews: todayStats[0],
                    newComments: todayStats[1],
                    newLists: todayStats[3]
                }
            },
            generatedAt: new Date()
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
};

/**
 * Obtener historial de moderación de un usuario
 * GET /admin/users/:userId/moderation-history
 */
exports.getUserModerationHistory = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select('username moderationHistory')
            .populate('moderationHistory.moderator', 'username');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username
            },
            moderationHistory: user.moderationHistory.sort((a, b) => b.date - a.date) // Más recientes primero
        });
    } catch (error) {
        console.error('Error al obtener historial de moderación:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener historial',
            error: error.message
        });
    }
};


