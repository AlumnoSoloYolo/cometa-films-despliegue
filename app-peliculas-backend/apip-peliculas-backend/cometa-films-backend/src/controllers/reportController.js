const Report = require('../models/report.model');
const User = require('../models/user.model');
const Review = require('../models/review.model');
const Comment = require('../models/comment.model');
const MovieList = require('../models/movie-list.model');

// Importar las funciones de socket para notificaciones
const {
    sendSystemNotificationToUser,
    sendContentModerationNotification,
    sendUserBanNotification,
    sendUserWarningNotification
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
            reports: reports, // Cambiado de 'data' a 'reports'
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit),
                hasNext: skip + reports.length < total,
                hasPrev: page > 1,
                hasMore: skip + reports.length < total
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
// RESOLVER REPORTE - MEJORADO
// ========================================
const resolveReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const { action, notes } = req.body;
        const moderatorId = req.user.id;

        console.log(`Resolviendo reporte ${reportId} con acción: ${action}`);

        const report = await Report.findById(reportId)
            .populate('reporter', 'username')
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

        // Variables para tracking
        let actionTaken = false;
        let notificationsSent = [];

        // Ejecutar acciones según la resolución
        switch (action) {
            case 'content_deleted':
                const contentDeleted = await deleteReportedContent(
                    report.reportedContent.contentType,
                    report.reportedContent.contentId
                );

                if (contentDeleted) {
                    actionTaken = true;
                    
                    // Notificar al usuario reportado sobre la eliminación de contenido
                    console.log(`Enviando notificación de eliminación a usuario ${report.reportedUser._id}`);
                    const deletionNotificationSent = await sendContentDeletionByReportNotification(
                        report.reportedUser._id,
                        report.reportedContent.contentType,
                        report.reason,
                        notes || 'Tu contenido ha sido eliminado tras una revisión de moderación'
                    );
                    
                    if (deletionNotificationSent.success) {
                        notificationsSent.push('content_deletion');
                        console.log('✅ Notificación de eliminación enviada correctamente');
                    } else {
                        console.log('❌ Error enviando notificación de eliminación:', deletionNotificationSent.error);
                    }
                } else {
                    console.log('⚠️ No se pudo eliminar el contenido');
                }
                break;

            case 'user_warned':
                actionTaken = true;
                
                // Notificar al usuario reportado sobre la advertencia
                console.log(`Enviando advertencia a usuario ${report.reportedUser._id}`);
                const warningNotificationSent = await sendWarningByReportNotification(
                    report.reportedUser._id,
                    report.reason,
                    notes || 'Has recibido una advertencia tras la revisión de un reporte'
                );
                
                if (warningNotificationSent.success) {
                    notificationsSent.push('user_warning');
                    console.log('✅ Notificación de advertencia enviada correctamente');
                } else {
                    console.log('❌ Error enviando notificación de advertencia:', warningNotificationSent.error);
                }
                break;

            case 'user_banned':
                // El ban debe ser manejado por el controlador de admin
                // Aquí solo registramos que se decidió banear
                actionTaken = true;
                console.log(`Reporte resuelto con decisión de ban para usuario ${report.reportedUser.username}`);
                
                // Enviar notificación de que se ha tomado acción de ban
                const banNotificationSent = await sendUserBanNotification(
                    report.reportedUser._id,
                    notes || `Tu cuenta ha sido suspendida tras la revisión de un reporte. Motivo: ${getReportReasonDisplayName(report.reason)}`,
                    null // Ban permanente por defecto desde reportes
                );
                
                if (banNotificationSent.success) {
                    notificationsSent.push('user_ban_notification');
                    console.log('✅ Notificación de ban enviada correctamente');
                }
                break;

            case 'no_action':
                actionTaken = true;
                console.log(`Reporte resuelto sin acción para reporte ${reportId}`);
                break;

            default:
                console.log(`Acción personalizada: ${action} para reporte ${reportId}`);
                actionTaken = true;
                break;
        }

        // SIEMPRE notificar al reporter sobre la resolución
        const reporterNotificationSent = await sendReportResolutionNotification(
            report.reporter._id,
            report,
            action,
            notes
        );
        
        if (reporterNotificationSent) {
            notificationsSent.push('reporter_resolution');
        }

        res.json({
            success: true,
            message: 'Reporte resuelto correctamente',
            data: {
                reportId: report._id,
                action,
                actionTaken,
                notificationsSent,
                contentDeleted: action === 'content_deleted' && actionTaken
            }
        });

        console.log(`Reporte ${reportId} resuelto por moderador ${moderatorId} con acción: ${action}`);
        console.log(`Notificaciones enviadas: ${notificationsSent.join(', ')}`);

    } catch (error) {
        console.error('Error al resolver reporte:', error);
        res.status(500).json({
            success: false,
            message: 'Error al resolver el reporte'
        });
    }
};

// ========================================
// FUNCIONES AUXILIARES MEJORADAS
// ========================================

/**
 * Eliminar contenido reportado
 */
const deleteReportedContent = async (contentType, contentId) => {
    try {
        if (!contentId) {
            console.log('No hay contentId para eliminar');
            return false;
        }

        switch (contentType) {
            case 'review':
                const review = await Review.findByIdAndDelete(contentId);
                if (review) {
                    // También eliminar comentarios asociados
                    await Comment.deleteMany({ reviewId: contentId });
                    console.log(`Reseña ${contentId} eliminada con sus comentarios`);
                    return true;
                }
                break;
                
            case 'comment':
                const comment = await Comment.findByIdAndDelete(contentId);
                if (comment) {
                    // También eliminar respuestas al comentario
                    await Comment.deleteMany({ parentId: contentId });
                    console.log(`Comentario ${contentId} eliminado con sus respuestas`);
                    return true;
                }
                break;
                
            case 'list':
                const list = await MovieList.findByIdAndDelete(contentId);
                if (list) {
                    console.log(`Lista ${contentId} eliminada`);
                    return true;
                }
                break;
                
            default:
                console.log(`Tipo de contenido no soportado para eliminación: ${contentType}`);
                return false;
        }
        
        console.log(`Contenido ${contentId} no encontrado para eliminación`);
        return false;
    } catch (error) {
        console.error(`Error eliminando contenido ${contentType}:`, error);
        return false;
    }
};

/**
 * Enviar notificación de eliminación de contenido
 */
const sendContentDeletionNotification = async (userId, contentType, reason) => {
    try {
        const contentTypeNames = {
            'review': 'reseña',
            'comment': 'comentario',
            'list': 'lista personalizada'
        };

        const contentName = contentTypeNames[contentType] || 'contenido';

        return await sendSystemNotificationToUser(userId, {
            notificationType: 'content_moderated',
            title: 'Contenido eliminado',
            message: `Tu ${contentName} ha sido eliminado por violar las normas de la comunidad.`,
            reason: reason,
            severity: 'warning',
            category: 'moderation',
            actionRequired: false,
            metadata: {
                contentType: contentType,
                action: 'deleted',
                moderationReason: reason
            }
        });
    } catch (error) {
        console.error('Error enviando notificación de eliminación de contenido:', error);
        return false;
    }
};

/**
 * Enviar notificación de resolución al reporter
 */
const sendReportResolutionNotification = async (reporterId, report, action, notes) => {
    try {
        const actionMessages = {
            'no_action': 'Tu reporte ha sido revisado. No se encontraron violaciones de las normas.',
            'content_deleted': 'Tu reporte ha sido revisado y el contenido reportado ha sido eliminado.',
            'user_warned': 'Tu reporte ha sido revisado y se ha enviado una advertencia al usuario.',
            'user_banned': 'Tu reporte ha sido revisado y se han tomado medidas contra la cuenta del usuario.',
            'other': 'Tu reporte ha sido revisado y se han tomado las medidas apropiadas.'
        };

        const message = actionMessages[action] || 'Tu reporte ha sido revisado por nuestro equipo.';
        const contentTypeName = getContentTypeDisplayName(report.reportedContent.contentType);

        return await sendSystemNotificationToUser(reporterId, {
            notificationType: 'report_resolved',
            title: 'Reporte resuelto',
            message: message,
            reason: notes || 'Reporte procesado por el equipo de moderación',
            severity: 'info',
            category: 'reports',
            actionRequired: false,
            metadata: {
                reportId: report._id,
                reportedContentType: report.reportedContent.contentType,
                reportedUser: report.reportedUser.username,
                action: action,
                moderatorNotes: notes
            }
        });
    } catch (error) {
        console.error('Error enviando notificación de resolución al reporter:', error);
        return false;
    }
};

/**
 * Enviar notificación de eliminación de contenido por reporte
 */
const sendContentDeletionByReportNotification = async (userId, contentType, reportReason, moderatorNotes) => {
    try {
        console.log(`Enviando notificación de eliminación por reporte a usuario ${userId}`);
        
        const { sendSystemNotificationToUser } = require('../services/notification.service');
        
        const contentTypeNames = {
            'review': 'reseña',
            'comment': 'comentario',
            'list': 'lista personalizada'
        };

        const contentName = contentTypeNames[contentType] || 'contenido';
        const reasonText = getReportReasonDisplayName(reportReason);

        return await sendSystemNotificationToUser(userId, {
            notificationType: 'content_deleted_by_report',
            title: 'Contenido eliminado',
            message: `Tu ${contentName} ha sido eliminado tras una revisión de moderación.`,
            reason: `Motivo del reporte: ${reasonText}. ${moderatorNotes || ''}`,
            severity: 'warning',
            category: 'moderation',
            actionRequired: false,
            metadata: {
                contentType: contentType,
                action: 'deleted',
                reportReason: reportReason,
                moderatorNotes: moderatorNotes
            }
        });
    } catch (error) {
        console.error('Error enviando notificación de eliminación por reporte:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Enviar notificación de advertencia por reporte
 */
const sendWarningByReportNotification = async (userId, reportReason, moderatorNotes) => {
    try {
        console.log(`Enviando notificación de advertencia por reporte a usuario ${userId}`);
        
        const { sendSystemNotificationToUser } = require('../services/notification.service');
        const reasonText = getReportReasonDisplayName(reportReason);

        return await sendSystemNotificationToUser(userId, {
            notificationType: 'warning_by_report',
            title: 'Advertencia por reporte',
            message: 'Has recibido una advertencia tras la revisión de un reporte sobre tu actividad.',
            reason: `Motivo del reporte: ${reasonText}. ${moderatorNotes || ''}`,
            severity: 'warning',
            category: 'moderation',
            actionRequired: false,
            metadata: {
                action: 'warning',
                reportReason: reportReason,
                moderatorNotes: moderatorNotes
            }
        });
    } catch (error) {
        console.error('Error enviando notificación de advertencia por reporte:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Obtener nombre de display para motivos de reporte
 */
const getReportReasonDisplayName = (reason) => {
    const reasonMap = {
        'inappropriate_language': 'Lenguaje inapropiado',
        'harassment': 'Acoso',
        'discrimination': 'Discriminación',
        'spam': 'Spam',
        'inappropriate_content': 'Contenido inapropiado',
        'violence_threats': 'Amenazas de violencia',
        'false_information': 'Información falsa',
        'hate_speech': 'Discurso de odio',
        'sexual_content': 'Contenido sexual',
        'copyright_violation': 'Violación de derechos de autor',
        'impersonation': 'Suplantación de identidad',
        'other': 'Otro'
    };
    return reasonMap[reason] || reason;
};

// ========================================
// ACTUALIZAR ESTADO DEL REPORTE - MEJORADO
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
        ).populate('reporter', 'username');

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Reporte no encontrado'
            });
        }

        // Si se marca como "en revisión", notificar al reporter
        if (status === 'under_review') {
            await sendReportStatusUpdateNotification(
                report.reporter._id,
                report,
                'under_review'
            );
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

/**
 * Notificar cambio de estado del reporte
 */
const sendReportStatusUpdateNotification = async (reporterId, report, newStatus) => {
    try {
        const statusMessages = {
            'under_review': 'Tu reporte está siendo revisado por nuestro equipo de moderación.',
            'dismissed': 'Tu reporte ha sido revisado y se ha determinado que no requiere acción.'
        };

        const message = statusMessages[newStatus] || `Tu reporte ha cambiado al estado: ${newStatus}`;

        return await sendSystemNotificationToUser(reporterId, {
            notificationType: 'report_status_update',
            title: 'Actualización de reporte',
            message: message,
            severity: 'info',
            category: 'reports',
            actionRequired: false,
            metadata: {
                reportId: report._id,
                newStatus: newStatus,
                reportedContentType: report.reportedContent.contentType
            }
        });
    } catch (error) {
        console.error('Error enviando notificación de actualización de estado:', error);
        return false;
    }
};

module.exports = {
    createReport,
    getReports,
    resolveReport,
    updateReportStatus
};