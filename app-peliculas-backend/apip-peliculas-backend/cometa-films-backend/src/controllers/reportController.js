const Report = require('../models/report.model');
const User = require('../models/user.model');
const Review = require('../models/review.model');
const Comment = require('../models/comment.model');
const MovieList = require('../models/movie-list.model');

// Importar las funciones de socket para notificaciones
const {
    sendSystemNotificationToUser,
    sendContentModerationNotification
} = require('../socket');

// ========================================
// CREAR REPORTE
// ========================================
const createReport = async (req, res) => {
    try {
        const { reportedUserId, contentType, contentId, reason, description } = req.body;
        const reporterId = req.user.id;

        // Validaciones básicas
        if (!reportedUserId || !contentType || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Datos incompletos para crear el reporte'
            });
        }

        // No permitir auto-reportes
        if (reporterId === reportedUserId) {
            return res.status(400).json({
                success: false,
                message: 'No puedes reportarte a ti mismo'
            });
        }

        // Verificar que el usuario reportado existe
        const reportedUser = await User.findById(reportedUserId);
        if (!reportedUser) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Obtener snapshot del contenido si no es un reporte de usuario
        let contentSnapshot = {};
        let actualContentId = null;

        if (contentType !== 'user' && contentId) {
            actualContentId = contentId;

            switch (contentType) {
                case 'review':
                    const review = await Review.findById(contentId);
                    if (review) {
                        contentSnapshot = {
                            text: review.comment,
                            rating: review.rating
                        };
                    }
                    break;

                case 'comment':
                    const comment = await Comment.findById(contentId);
                    if (comment) {
                        contentSnapshot = {
                            text: comment.text
                        };
                    }
                    break;

                case 'list':
                    const list = await MovieList.findById(contentId);
                    if (list) {
                        contentSnapshot = {
                            title: list.title,
                            description: list.description
                        };
                    }
                    break;
            }
        }

        // Verificar si ya existe un reporte pendiente similar
        const existingReport = await Report.findOne({
            reporter: reporterId,
            reportedUser: reportedUserId,
            'reportedContent.contentType': contentType,
            'reportedContent.contentId': actualContentId,
            status: { $in: ['pending', 'under_review'] }
        });

        if (existingReport) {
            return res.status(409).json({
                success: false,
                message: 'Ya has reportado este contenido anteriormente'
            });
        }

        // Determinar prioridad automáticamente
        let priority = 'medium';
        if (['violence_threats', 'hate_speech', 'harassment'].includes(reason)) {
            priority = 'high';
        } else if (['spam', 'inappropriate_language'].includes(reason)) {
            priority = 'low';
        }

        // Determinar categoría
        let category = 'content';
        if (['harassment', 'violence_threats', 'hate_speech'].includes(reason)) {
            category = 'safety';
        } else if (reason === 'spam') {
            category = 'spam';
        } else if (['copyright_violation', 'impersonation'].includes(reason)) {
            category = 'legal';
        }

        // Crear el reporte
        const newReport = new Report({
            reporter: reporterId,
            reportedUser: reportedUserId,
            reportedContent: {
                contentType,
                contentId: actualContentId,
                contentSnapshot
            },
            reason,
            description: description?.trim(),
            priority,
            category
        });

        await newReport.save();

        // Respuesta sin datos sensibles
        res.status(201).json({
            success: true,
            message: 'Reporte enviado correctamente. Será revisado por nuestro equipo de moderación.',
            data: {
                reportId: newReport._id,
                status: newReport.status,
                createdAt: newReport.createdAt
            }
        });

        console.log(`Nuevo reporte creado: ${newReport._id} por usuario ${reporterId}`);

    } catch (error) {
        console.error('Error al crear reporte:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor al crear el reporte'
        });
    }
};

// ========================================
// OBTENER REPORTES (ADMIN)
// ========================================
const getReports = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            contentType,
            priority,
            reason
        } = req.query;

        // Construir filtros
        const filters = {};
        if (status) filters.status = status;
        if (contentType) filters['reportedContent.contentType'] = contentType;
        if (priority) filters.priority = priority;
        if (reason) filters.reason = reason;

        // Calcular skip
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Obtener reportes con población
        const reports = await Report.find(filters)
            .populate('reporter', 'username avatar')
            .populate('reportedUser', 'username avatar role isBanned')
            .populate('resolution.resolvedBy', 'username')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Contar total
        const total = await Report.countDocuments(filters);

        // Estadísticas rápidas
        const stats = await Report.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const statusCounts = stats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
        }, {});

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
            },
            stats: statusCounts
        });

    } catch (error) {
        console.error('Error al obtener reportes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener reportes'
        });
    }
};

// ========================================
// RESOLVER REPORTE
// ========================================
const resolveReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { action, notes, deleteContent = false } = req.body;
        const moderatorId = req.user.id;

        const report = await Report.findById(reportId)
            .populate('reportedUser', 'username')
            .populate('reportedContent.contentId');

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Reporte no encontrado'
            });
        }

        if (report.status === 'resolved') {
            return res.status(400).json({
                success: false,
                message: 'Este reporte ya ha sido resuelto'
            });
        }

        // Actualizar el reporte
        report.status = 'resolved';
        report.resolution = {
            action,
            notes: notes?.trim(),
            resolvedBy: moderatorId,
            resolvedAt: new Date()
        };
        report.moderatorNotes = notes?.trim();

        await report.save();

        // Ejecutar acciones según la resolución
        let notificationMessage = '';

        if (deleteContent && report.reportedContent.contentId) {
            const success = await deleteReportedContent(
                report.reportedContent.contentType,
                report.reportedContent.contentId
            );

            if (success) {
                notificationMessage = getContentDeletionMessage(report.reportedContent.contentType);

                // Enviar notificación al usuario usando socket
                const notificationSent = sendContentModerationNotification(
                    report.reportedUser._id,
                    report.reportedContent.contentType,
                    notes || 'Violación de las normas de la comunidad'
                );

                console.log(`Notificación enviada: ${notificationSent}`);
            }
        }

        res.json({
            success: true,
            message: 'Reporte resuelto correctamente',
            data: {
                reportId: report._id,
                action,
                contentDeleted: deleteContent,
                notificationSent: !!notificationMessage
            }
        });

        console.log(`Reporte ${reportId} resuelto por moderador ${moderatorId} con acción: ${action}`);

    } catch (error) {
        console.error('Error al resolver reporte:', error);
        res.status(500).json({
            success: false,
            message: 'Error al resolver el reporte'
        });
    }
};

// ========================================
// FUNCIONES AUXILIARES
// ========================================
const deleteReportedContent = async (contentType, contentId) => {
    try {
        switch (contentType) {
            case 'review':
                await Review.findByIdAndDelete(contentId);
                return true;
            case 'comment':
                await Comment.findByIdAndDelete(contentId);
                return true;
            case 'list':
                await MovieList.findByIdAndDelete(contentId);
                return true;
            default:
                return false;
        }
    } catch (error) {
        console.error(`Error eliminando contenido ${contentType}:`, error);
        return false;
    }
};

const getContentDeletionMessage = (contentType) => {
    const messages = {
        'review': 'Tu reseña ha sido eliminada por violar las normas de la comunidad.',
        'comment': 'Tu comentario ha sido eliminado por violar las normas de la comunidad.',
        'list': 'Tu lista personalizada ha sido eliminada por violar las normas de la comunidad.'
    };
    return messages[contentType] || 'Tu contenido ha sido moderado.';
};

// ========================================
// ACTUALIZAR ESTADO DEL REPORTE
// ========================================
const updateReportStatus = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status, notes } = req.body;

        const report = await Report.findByIdAndUpdate(
            reportId,
            {
                status,
                moderatorNotes: notes?.trim(),
                ...(status === 'under_review' && { updatedAt: new Date() })
            },
            { new: true }
        );

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Reporte no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Estado del reporte actualizado',
            data: report
        });

    } catch (error) {
        console.error('Error al actualizar estado del reporte:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar el estado'
        });
    }
};

module.exports = {
    createReport,
    getReports,
    resolveReport,
    updateReportStatus
};