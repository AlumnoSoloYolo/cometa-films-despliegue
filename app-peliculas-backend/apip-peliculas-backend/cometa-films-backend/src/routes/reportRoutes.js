const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permissions.middleware');

const {
    createReport,
    getReports,
    resolveReport,
    updateReportStatus
} = require('../controllers/reportController');

// ========================================
// RUTAS PÚBLICAS (CON AUTENTICACIÓN)
// ========================================

/**
 * POST /reports
 * Crear un nuevo reporte - Cualquier usuario autenticado
 */
router.post('/',
    auth,
    requirePermission('reports.create'),
    createReport
);

// ========================================
// RUTAS DE ADMINISTRACIÓN Y MODERACIÓN
// ========================================

/**
 * GET /reports
 * Obtener lista de reportes (solo moderadores y admins)
 */
router.get('/',
    auth,
    requirePermission('moderate.reports.view'),
    getReports
);

/**
 * PATCH /reports/:reportId/resolve
 * Resolver un reporte específico
 */
router.patch('/:reportId/resolve',
    auth,
    requirePermission('moderate.reports.manage'),
    resolveReport
);

/**
 * PATCH /reports/:reportId/status
 * Actualizar estado de un reporte
 */
router.patch('/:reportId/status',
    auth,
    requirePermission('moderate.reports.manage'),
    updateReportStatus
);

// ========================================
// RUTAS DE ESTADÍSTICAS (ADMINS)
// ========================================

/**
 * GET /reports/stats
 * Obtener estadísticas de reportes
 */
router.get('/stats',
    auth,
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

            // Total de reportes
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

// ========================================
// RUTAS DE REPORTES POR USUARIO
// ========================================

/**
 * GET /reports/user/:userId
 * Obtener reportes hechos por un usuario específico
 */
router.get('/user/:userId',
    auth,
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
 * GET /reports/against/:userId
 * Obtener reportes contra un usuario específico
 */
router.get('/against/:userId',
    auth,
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

// ========================================
// RUTAS DE CONTENIDO ESPECÍFICO
// ========================================

/**
 * GET /reports/content/:contentType/:contentId
 * Obtener reportes de un contenido específico
 */
router.get('/content/:contentType/:contentId',
    auth,
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
// RUTAS DE REPORTES PROPIOS (USUARIO NORMAL)
// ========================================

/**
 * GET /reports/my-reports
 * Obtener reportes creados por el usuario actual
 */
router.get('/my-reports',
    auth,
    async (req, res) => {
        try {
            const { page = 1, limit = 10, status } = req.query;
            const skip = (parseInt(page) - 1) * parseInt(limit);

            const filters = { reporter: req.user.id };
            if (status) {
                filters.status = status;
            }

            const Report = require('../models/report.model');
            const reports = await Report.find(filters)
                .populate('reportedUser', 'username avatar')
                .populate('resolution.resolvedBy', 'username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .select('-reporter'); // No incluir información del reporter (es el mismo usuario)

            const total = await Report.countDocuments(filters);

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
                message: 'Error al obtener tus reportes'
            });
        }
    }
);

// ========================================
// RUTAS DE UTILIDADES
// ========================================

/**
 * GET /reports/reasons
 * Obtener lista de motivos de reporte disponibles
 */
router.get('/reasons',
    auth,
    (req, res) => {
        const reasons = [
            { value: 'inappropriate_language', label: 'Lenguaje inapropiado' },
            { value: 'harassment', label: 'Acoso' },
            { value: 'discrimination', label: 'Discriminación' },
            { value: 'spam', label: 'Spam' },
            { value: 'inappropriate_content', label: 'Contenido inapropiado' },
            { value: 'violence_threats', label: 'Amenazas de violencia' },
            { value: 'false_information', label: 'Información falsa' },
            { value: 'hate_speech', label: 'Discurso de odio' },
            { value: 'sexual_content', label: 'Contenido sexual' },
            { value: 'copyright_violation', label: 'Violación de derechos de autor' },
            { value: 'impersonation', label: 'Suplantación de identidad' },
            { value: 'other', label: 'Otro' }
        ];

        res.json({
            success: true,
            reasons: reasons
        });
    }
);

/**
 * GET /reports/content-types
 * Obtener lista de tipos de contenido reportables
 */
router.get('/content-types',
    auth,
    (req, res) => {
        const contentTypes = [
            { value: 'user', label: 'Perfil de usuario' },
            { value: 'review', label: 'Reseña' },
            { value: 'comment', label: 'Comentario' },
            { value: 'list', label: 'Lista personalizada' }
        ];

        res.json({
            success: true,
            contentTypes: contentTypes
        });
    }
);

// ========================================
// MIDDLEWARE DE MANEJO DE ERRORES
// ========================================

router.use((error, req, res, next) => {
    console.error('Error en rutas de reportes:', error);

    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Error interno del servidor',
        code: error.code || 'REPORT_ERROR',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
});

module.exports = router;