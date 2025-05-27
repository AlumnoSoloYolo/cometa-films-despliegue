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
    searchUsersForChat,
    markMessagesAsRead,
    toggleArchiveChat,
    clearChatForUser
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
router.post('/chats/:chatId/toggle-archive', toggleArchiveChat);
router.post('/chats/:chatId/clear', clearChatForUser)
router.post('/chats/:chatId/mark-read', markMessagesAsRead);


module.exports = router;