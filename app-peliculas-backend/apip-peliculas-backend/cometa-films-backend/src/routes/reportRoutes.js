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

// Crear un nuevo reporte
router.post('/',
    auth,
    requirePermission('reports.create'),
    createReport
);

// ========================================
// RUTAS DE ADMINISTRACIÓN
// ========================================

// Obtener lista de reportes (solo moderadores y admins)
router.get('/',
    auth,
    requirePermission('moderate.reports.view'),
    getReports
);

// Resolver un reporte específico
router.patch('/:reportId/resolve',
    auth,
    requirePermission('moderate.reports.manage'),
    resolveReport
);

// Actualizar estado de un reporte
router.patch('/:reportId/status',
    auth,
    requirePermission('moderate.reports.manage'),
    updateReportStatus
);

// ========================================
// RUTAS DE ESTADÍSTICAS (ADMINS)
// ========================================

// Obtener estadísticas de reportes
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
            const resolvedReports = await Report.countDocuments({ status: 'resolved' });

            res.json({
                success: true,
                data: {
                    summary: {
                        total: totalReports,
                        pending: pendingReports,
                        resolved: resolvedReports,
                        resolutionRate: totalReports > 0 ? ((resolvedReports / totalReports) * 100).toFixed(1) : 0
                    },
                    byStatus: statusStats,
                    byContentType: contentTypeStats,
                    byReason: reasonStats,
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

// Obtener reportes hechos por un usuario específico
router.get('/user/:userId',
    auth,
    requirePermission('moderate.reports.view'),
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const reports = await Report.find({ reporter: userId })
                .populate('reportedUser', 'username avatar')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Report.countDocuments({ reporter: userId });

            res.json({
                success: true,
                data: reports,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: skip + reports.length < total,
                    hasPrev: page > 1
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

// Obtener reportes contra un usuario específico
router.get('/against/:userId',
    auth,
    requirePermission('moderate.reports.view'),
    async (req, res) => {
        try {
            const { userId } = req.params;
            const { page = 1, limit = 10 } = req.query;

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const reports = await Report.find({ reportedUser: userId })
                .populate('reporter', 'username avatar')
                .populate('resolution.resolvedBy', 'username')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const total = await Report.countDocuments({ reportedUser: userId });

            res.json({
                success: true,
                data: reports,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: skip + reports.length < total,
                    hasPrev: page > 1
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

// Obtener reportes de un contenido específico
router.get('/content/:contentType/:contentId',
    auth,
    requirePermission('moderate.reports.view'),
    async (req, res) => {
        try {
            const { contentType, contentId } = req.params;

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
                data: reports,
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

module.exports = router;