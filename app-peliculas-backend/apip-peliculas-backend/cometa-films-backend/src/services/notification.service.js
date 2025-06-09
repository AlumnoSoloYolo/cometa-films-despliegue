const { sendMessageToUser } = require('../socket');

// ========================================
// SERVICIO DE NOTIFICACIONES DEL SISTEMA MEJORADO
// ========================================

/**
 * Envía una notificación del sistema a un usuario específico
 */
const sendSystemNotificationToUser = async (userId, notificationData) => {
    try {
        console.log(`Enviando notificación del sistema a usuario ${userId}:`, notificationData);

        const notification = {
            id: generateNotificationId(),
            type: 'system_notification',
            userId: userId,
            data: {
                notificationType: notificationData.type || notificationData.notificationType || 'general',
                title: notificationData.title || 'Notificación del sistema',
                message: notificationData.message || '',
                reason: notificationData.reason || null,
                actionRequired: notificationData.actionRequired || false,
                severity: notificationData.severity || 'info', // info, warning, error, success
                category: notificationData.category || 'system', // system, moderation, account, reports
                metadata: notificationData.metadata || {}
            },
            timestamp: new Date().toISOString(),
            read: false
        };

        // Enviar por Socket.IO
        const socketSent = sendMessageToUser(userId, notification);

        if (socketSent) {
            console.log(`✅ Notificación del sistema enviada por socket a usuario ${userId}`);
        } else {
            console.log(`⚠️ Usuario ${userId} no conectado, notificación no entregada por socket`);
        }

        return {
            success: true,
            delivered: socketSent,
            notificationId: notification.id
        };

    } catch (error) {
        console.error('Error enviando notificación del sistema:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Envía notificación de contenido moderado/eliminado
 */
const sendContentModerationNotification = async (userId, contentType, reason) => {
    const contentTypeNames = {
        'review': 'reseña',
        'comment': 'comentario',
        'list': 'lista personalizada'
    };

    const contentName = contentTypeNames[contentType] || 'contenido';

    return await sendSystemNotificationToUser(userId, {
        notificationType: 'content_moderated',
        title: 'Contenido moderado',
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
};

/**
 * Envía notificación de ban de usuario
 */
const sendUserBanNotification = async (userId, reason, expiresAt = null) => {
    const isPermanent = !expiresAt;
    const message = isPermanent
        ? 'Tu cuenta ha sido suspendida permanentemente.'
        : `Tu cuenta ha sido suspendida temporalmente hasta ${expiresAt.toLocaleDateString()}.`;

    return await sendSystemNotificationToUser(userId, {
        notificationType: 'account_banned',
        title: 'Cuenta suspendida',
        message: message,
        reason: reason,
        severity: 'error',
        category: 'account',
        actionRequired: true,
        metadata: {
            banType: isPermanent ? 'permanent' : 'temporary',
            expiresAt: expiresAt ? expiresAt.toISOString() : null,
            banReason: reason
        }
    });
};

/**
 * Envía notificación de advertencia/warning
 */
const sendUserWarningNotification = async (userId, reason) => {
    return await sendSystemNotificationToUser(userId, {
        notificationType: 'account_warning',
        title: 'Advertencia de moderación',
        message: 'Has recibido una advertencia por parte de nuestro equipo de moderación.',
        reason: reason,
        severity: 'warning',
        category: 'moderation',
        actionRequired: false,
        metadata: {
            action: 'warning',
            warningReason: reason
        }
    });
};

/**
 * Envía notificación de cambio de rol
 */
const sendRoleChangeNotification = async (userId, newRole, reason) => {
    const roleNames = {
        'user': 'Usuario',
        'premium': 'Premium',
        'moderator': 'Moderador',
        'admin': 'Administrador'
    };

    const roleName = roleNames[newRole] || newRole;

    return await sendSystemNotificationToUser(userId, {
        notificationType: 'role_changed',
        title: 'Rol actualizado',
        message: `Tu rol ha sido cambiado a ${roleName}.`,
        reason: reason,
        severity: 'info',
        category: 'account',
        actionRequired: false,
        metadata: {
            newRole: newRole,
            action: 'role_change',
            changeReason: reason
        }
    });
};

/**
 * NUEVO: Envía notificación de reporte resuelto al usuario que reportó
 */
const sendReportResolvedNotification = async (reporterId, reportInfo, action, moderatorNotes) => {
    const actionMessages = {
        'no_action': 'Tu reporte ha sido revisado. No se encontraron violaciones de las normas.',
        'content_deleted': 'Tu reporte ha sido revisado y el contenido reportado ha sido eliminado.',
        'user_warned': 'Tu reporte ha sido revisado y se ha enviado una advertencia al usuario.',
        'user_banned': 'Tu reporte ha sido revisado y se han tomado medidas contra la cuenta del usuario.',
        'other': 'Tu reporte ha sido revisado y se han tomado las medidas apropiadas.'
    };

    const message = actionMessages[action] || 'Tu reporte ha sido revisado por nuestro equipo.';
    const contentTypeName = getContentTypeDisplayName(reportInfo.contentType);

    return await sendSystemNotificationToUser(reporterId, {
        notificationType: 'report_resolved',
        title: 'Reporte resuelto',
        message: message,
        reason: moderatorNotes || 'Reporte procesado por el equipo de moderación',
        severity: action === 'no_action' ? 'info' : 'success',
        category: 'reports',
        actionRequired: false,
        metadata: {
            reportId: reportInfo.reportId,
            reportedContentType: reportInfo.contentType,
            reportedUser: reportInfo.reportedUsername,
            action: action,
            moderatorNotes: moderatorNotes
        }
    });
};

/**
 * NUEVO: Envía notificación de cambio de estado del reporte
 */
const sendReportStatusNotification = async (reporterId, reportInfo, newStatus) => {
    const statusMessages = {
        'under_review': 'Tu reporte está siendo revisado por nuestro equipo de moderación.',
        'dismissed': 'Tu reporte ha sido revisado y se ha determinado que no requiere acción.'
    };

    const message = statusMessages[newStatus] || `Tu reporte ha cambiado al estado: ${newStatus}`;
    const contentTypeName = getContentTypeDisplayName(reportInfo.contentType);

    return await sendSystemNotificationToUser(reporterId, {
        notificationType: 'report_status_update',
        title: 'Actualización de reporte',
        message: message,
        severity: 'info',
        category: 'reports',
        actionRequired: false,
        metadata: {
            reportId: reportInfo.reportId,
            newStatus: newStatus,
            reportedContentType: reportInfo.contentType
        }
    });
};

/**
 * NUEVO: Envía notificación específica cuando se elimina contenido por reporte
 */
const sendContentDeletionByReportNotification = async (userId, contentType, reportReason, moderatorNotes) => {
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
        reason: `Motivo: ${reasonText}. ${moderatorNotes || ''}`,
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
};

/**
 * NUEVO: Envía notificación de advertencia por reporte
 */
const sendWarningByReportNotification = async (userId, reportReason, moderatorNotes) => {
    const reasonText = getReportReasonDisplayName(reportReason);

    return await sendSystemNotificationToUser(userId, {
        notificationType: 'warning_by_report',
        title: 'Advertencia por reporte',
        message: 'Has recibido una advertencia tras la revisión de un reporte sobre tu actividad.',
        reason: `Motivo: ${reasonText}. ${moderatorNotes || ''}`,
        severity: 'warning',
        category: 'moderation',
        actionRequired: false,
        metadata: {
            action: 'warning',
            reportReason: reportReason,
            moderatorNotes: moderatorNotes
        }
    });
};

/**
 * Genera un ID único para la notificación
 */
const generateNotificationId = () => {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Función para enviar notificaciones en lote
 */
const sendBulkSystemNotifications = async (notifications) => {
    const results = [];

    for (const notification of notifications) {
        try {
            const result = await sendSystemNotificationToUser(
                notification.userId,
                notification.data
            );
            results.push({
                userId: notification.userId,
                success: result.success,
                notificationId: result.notificationId
            });
        } catch (error) {
            results.push({
                userId: notification.userId,
                success: false,
                error: error.message
            });
        }
    }

    return results;
};

/**
 * UTILIDADES AUXILIARES
 */

/**
 * Obtiene el nombre de display para tipo de contenido
 */
function getContentTypeDisplayName(contentType) {
    const typeMap = {
        'user': 'perfil de usuario',
        'review': 'reseña',
        'comment': 'comentario',
        'list': 'lista personalizada'
    };
    return typeMap[contentType] || 'contenido';
}

/**
 * Obtiene el nombre de display para motivos de reporte
 */
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
        'other': 'Otro'
    };
    return reasonMap[reason] || reason;
}

module.exports = {
    sendSystemNotificationToUser,
    sendContentModerationNotification,
    sendUserBanNotification,
    sendUserWarningNotification,
    sendRoleChangeNotification,
    sendReportResolvedNotification,
    sendReportStatusNotification,
    sendContentDeletionByReportNotification,
    sendWarningByReportNotification,
    sendBulkSystemNotifications
};