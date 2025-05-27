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
                "*" 
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

        // Eventos de chat
        socket.on('join_chat', (chatId) => {
            console.log(`Socket.IO: Usuario ${userId} se unió al chat ${chatId}`);
            socket.join(`chat_${chatId}`);
        });

        socket.on('leave_chat', (chatId) => {
            console.log(`Socket.IO: Usuario ${userId} salió del chat ${chatId}`);
            socket.leave(`chat_${chatId}`);
        });

        // Evento para escribiendo mensaje
        socket.on('typing', (data) => {
            const { chatId, isTyping } = data;
            socket.to(`chat_${chatId}`).emit('user_typing', {
                userId,
                username: socket.username || 'Usuario',
                isTyping
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

// Función para enviar solicitudes de seguimiento
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

// Nueva función para enviar mensajes de chat
function sendMessageToUser(userId, messageData) {
    try {
        if (!io) {
            console.error('Socket.IO: No inicializado.');
            return false;
        }

        const userIdStr = userId.toString();
        const socketId = userConnections.get(userIdStr);
        
        if (socketId) {
            io.to(userIdStr).emit('chat_message', messageData);
            console.log(`Socket.IO: Mensaje de chat enviado a ${userIdStr}`);
            return true;
        } else {
            console.log(`Socket.IO: Usuario ${userIdStr} no está conectado.`);
            return false;
        }
    } catch (error) {
        console.error('Socket.IO: Error al enviar mensaje de chat:', error);
        return false;
    }
}

// Función para enviar mensaje a una sala de chat
function sendMessageToChat(chatId, messageData) {
    try {
        if (!io) {
            console.error('Socket.IO: No inicializado.');
            return false;
        }

        io.to(`chat_${chatId}`).emit('chat_message', messageData);
        console.log(`Socket.IO: Mensaje enviado al chat ${chatId}`);
        return true;
    } catch (error) {
        console.error('Socket.IO: Error al enviar mensaje al chat:', error);
        return false;
    }
}

// Función para obtener estadísticas
function getConnectionStats() {
    return {
        connectedUsers: Array.from(userConnections.keys()),
        totalConnections: userConnections.size,
        socketIOClients: io ? io.engine.clientsCount : 0
    };
}

module.exports = initializeSocketServer;
module.exports.sendFollowRequest = sendFollowRequest;
module.exports.sendMessageToUser = sendMessageToUser;
module.exports.sendMessageToChat = sendMessageToChat;
module.exports.getConnectionStats = getConnectionStats;
