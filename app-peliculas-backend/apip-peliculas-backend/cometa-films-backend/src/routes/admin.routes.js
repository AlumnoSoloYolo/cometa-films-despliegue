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

// IMPORTAR EL MIDDLEWARE DE BAN
const { invalidateBannedUserSessions } = require('../middleware/auth.middleware');

// IMPORTAR CONTROLADOR DE REPORTES
const {
    getReports,
    resolveReport,
    updateReportStatus
} = require('../controllers/reportController');

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

router.get('/users', getUsers);
router.get('/users/:userId/moderation-history', getUserModerationHistory);
router.post('/users/:userId/ban', canBanUser, banUser);
router.post('/users/:userId/unban',
    requirePermission('moderate.users.unban'),
    unbanUser
);
router.put('/users/:userId/role',
    requirePermission('admin.users.manage'),
    changeUserRole
);

// ========================================
// RUTAS DE MODERACIÓN DE CONTENIDO
// ========================================

router.delete('/reviews/:reviewId',
    requirePermission('moderate.reviews.delete'),
    deleteReviewAdmin
);

router.delete('/comments/:commentId',
    requirePermission('moderate.comments.delete'),
    deleteCommentAdmin
);

router.delete('/lists/:listId',
    requirePermission('moderate.lists.delete'),
    deleteListAdmin
);

// ========================================
// RUTAS DE ESTADÍSTICAS
// ========================================

router.get('/stats',
    requirePermission('admin.system.view'),
    getSystemStats
);

// ========================================
// RUTAS DE GESTIÓN DE REPORTES
// ========================================

/**
 * GET /admin/reports
 * Obtiene reportes para el panel de administración
 */
router.get('/reports',
    requirePermission('moderate.reports.view'),
    getReports
);

/**
 * PATCH /admin/reports/:reportId/resolve
 * Resolver un reporte específico
 */
router.patch('/reports/:reportId/resolve',
    requirePermission('moderate.reports.manage'),
    resolveReport
);

/**
 * PATCH /admin/reports/:reportId/status
 * Actualizar estado de un reporte
 */
router.patch('/reports/:reportId/status',
    requirePermission('moderate.reports.manage'),
    updateReportStatus
);

/**
 * GET /admin/reports/stats
 * Obtener estadísticas de reportes
 */
router.get('/reports/stats',
    requirePermission('admin.reports.stats'),
    async (req, res) => {
        try {
            const Report = require('../models/report.model');

            // Estadísticas por estado
            const statusStats = await Report.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Estadísticas por tipo de contenido
            const contentTypeStats = await Report.aggregate([
                {
                    $group: {
                        _id: '$reportedContent.contentType',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Estadísticas por razón
            const reasonStats = await Report.aggregate([
                {
                    $group: {
                        _id: '$reason',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Estadísticas por prioridad
            const priorityStats = await Report.aggregate([
                {
                    $group: {
                        _id: '$priority',
                        count: { $sum: 1 }
                    }
                }
            ]);

            // Reportes por día (últimos 30 días)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const dailyStats = await Report.aggregate([
                {
                    $match: {
                        createdAt: { $gte: thirtyDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: {
                                format: "%Y-%m-%d",
                                date: "$createdAt"
                            }
                        },
                        count: { $sum: 1 }
                    }
                },
                {
                    $sort: { _id: 1 }
                }
            ]);

            // Totales
            const totalReports = await Report.countDocuments();
            const pendingReports = await Report.countDocuments({ status: 'pending' });
            const underReviewReports = await Report.countDocuments({ status: 'under_review' });
            const resolvedReports = await Report.countDocuments({ status: 'resolved' });
            const dismissedReports = await Report.countDocuments({ status: 'dismissed' });

            const resolutionRate = totalReports > 0 ?
                ((resolvedReports / totalReports) * 100).toFixed(1) : 0;

            res.json({
                success: true,
                data: {
                    summary: {
                        total: totalReports,
                        pending: pendingReports,
                        underReview: underReviewReports,
                        resolved: resolvedReports,
                        dismissed: dismissedReports,
                        resolutionRate: resolutionRate
                    },
                    byStatus: statusStats,
                    byContentType: contentTypeStats,
                    byReason: reasonStats,
                    byPriority: priorityStats,
                    dailyTrend: dailyStats
                }
            });

        } catch (error) {
            console.error('Error al obtener estadísticas de reportes:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas'
            });
        }
    }
);

/**
 * GET /admin/reports/user/:userId
 * Obtener reportes hechos por un usuario específico
 */
router.get('/reports/user/:userId',
    requirePermission('moderate.reports.view'),
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const Report = require('../models/report.model');
            const reports = await Report.find({ reporter: userId })
                .populate('reportedUser', 'username avatar')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Report.countDocuments({ reporter: userId });

            res.json({
                success: true,
                reports: reports,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: skip + reports.length < total,
                    hasPrev: page > 1,
                    hasMore: skip + reports.length < total
                }
            });

        } catch (error) {
            console.error('Error al obtener reportes del usuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener reportes'
            });
        }
    }
);

/**
 * GET /admin/reports/against/:userId
 * Obtener reportes contra un usuario específico
 */
router.get('/reports/against/:userId',
    requirePermission('moderate.reports.view'),
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const Report = require('../models/report.model');
            const reports = await Report.find({ reportedUser: userId })
                .populate('reporter', 'username avatar')
                .populate('resolution.resolvedBy', 'username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Report.countDocuments({ reportedUser: userId });

            res.json({
                success: true,
                reports: reports,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: skip + reports.length < total,
                    hasPrev: page > 1,
                    hasMore: skip + reports.length < total
                }
            });

        } catch (error) {
            console.error('Error al obtener reportes contra el usuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener reportes'
            });
        }
    }
);

/**
 * GET /admin/reports/content/:contentType/:contentId
 * Obtener reportes de un contenido específico
 */
router.get('/reports/content/:contentType/:contentId',
    requirePermission('moderate.reports.view'),
    async (req, res) => {
        try {
            const { contentType, contentId } = req.params;

            const Report = require('../models/report.model');
            const reports = await Report.find({
                'reportedContent.contentType': contentType,
                'reportedContent.contentId': contentId
            })
                .populate('reporter', 'username avatar')
                .populate('reportedUser', 'username avatar')
                .populate('resolution.resolvedBy', 'username')
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                reports: reports,
                count: reports.length
            });

        } catch (error) {
            console.error('Error al obtener reportes del contenido:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener reportes del contenido'
            });
        }
    }
);

// ========================================
// RUTAS PARA OBTENER CONTENIDO REPORTADO
// ========================================

/**
 * GET /admin/reviews
 * Obtiene reseñas para moderación
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

            const Review = require('../models/review.model');
            const reviews = await Review.find(filters)
                .populate('userId', 'username avatar role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await Review.countDocuments(filters);

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

            const Comment = require('../models/comment.model');
            const comments = await Comment.find(filters)
                .populate('userId', 'username avatar role')
                .populate('reviewId', 'movieId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await Comment.countDocuments(filters);

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

            const MovieList = require('../models/movie-list.model');
            const lists = await MovieList.find(filters)
                .populate('userId', 'username avatar role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const total = await MovieList.countDocuments(filters);

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