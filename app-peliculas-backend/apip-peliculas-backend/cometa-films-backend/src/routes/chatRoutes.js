const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const {
    getUserChats,
    getOrCreateChat,
    getChatMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    archiveChat,
    searchUsersForChat,
    markMessagesAsRead
} = require('../controllers/chatController');

router.use(auth);

router.get('/chats', getUserChats);
router.get('/chats/:otherUserId/get-or-create', getOrCreateChat);
router.get('/chats/:chatId/messages', getChatMessages);
router.get('/users/search', searchUsersForChat);
router.get('/users/search', searchUsersForChat);
router.post('/chats/:chatId/messages', sendMessage);
router.put('/messages/:messageId', editMessage);
router.delete('/messages/:messageId', deleteMessage);
router.post('/chats/:chatId/archive', archiveChat);
router.post('/chats/:chatId/mark-read', markMessagesAsRead);


module.exports = router;