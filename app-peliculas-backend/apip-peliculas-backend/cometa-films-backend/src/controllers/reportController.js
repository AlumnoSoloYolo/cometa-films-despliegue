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

        console.log(`🔧 Resolviendo reporte ${reportId} con acción: ${action}`);

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

        // EJECUTAR ACCIONES SEGÚN LA RESOLUCIÓN
        switch (action) {
            case 'content_deleted':
                const contentDeleted = await deleteReportedContent(
                    report.reportedContent.contentType,
                    report.reportedContent.contentId
                );

                if (contentDeleted) {
                    actionTaken = true;
                    
                    // Notificar al usuario reportado
                    try {
                        const deletionNotificationSent = await sendSystemNotificationToUser(report.reportedUser._id, {
                            notificationType: 'content_deleted_by_report',
                            title: 'Contenido eliminado',
                            message: `Tu ${getContentTypeName(report.reportedContent.contentType)} ha sido eliminado tras una revisión de moderación.`,
                            reason: `Motivo: ${getReportReasonDisplayName(report.reason)}. ${notes || ''}`,
                            severity: 'warning',
                            category: 'moderation',
                            actionRequired: false,
                            metadata: {
                                contentType: report.reportedContent.contentType,
                                action: 'deleted',
                                reportReason: report.reason
                            }
                        });
                        
                        if (deletionNotificationSent) {
                            notificationsSent.push('content_deletion');
                            console.log('✅ Notificación de eliminación enviada al usuario reportado');
                        }
                    } catch (error) {
                        console.log('⚠️ Error enviando notificación de eliminación:', error.message);
                    }
                }
                break;

            case 'user_warned':
                actionTaken = true;
                
                try {
                    const warningNotificationSent = await sendSystemNotificationToUser(report.reportedUser._id, {
                        notificationType: 'warning_by_report',
                        title: 'Advertencia por reporte',
                        message: 'Has recibido una advertencia tras la revisión de un reporte sobre tu actividad.',
                        reason: `Motivo: ${getReportReasonDisplayName(report.reason)}. ${notes || ''}`,
                        severity: 'warning',
                        category: 'moderation',
                        actionRequired: false,
                        metadata: {
                            action: 'warning',
                            reportReason: report.reason
                        }
                    });
                    
                    if (warningNotificationSent) {
                        notificationsSent.push('user_warning');
                        console.log('✅ Notificación de advertencia enviada al usuario reportado');
                    }
                } catch (error) {
                    console.log('⚠️ Error enviando notificación de advertencia:', error.message);
                }
                break;

            case 'user_banned':
                actionTaken = true;
                
                try {
                    const userToBan = await User.findById(report.reportedUser._id);
                    if (userToBan && !userToBan.isBanned) {
                        // BANEAR AL USUARIO REALMENTE
                        userToBan.isBanned = true;
                        userToBan.banReason = `Reporte resuelto: ${getReportReasonDisplayName(report.reason)}. ${notes || ''}`;
                        userToBan.bannedAt = new Date();
                        userToBan.bannedBy = moderatorId;
                        userToBan.banExpiresAt = null;

                        // Agregar al historial
                        userToBan.moderationHistory.push({
                            action: 'ban',
                            reason: userToBan.banReason,
                            moderator: moderatorId,
                            date: new Date(),
                            details: `Ban por reporte resuelto`
                        });

                        await userToBan.save();

                        // Invalidar sesiones
                        try {
                            const TokenBlacklist = require('../models/tokenBlackList.model');
                            await TokenBlacklist.create({
                                userId: userToBan._id,
                                reason: 'user_banned_by_report',
                                invalidatedBy: moderatorId,
                                invalidatedAt: new Date()
                            });
                        } catch (tokenError) {
                            console.log('⚠️ Error invalidando tokens:', tokenError.message);
                        }

                        console.log(`🚫 Usuario ${userToBan.username} baneado por reporte`);
                        
                        // Notificar ban al usuario reportado
                        try {
                            const banNotificationSent = await sendSystemNotificationToUser(userToBan._id, {
                                notificationType: 'account_banned_by_report',
                                title: 'Cuenta suspendida',
                                message: 'Tu cuenta ha sido suspendida permanentemente.',
                                reason: userToBan.banReason,
                                severity: 'error',
                                category: 'account',
                                actionRequired: true,
                                metadata: {
                                    banType: 'permanent',
                                    banReason: userToBan.banReason
                                }
                            });
                            
                            if (banNotificationSent) {
                                notificationsSent.push('user_ban');
                                console.log('✅ Notificación de ban enviada al usuario reportado');
                            }
                        } catch (error) {
                            console.log('⚠️ Error enviando notificación de ban:', error.message);
                        }
                    }
                } catch (error) {
                    console.error('❌ Error baneando usuario:', error);
                }
                break;

            case 'no_action':
                actionTaken = true;
                console.log('ℹ️ Reporte resuelto sin acción');
                break;

            default:
                actionTaken = true;
                console.log(`🔧 Acción personalizada: ${action}`);
                break;
        }

        // 🔥 NOTIFICAR AL REPORTER SIEMPRE (ESTO ES LO CRÍTICO)
        try {
            console.log(`📧 Enviando notificación de resolución al reporter: ${report.reporter._id} (${report.reporter.username})`);
            
            // Mensajes específicos según la acción tomada
            const actionMessages = {
                'no_action': 'Tu reporte ha sido revisado y analizado. No se encontraron violaciones de las normas de la comunidad en este caso.',
                'content_deleted': 'Tu reporte ha sido revisado y confirmado. El contenido reportado ha sido eliminado por violar nuestras normas.',
                'user_warned': 'Tu reporte ha sido revisado y confirmado. Se ha enviado una advertencia oficial al usuario reportado.',
                'user_banned': 'Tu reporte ha sido revisado y confirmado. Se han tomado medidas disciplinarias severas contra la cuenta del usuario reportado.',
                'other': 'Tu reporte ha sido revisado y se han tomado las medidas apropiadas según nuestras políticas.'
            };

            // Información detallada para el reporter
            const detailedMessage = actionMessages[action] || 'Tu reporte ha sido procesado por nuestro equipo de moderación.';
            
            // Agregar contexto sobre qué se reportó
            const contentTypeText = getContentTypeName(report.reportedContent.contentType);
            const reasonText = getReportReasonDisplayName(report.reason);
            
            const contextualReason = `Reporte sobre ${contentTypeText} por "${reasonText}" - ${detailedMessage}` + 
                (notes ? ` Notas del moderador: ${notes}` : '');

            const reporterNotificationSent = await sendSystemNotificationToUser(report.reporter._id, {
                notificationType: 'report_resolved',
                title: 'Reporte resuelto',
                message: detailedMessage,
                reason: contextualReason,
                severity: action === 'no_action' ? 'info' : 'success',
                category: 'reports',
                actionRequired: false,
                metadata: {
                    reportId: report._id,
                    reportedContentType: report.reportedContent.contentType,
                    reportedUser: report.reportedUser.username,
                    reportReason: report.reason,
                    action: action,
                    moderatorNotes: notes,
                    actionTaken: actionTaken,
                    resolvedAt: new Date().toISOString()
                }
            });
            
            if (reporterNotificationSent) {
                notificationsSent.push('reporter_resolution');
                console.log('✅ Notificación de resolución enviada al reporter exitosamente');
            } else {
                console.log('❌ Falló el envío de notificación al reporter');
            }
        } catch (error) {
            console.error('❌ Error crítico enviando notificación al reporter:', error);
        }

        // Respuesta exitosa
        res.json({
            success: true,
            message: 'Reporte resuelto correctamente',
            data: {
                reportId: report._id,
                action,
                actionTaken,
                notificationsSent,
                userBanned: action === 'user_banned' && actionTaken,
                reporterNotified: notificationsSent.includes('reporter_resolution')
            }
        });

        console.log(`✨ Reporte ${reportId} resuelto completamente:`);
        console.log(`   - Acción: ${action}`);
        console.log(`   - Notificaciones enviadas: ${notificationsSent.join(', ')}`);
        console.log(`   - Reporter notificado: ${notificationsSent.includes('reporter_resolution') ? 'SÍ' : 'NO'}`);

    } catch (error) {
        console.error('❌ Error al resolver reporte:', error);
        res.status(500).json({
            success: false,
            message: 'Error al resolver el reporte',
            error: error.message
        });
    }
};

// FUNCIÓN AUXILIAR para nombres de contenido
// 🔥 FUNCIÓN AUXILIAR MEJORADA para nombres de contenido
function getContentTypeName(contentType) {
    const names = {
        'review': 'reseña',
        'comment': 'comentario', 
        'list': 'lista personalizada',
        'user': 'perfil de usuario'
    };
    return names[contentType] || 'contenido';
}

// 🔥 FUNCIÓN AUXILIAR MEJORADA para razones de reporte
function getReportReasonDisplayName(reason) {
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
        'other': 'Otro motivo'
    };
    return reasonMap[reason] || reason;
}

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
        ).populate('reporter', 'username').populate('reportedUser', 'username');

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Reporte no encontrado'
            });
        }

        // 🔥 NOTIFICAR AL REPORTER SOBRE CAMBIO DE ESTADO
        if (status === 'under_review') {
            try {
                console.log(`📧 Notificando cambio de estado a reporter: ${report.reporter._id}`);
                
                const statusNotificationSent = await sendSystemNotificationToUser(report.reporter._id, {
                    notificationType: 'report_status_update',
                    title: 'Reporte en revisión',
                    message: 'Tu reporte está siendo revisado por nuestro equipo de moderación.',
                    reason: `Reporte sobre ${getContentTypeName(report.reportedContent.contentType)} por "${getReportReasonDisplayName(report.reason)}" ahora está en revisión.` + 
                            (notes ? ` Notas: ${notes}` : ''),
                    severity: 'info',
                    category: 'reports',
                    actionRequired: false,
                    metadata: {
                        reportId: report._id,
                        newStatus: status,
                        reportedContentType: report.reportedContent.contentType,
                        reportedUser: report.reportedUser.username
                    }
                });
                
                if (statusNotificationSent) {
                    console.log('✅ Notificación de cambio de estado enviada al reporter');
                }
            } catch (error) {
                console.log('⚠️ Error enviando notificación de estado:', error.message);
            }
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