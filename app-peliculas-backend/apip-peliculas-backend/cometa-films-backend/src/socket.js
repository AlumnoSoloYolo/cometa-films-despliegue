const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config/config');
const activityService = require('./services/activity.service');

// Mapa para rastrear conexiones de usuarios (userId -> socketId)
const userConnections = new Map();
let io;

function initializeSocketServer(server) {
    io = socketIo(server, {
        cors: {
            origin: [
                process.env.FRONTEND_URL,
                "http://localhost:4200",
                "*" // Permitir todo temporalmente
            ],
            methods: ["GET", "POST"],
            credentials: true,
            allowEIO3: true
        },
        transports: ['websocket', 'polling'],
        pingTimeout: 60000,
        pingInterval: 25000,
        allowRequest: (req, callback) => {
            console.log('Socket.IO: Connection attempt from:', req.headers.origin || 'no-origin');
            console.log(' - Configured FRONTEND_URL:', process.env.FRONTEND_URL);
            callback(null, true);
        }
    });

    // Middleware para autenticar la conexión con JWT
    io.use((socket, next) => {
        console.log('Socket.IO: Authenticating connection...');

        const token = socket.handshake.auth.token;
        if (!token) {
            console.log('Socket.IO: No token provided');
            return next(new Error('No se proporcionó token de autenticación'));
        }

        try {
            const decoded = jwt.verify(token, config.jwt.secret);
            socket.userId = decoded.id;
            console.log('Socket.IO: Token verified for user:', socket.userId);
            return next();
        } catch (error) {
            console.log('Socket.IO: Invalid token:', error.message);
            return next(new Error('Token inválido'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.userId;
        console.log(`Socket.IO: Usuario conectado: ${userId} (Socket: ${socket.id})`);

        // Unir al usuario a su sala personal
        socket.join(userId.toString());
        userConnections.set(userId.toString(), socket.id);

        // Enviar confirmación de conexión exitosa
        socket.emit('connection_confirmed', {
            message: 'Conectado exitosamente a Socket.IO',
            userId: userId,
            socketId: socket.id,
            timestamp: new Date().toISOString()
        });

        // Evento de prueba para verificar conectividad
        socket.on('test_connection', (data) => {
            console.log('Socket.IO: Test received from user:', userId, data);
            socket.emit('test_response', {
                message: 'Socket.IO funcionando correctamente!',
                userId: userId,
                receivedData: data,
                serverTime: new Date().toISOString()
            });
        });

        // Manejar actividades
        socket.on('new_activity', (activityData) => {
            console.log('Socket.IO: New activity from user:', userId, activityData);
            socket.broadcast.emit('activity_update', {
                ...activityData,
                userId: userId
            });
        });

        // Evento para confirmar recepción de notificaciones del sistema
        socket.on('system_notification_received', (data) => {
            console.log('Socket.IO: Notificación del sistema confirmada por usuario:', userId, data.notificationId);
        });

        // Evento para marcar notificaciones como leídas
        socket.on('mark_notification_read', (data) => {
            console.log('Socket.IO: Notificación marcada como leída:', userId, data.notificationId);
        });

        // Evento de prueba para notificaciones del sistema
        socket.on('test_system_notification', (data) => {
            console.log('Socket.IO: Test de notificación del sistema solicitado por:', userId);
            sendSystemNotificationToUser(userId, {
                notificationType: 'test',
                title: 'Notificación de prueba',
                message: 'Esta es una notificación de prueba del sistema',
                severity: 'info',
                category: 'system'
            });
        });

        socket.on('disconnect', (reason) => {
            console.log(`Socket.IO: Usuario desconectado: ${userId} - Reason: ${reason}`);
            userConnections.delete(userId.toString());
        });

        socket.on('error', (error) => {
            console.error(`Socket.IO: Socket error for user ${userId}:`, error);
        });
    });

    // Manejar errores de conexión del servidor
    io.engine.on("connection_error", (err) => {
        console.error("Socket.IO Connection Error:", {
            message: err.message,
            description: err.description,
            context: err.context,
            type: err.type
        });
    });

    // Servicio de actividad
    activityService.initializeActivityService(io);

    console.log('Socket.IO initialized successfully');
    console.log('   - CORS configured for:', process.env.FRONTEND_URL);
    console.log('   - Transports: websocket, polling');

    return io;
}

function sendSystemNotificationToUser(userId, notificationData) {
    try {
        if (!io) {
            console.error('Socket.IO: No inicializado.');
            return false;
        }

        const userIdStr = userId.toString();

        const systemNotification = {
            type: 'system_notification',
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            data: notificationData,
            timestamp: new Date().toISOString(),
            userId: userIdStr
        };

        io.to(userIdStr).emit('system_notification', systemNotification);
        console.log(`Socket.IO: Notificación del sistema enviada a usuario ${userIdStr}:`, notificationData.notificationType || 'unknown');
        return true;
    } catch (error) {
        console.error('Socket.IO: Error al enviar notificación del sistema:', error);
        return false;
    }
}

function sendContentModerationNotification(userId, contentType, reason) {
    const contentTypeNames = {
        'review': 'reseña',
        'comment': 'comentario',
        'list': 'lista personalizada'
    };

    const contentName = contentTypeNames[contentType] || 'contenido';

    return sendSystemNotificationToUser(userId, {
        notificationType: 'content_moderated',
        title: 'Contenido moderado',
        message: `Tu ${contentName} ha sido eliminado por violar las normas de la comunidad.`,
        reason: reason,
        severity: 'warning',
        category: 'moderation',
        actionRequired: false,
        metadata: {
            contentType: contentType,
            action: 'deleted'
        }
    });
}

function sendUserBanNotification(userId, reason, expiresAt = null) {
    const isPermanent = !expiresAt;
    const message = isPermanent
        ? 'Tu cuenta ha sido suspendida permanentemente.'
        : `Tu cuenta ha sido suspendida temporalmente hasta ${expiresAt.toLocaleDateString()}.`;

    return sendSystemNotificationToUser(userId, {
        notificationType: 'account_banned',
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
}

function sendUserWarningNotification(userId, reason) {
    return sendSystemNotificationToUser(userId, {
        notificationType: 'account_warning',
        title: 'Advertencia de moderación',
        message: 'Has recibido una advertencia por parte de nuestro equipo de moderación.',
        reason: reason,
        severity: 'warning',
        category: 'moderation',
        actionRequired: false,
        metadata: {
            action: 'warning'
        }
    });
}

function sendRoleChangeNotification(userId, newRole, reason) {
    const roleNames = {
        'user': 'Usuario',
        'premium': 'Premium',
        'moderator': 'Moderador',
        'admin': 'Administrador'
    };

    const roleName = roleNames[newRole] || newRole;

    return sendSystemNotificationToUser(userId, {
        notificationType: 'role_changed',
        title: 'Rol actualizado',
        message: `Tu rol ha sido cambiado a ${roleName}.`,
        reason: reason,
        severity: 'info',
        category: 'account',
        actionRequired: false,
        metadata: {
            newRole: newRole,
            action: 'role_change'
        }
    });
}

function sendFollowRequest(recipientId, requestData) {
    try {
        if (!io) {
            console.error('Socket.IO: No inicializado.');
            return false;
        }

        const recipientIdStr = recipientId.toString();
        const socketId = userConnections.get(recipientIdStr);

        if (socketId) {
            io.to(recipientIdStr).emit('follow_request', requestData);
            console.log(`Socket.IO: Solicitud de seguimiento enviada a ${recipientIdStr}`);
            return true;
        } else {
            console.log(`Socket.IO: Usuario ${recipientIdStr} no está conectado.`);
            return false;
        }
    } catch (error) {
        console.error('Socket.IO: Error al enviar solicitud de seguimiento:', error);
        return false;
    }
}

function getConnectionStats() {
    return {
        connectedUsers: Array.from(userConnections.keys()),
        totalConnections: userConnections.size,
        socketIOClients: io ? io.engine.clientsCount : 0
    };
}

function sendMessageToUser(userId, data) {
    try {
        if (!io) {
            console.error('Socket.IO: No inicializado.');
            return false;
        }

        const userIdStr = userId.toString();

        io.to(userIdStr).emit('chat_message', data);
        console.log(`Socket.IO: Mensaje enviado a usuario ${userIdStr}`);
        return true;
    } catch (error) {
        console.error('Socket.IO: Error al enviar mensaje:', error);
        return false;
    }
}

module.exports = initializeSocketServer;
module.exports.sendFollowRequest = sendFollowRequest;
module.exports.getConnectionStats = getConnectionStats;
module.exports.sendMessageToUser = sendMessageToUser;
module.exports.sendSystemNotificationToUser = sendSystemNotificationToUser;
module.exports.sendContentModerationNotification = sendContentModerationNotification;
module.exports.sendUserBanNotification = sendUserBanNotification;
module.exports.sendUserWarningNotification = sendUserWarningNotification;
module.exports.sendRoleChangeNotification = sendRoleChangeNotification;