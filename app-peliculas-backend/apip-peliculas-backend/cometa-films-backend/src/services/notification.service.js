const { sendMessageToUser } = require('../socket');

// ========================================
// SERVICIO DE NOTIFICACIONES DEL SISTEMA
// ========================================

/*Envía una notificación del sistema a un usuario específico*/
const sendSystemNotificationToUser = async (userId, notificationData) => {
    try {
        console.log(`Enviando notificación del sistema a usuario ${userId}:`, notificationData);

        const notification = {
            id: generateNotificationId(),
            type: 'system_notification',
            userId: userId,
            data: {
                notificationType: notificationData.type || 'general',
                title: notificationData.title || 'Notificación del sistema',
                message: notificationData.message || '',
                reason: notificationData.reason || null,
                actionRequired: notificationData.actionRequired || false,
                severity: notificationData.severity || 'info', // info, warning, error
                category: notificationData.category || 'moderation', // moderation, account, system
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

        // Aquí podrías también guardar la notificación en base de datos si quieres persistencia
        // await saveNotificationToDatabase(notification);

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

/*Envía notificación de contenido moderado*/
const sendContentModerationNotification = async (userId, contentType, reason) => {
    const contentTypeNames = {
        'review': 'reseña',
        'comment': 'comentario',
        'list': 'lista personalizada'
    };

    const contentName = contentTypeNames[contentType] || 'contenido';

    return await sendSystemNotificationToUser(userId, {
        type: 'content_moderated',
        title: 'Contenido moderado',
        message: `Tu ${contentName} ha sido eliminado por violar las normas de la comunidad.`,
        reason: reason,
        severity: 'warning',
        category: 'moderation',
        metadata: {
            contentType: contentType,
            action: 'deleted'
        }
    });
};

/*Envía notificación de ban de usuario*/
const sendUserBanNotification = async (userId, reason, expiresAt = null) => {
    const isPermanent = !expiresAt;
    const message = isPermanent
        ? 'Tu cuenta ha sido suspendida permanentemente.'
        : `Tu cuenta ha sido suspendida temporalmente hasta ${expiresAt.toLocaleDateString()}.`;

    return await sendSystemNotificationToUser(userId, {
        type: 'account_banned',
        title: 'Cuenta suspendida',
        message: message,
        reason: reason,
        severity: 'error',
        category: 'account',
        actionRequired: true,
        metadata: {
            banType: isPermanent ? 'permanent' : 'temporary',
            expiresAt: expiresAt ? expiresAt.toISOString() : null
        }
    });
};

/*Envía notificación de warning*/
const sendUserWarningNotification = async (userId, reason) => {
    return await sendSystemNotificationToUser(userId, {
        type: 'account_warning',
        title: 'Advertencia',
        message: 'Has recibido una advertencia por parte de nuestro equipo de moderación.',
        reason: reason,
        severity: 'warning',
        category: 'moderation',
        metadata: {
            action: 'warning'
        }
    });
};

/*Envía notificación de cambio de rol*/
const sendRoleChangeNotification = async (userId, newRole, reason) => {
    const roleNames = {
        'user': 'Usuario',
        'premium': 'Premium',
        'moderator': 'Moderador',
        'admin': 'Administrador'
    };

    const roleName = roleNames[newRole] || newRole;

    return await sendSystemNotificationToUser(userId, {
        type: 'role_changed',
        title: 'Rol actualizado',
        message: `Tu rol ha sido cambiado a ${roleName}.`,
        reason: reason,
        severity: 'info',
        category: 'account',
        metadata: {
            newRole: newRole,
            action: 'role_change'
        }
    });
};

/* Genera un ID único para la notificación*/
const generateNotificationId = () => {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**Función para enviar notificaciones en lote*/
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

module.exports = {
    sendSystemNotificationToUser,
    sendContentModerationNotification,
    sendUserBanNotification,
    sendUserWarningNotification,
    sendRoleChangeNotification,
    sendBulkSystemNotifications
};