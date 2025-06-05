
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { 
    requireAdminAccess, 
    requirePermission,
    canBanUser 
} = require('../middleware/permissions.middleware');
const PermissionsService = require('../services/permissions.service');

const {
    getUsers,
    banUser,
    unbanUser,
    changeUserRole,
    deleteReviewAdmin,
    deleteCommentAdmin,
    deleteListAdmin,
    getSystemStats,
    getUserModerationHistory
} = require('../controllers/admin.controller');

// ========================================
// MIDDLEWARE GLOBAL PARA TODAS LAS RUTAS
// ========================================

// Todas las rutas de admin requieren autenticación
router.use(auth);

// Todas las rutas de admin requieren acceso al panel
router.use(requireAdminAccess);

// ========================================
// RUTAS DE INFORMACIÓN Y PERMISOS
// ========================================

/**
 * GET /admin/permissions
 * Obtiene los permisos del usuario actual para el frontend
 */
router.get('/permissions', (req, res) => {
    try {
        const permissions = PermissionsService.getUserPermissions(req.user);
        const adminPermissions = PermissionsService.getAdminPermissions ? 
            PermissionsService.getAdminPermissions(req.user) : permissions;

        res.json({
            success: true,
            user: {
                id: req.user._id,
                username: req.user.username,
                role: req.user.role
            },
            permissions: adminPermissions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error al obtener permisos',
            error: error.message
        });
    }
});

// ========================================
// RUTAS DE GESTIÓN DE USUARIOS
// ========================================

/**
 * GET /admin/users
 * Obtiene lista de usuarios con filtros
 * Query params: page, limit, role, banned, active, search
 */
router.get('/users', getUsers);

/**
 * GET /admin/users/:userId/moderation-history
 * Obtiene historial de moderación de un usuario específico
 */
router.get('/users/:userId/moderation-history', getUserModerationHistory);

/**
 * POST /admin/users/:userId/ban
 * Banea un usuario
 * Body: { reason: string, duration?: number }
 */
router.post('/users/:userId/ban', canBanUser, banUser);

/**
 * POST /admin/users/:userId/unban
 * Desbanea un usuario
 * Body: { reason?: string }
 */
router.post('/users/:userId/unban', 
    requirePermission('moderate.users.unban'), 
    unbanUser
);

/**
 * PUT /admin/users/:userId/role
 * Cambia el rol de un usuario (solo admins)
 * Body: { newRole: string, reason?: string }
 */
router.put('/users/:userId/role', 
    requirePermission('admin.users.manage'), 
    changeUserRole
);

// ========================================
// RUTAS DE MODERACIÓN DE CONTENIDO
// ========================================

/**
 * DELETE /admin/reviews/:reviewId
 * Elimina una reseña como moderador
 * Body: { reason?: string }
 */
router.delete('/reviews/:reviewId', 
    requirePermission('moderate.reviews.delete'), 
    deleteReviewAdmin
);

/**
 * DELETE /admin/comments/:commentId
 * Elimina un comentario como moderador
 * Body: { reason?: string }
 */
router.delete('/comments/:commentId', 
    requirePermission('moderate.comments.delete'), 
    deleteCommentAdmin
);

/**
 * DELETE /admin/lists/:listId
 * Elimina una lista como moderador
 * Body: { reason?: string }
 */
router.delete('/lists/:listId', 
    requirePermission('moderate.lists.delete'), 
    deleteListAdmin
);

// ========================================
// RUTAS DE ESTADÍSTICAS Y REPORTES
// ========================================

/**
 * GET /admin/stats
 * Obtiene estadísticas generales del sistema
 */
router.get('/stats', 
    requirePermission('admin.system.view'), 
    getSystemStats
);

// ========================================
// RUTAS PARA OBTENER CONTENIDO REPORTADO
// ========================================

/**
 * GET /admin/reviews
 * Obtiene reseñas para moderación
 * Query params: page, limit, reported, user
 */
router.get('/reviews', 
    requirePermission('moderate.reviews.delete'), 
    async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;

            const filters = {};
            if (req.query.user) {
                filters.userId = req.query.user;
            }

            const reviews = await require('../models/review.model')
                .find(filters)
                .populate('userId', 'username avatar role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await require('../models/review.model').countDocuments(filters);

            res.json({
                success: true,
                reviews,
                pagination: {
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                    hasMore: page < Math.ceil(total / limit)
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al obtener reseñas',
                error: error.message
            });
        }
    }
);

/**
 * GET /admin/comments
 * Obtiene comentarios para moderación
 */
router.get('/comments', 
    requirePermission('moderate.comments.delete'), 
    async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;

            const filters = {};
            if (req.query.user) {
                filters.userId = req.query.user;
            }

            const comments = await require('../models/comment.model')
                .find(filters)
                .populate('userId', 'username avatar role')
                .populate('reviewId', 'movieId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await require('../models/comment.model').countDocuments(filters);

            res.json({
                success: true,
                comments,
                pagination: {
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                    hasMore: page < Math.ceil(total / limit)
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al obtener comentarios',
                error: error.message
            });
        }
    }
);

/**
 * GET /admin/lists
 * Obtiene listas para moderación
 */
router.get('/lists', 
    requirePermission('moderate.lists.delete'), 
    async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;

            const filters = {};
            if (req.query.user) {
                filters.userId = req.query.user;
            }
            if (req.query.public !== undefined) {
                filters.isPublic = req.query.public === 'true';
            }

            const lists = await require('../models/movie-list.model')
                .find(filters)
                .populate('userId', 'username avatar role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await require('../models/movie-list.model').countDocuments(filters);

            res.json({
                success: true,
                lists,
                pagination: {
                    total,
                    page,
                    totalPages: Math.ceil(total / limit),
                    hasMore: page < Math.ceil(total / limit)
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Error al obtener listas',
                error: error.message
            });
        }
    }
);

// ========================================
// MANEJO DE ERRORES
// ========================================

// Middleware de manejo de errores específico para rutas de admin
router.use((error, req, res, next) => {
    console.error('Error en rutas de administración:', error);
    
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Error interno del servidor',
        code: error.code || 'ADMIN_ERROR',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

module.exports = router;