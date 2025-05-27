const { Chat, Message } = require('../models/chat.model');
const User = require('../models/user.model');
const socket = require('../socket');

// Obtener todos los chats del usuario
exports.getUserChats = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const chats = await Chat.find({
            participants: userId,
            archivedBy: { $ne: userId }
        })
        .populate('participants', 'username avatar')
        .populate('lastMessage')
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

        // información adicional
        const enrichedChats = await Promise.all(chats.map(async (chat) => {
            // Obtener el otro participante (para chats privados)
            const otherParticipant = chat.participants.find(p => p._id.toString() !== userId);
            
            // Contar mensajes no leídos
            const unreadCount = await Message.countDocuments({
                chat: chat._id,
                sender: { $ne: userId },
                'readBy.user': { $ne: userId }
            });

            return {
                ...chat,
                otherParticipant,
                unreadCount,
                lastMessagePopulated: chat.lastMessage ? {
                    ...chat.lastMessage,
                    isOwn: chat.lastMessage.sender.toString() === userId
                } : null
            };
        }));

        const total = await Chat.countDocuments({
            participants: userId,
            archivedBy: { $ne: userId }
        });

        res.json({
            chats: enrichedChats,
            pagination: {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                hasMore: page < Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error al obtener chats:', error);
        res.status(500).json({
            message: 'Error al obtener chats',
            error: error.message
        });
    }
};

// Obtener o crear un chat con otro usuario
exports.getOrCreateChat = async (req, res) => {
    try {
        const userId = req.user.id;
        const { otherUserId } = req.params;

        // Validar que no sea el mismo usuario
        if (userId === otherUserId) {
            return res.status(400).json({ message: 'No puedes crear un chat contigo mismo' });
        }

        // Verificar que el otro usuario existe
        const otherUser = await User.findById(otherUserId);
        if (!otherUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Buscar chat existente
        let chat = await Chat.findOne({
            chatType: 'private',
            participants: { $all: [userId, otherUserId] }
        }).populate('participants', 'username avatar');

        // Si no existe, crear uno nuevo
        if (!chat) {
            chat = await Chat.create({
                participants: [userId, otherUserId],
                chatType: 'private'
            });

            // Poblar los participantes
            chat = await Chat.findById(chat._id).populate('participants', 'username avatar');
        }

        // Obtener el otro participante
        const otherParticipant = chat.participants.find(p => p._id.toString() !== userId);

        // Contar mensajes no leídos
        const unreadCount = await Message.countDocuments({
            chat: chat._id,
            sender: { $ne: userId },
            'readBy.user': { $ne: userId }
        });

        res.json({
            ...chat.toObject(),
            otherParticipant,
            unreadCount
        });
    } catch (error) {
        console.error('Error al obtener/crear chat:', error);
        res.status(500).json({
            message: 'Error al procesar chat',
            error: error.message
        });
    }
};

// Obtener mensajes de un chat
exports.getChatMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const { chatId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        // Verificar que el usuario participa en el chat
        const chat = await Chat.findOne({
            _id: chatId,
            participants: userId
        });

        if (!chat) {
            return res.status(404).json({ message: 'Chat no encontrado' });
        }

        // Obtener mensajes
        const messages = await Message.find({ chat: chatId })
            .populate('sender', 'username avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Marcar mensajes como leídos
        await Message.updateMany(
            {
                chat: chatId,
                sender: { $ne: userId },
                'readBy.user': { $ne: userId }
            },
            {
                $push: {
                    readBy: {
                        user: userId,
                        readAt: new Date()
                    }
                }
            }
        );

        const total = await Message.countDocuments({ chat: chatId });

        res.json({
            messages: messages.reverse(), // Enviar en orden cronológico
            pagination: {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                hasMore: page < Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error al obtener mensajes:', error);
        res.status(500).json({
            message: 'Error al obtener mensajes',
            error: error.message
        });
    }
};

// Enviar mensaje
exports.sendMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { chatId } = req.params;
        const { text, messageType = 'text', movieData } = req.body;

        // Validaciones
        if (messageType === 'text' && (!text || text.trim().length === 0)) {
            return res.status(400).json({ message: 'El mensaje no puede estar vacío' });
        }

        if (messageType === 'movie' && !movieData) {
            return res.status(400).json({ message: 'Datos de película requeridos' });
        }

        // Verificar que el usuario participa en el chat
        const chat = await Chat.findOne({
            _id: chatId,
            participants: userId
        }).populate('participants', 'username avatar');

        if (!chat) {
            return res.status(404).json({ message: 'Chat no encontrado' });
        }

        // Crear mensaje
        const message = await Message.create({
            chat: chatId,
            sender: userId,
            text: messageType === 'text' ? text.trim() : null,
            messageType,
            movieData: messageType === 'movie' ? movieData : undefined,
            readBy: [{
                user: userId,
                readAt: new Date()
            }]
        });

        // Actualizar último mensaje y actividad del chat
        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: message._id,
            lastActivity: new Date()
        });

        // Poblar el mensaje creado
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'username avatar');

        // Emitir mensaje via Socket.IO a los participantes
        const otherParticipants = chat.participants.filter(p => p._id.toString() !== userId);
        
        for (const participant of otherParticipants) {
            socket.sendMessageToUser(participant._id.toString(), {
                type: 'new_message',
                chatId,
                message: populatedMessage,
                chat: {
                    _id: chat._id,
                    otherParticipant: {
                        _id: req.user._id,
                        username: req.user.username,
                        avatar: req.user.avatar
                    }
                }
            });
        }

        res.status(201).json(populatedMessage);
    } catch (error) {
        console.error('Error al enviar mensaje:', error);
        res.status(500).json({
            message: 'Error al enviar mensaje',
            error: error.message
        });
    }
};

// Editar mensaje
exports.editMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ message: 'El mensaje no puede estar vacío' });
        }

        // Verificar que el mensaje existe y pertenece al usuario
        const message = await Message.findOne({
            _id: messageId,
            sender: userId,
            messageType: 'text' // Solo se pueden editar mensajes de texto
        });

        if (!message) {
            return res.status(404).json({ message: 'Mensaje no encontrado' });
        }

        // Actualizar mensaje
        message.text = text.trim();
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        // Poblar y devolver
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'username avatar');

        res.json(populatedMessage);
    } catch (error) {
        console.error('Error al editar mensaje:', error);
        res.status(500).json({
            message: 'Error al editar mensaje',
            error: error.message
        });
    }
};

// Eliminar mensaje
exports.deleteMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;

        // Verificar que el mensaje existe y pertenece al usuario
        const message = await Message.findOne({
            _id: messageId,
            sender: userId
        });

        if (!message) {
            return res.status(404).json({ message: 'Mensaje no encontrado' });
        }

        await Message.findByIdAndDelete(messageId);

        res.json({ message: 'Mensaje eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar mensaje:', error);
        res.status(500).json({
            message: 'Error al eliminar mensaje',
            error: error.message
        });
    }
};

// Archivar chat
exports.archiveChat = async (req, res) => {
    try {
        const userId = req.user.id;
        const { chatId } = req.params;

        await Chat.findByIdAndUpdate(chatId, {
            $addToSet: { archivedBy: userId }
        });

        res.json({ message: 'Chat archivado correctamente' });
    } catch (error) {
        console.error('Error al archivar chat:', error);
        res.status(500).json({
            message: 'Error al archivar chat',
            error: error.message
        });
    }
};