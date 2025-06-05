const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permissions.middleware');

const {
    getUserChats,
    getOrCreateChat,
    getChatMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    searchUsersForChat,
    markMessagesAsRead,
    toggleArchiveChat,
    clearChatForUser
} = require('../controllers/chatController');

// Todas las rutas requieren autenticación
router.use(auth);

// === RUTAS DE CHAT CON PERMISOS ===

// Ver chats propios
router.get('/chats', 
    requirePermission('chat.participate'), 
    getUserChats
);

// Crear o obtener chat con otro usuario
router.get('/chats/:otherUserId/get-or-create', 
    requirePermission('chat.create'), 
    getOrCreateChat
);

// Ver mensajes de un chat
router.get('/chats/:chatId/messages', 
    requirePermission('chat.participate'), 
    getChatMessages
);

// Buscar usuarios para chat
router.get('/users/search', 
    requirePermission('chat.create'), 
    searchUsersForChat
);

// Enviar mensaje
router.post('/chats/:chatId/messages', 
    requirePermission('chat.participate'), 
    sendMessage
);

// Editar mensaje propio
router.put('/messages/:messageId', 
    requirePermission('chat.participate'), 
    editMessage
);

// Eliminar mensaje propio
router.delete('/messages/:messageId', 
    requirePermission('chat.participate'), 
    deleteMessage
);

// Archivar chat
router.post('/chats/:chatId/toggle-archive', 
    requirePermission('chat.archive'), 
    toggleArchiveChat
);

// Limpiar historial del chat
router.post('/chats/:chatId/clear', 
    requirePermission('chat.clear'), 
    clearChatForUser
);

// Marcar mensajes como leídos
router.post('/chats/:chatId/mark-read', 
    requirePermission('chat.participate'), 
    markMessagesAsRead
);

module.exports = router;