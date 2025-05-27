const { Chat, Message } = require('../models/chat.model');
const User = require('../models/user.model');
const socket = require('../socket');

// Obtener mensajes de un chat - CON DEBUG COMPLETO
exports.getChatMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const { chatId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        console.log(`=== DEBUG getChatMessages ===`);
        console.log(`Usuario: ${userId}`);
        console.log(`Chat ID: ${chatId}`);
        console.log(`Pagina: ${page}, Limite: ${limit}`);

        // 1. Verificar que el usuario participa en el chat
        const chat = await Chat.findOne({
            _id: chatId,
            participants: userId
        });

        if (!chat) {
            console.log('ERROR: Chat no encontrado o usuario no autorizado');
            return res.status(404).json({ message: 'Chat no encontrado' });
        }

        console.log('OK: Chat encontrado:', {
            id: chat._id,
            participants: chat.participants,
            type: chat.chatType
        });

        // 2. METODO 1: Buscar mensajes por chat ID
        console.log('METODO 1: Buscando mensajes por chat ID...');
        const messagesByChat = await Message.find({ 
            chat: chatId,
            hiddenFor: { $ne: userId }
        })
            .populate('sender', 'username avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        console.log(`Mensajes encontrados (Metodo 1): ${messagesByChat.length}`);

        // 3. METODO 2: Buscar TODOS los mensajes (para debug)
        console.log('METODO 2: Buscando TODOS los mensajes...');
        const allMessages = await Message.find({})
            .populate('sender', 'username avatar')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        console.log(`Total de mensajes en el sistema: ${allMessages.length}`);
        
        if (allMessages.length > 0) {
            console.log('Muestra de mensajes:');
            allMessages.slice(0, 5).forEach((msg, idx) => {
                console.log(`  ${idx + 1}. ID: ${msg._id}, Chat: ${msg.chat || 'SIN CHAT'}, Texto: ${msg.text || '[Pelicula]'}, Sender: ${msg.sender?.username || 'Sin sender'}`);
            });
        }

        // 4. METODO 3: Buscar mensajes por participantes
        console.log('METODO 3: Buscando mensajes por participantes...');
        const participantIds = chat.participants;
        const messagesBySender = await Message.find({
            sender: { $in: participantIds }
        })
        .populate('sender', 'username avatar')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

        console.log(`Mensajes por participantes: ${messagesBySender.length}`);

        // 5. Decidir que mensajes devolver
        let messagesToReturn = [];
        
        if (messagesByChat.length > 0) {
            console.log('USANDO: Mensajes del Metodo 1 (por chat ID)');
            messagesToReturn = messagesByChat;
        } else if (messagesBySender.length > 0) {
            console.log('USANDO: Mensajes del Metodo 3 (por participantes) - ASIGNANDO AL CHAT');
            
            // Asignar estos mensajes al chat actual
            const messageIds = messagesBySender.map(m => m._id);
            await Message.updateMany(
                { _id: { $in: messageIds } },
                { chat: chatId }
            );
            
            console.log(`REPARADO: ${messageIds.length} mensajes asignados al chat ${chatId}`);
            messagesToReturn = messagesBySender;
        } else {
            console.log('ERROR: No se encontraron mensajes por ningun metodo');
            messagesToReturn = [];
        }

        // 6. Marcar mensajes como leidos
        if (messagesToReturn.length > 0) {
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
            console.log('Mensajes marcados como leidos');
        }

        const total = await Message.countDocuments({ chat: chatId });

        console.log(`RESPUESTA: Devolviendo ${messagesToReturn.length} mensajes`);
        console.log(`=== FIN DEBUG getChatMessages ===\n`);

        res.json({
            messages: messagesToReturn.reverse(), // Orden cronologico
            pagination: {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                hasMore: page < Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('ERROR en getChatMessages:', error);
        res.status(500).json({
            message: 'Error al obtener mensajes',
            error: error.message
        });
    }
};

// Enviar mensaje - ASEGURAR CAMPO CHAT
exports.sendMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { chatId } = req.params;
        const { text, messageType = 'text', movieData } = req.body;

        console.log(`Enviando mensaje - Chat: ${chatId}, Tipo: ${messageType}`);

        // Validaciones
        if (messageType === 'text' && (!text || text.trim().length === 0)) {
            return res.status(400).json({ message: 'El mensaje no puede estar vacio' });
        }

        if (messageType === 'movie' && !movieData) {
            return res.status(400).json({ message: 'Datos de pelicula requeridos' });
        }

        // Verificar que el usuario participa en el chat
        const chat = await Chat.findOne({
            _id: chatId,
            participants: userId
        }).populate('participants', 'username avatar');

        if (!chat) {
            return res.status(404).json({ message: 'Chat no encontrado' });
        }

        // Crear mensaje - IMPORTANTE: INCLUIR SIEMPRE EL CAMPO CHAT
        const messageData = {
            chat: chatId, // CRITICO: Siempre incluir
            sender: userId,
            messageType,
            readBy: [{
                user: userId,
                readAt: new Date()
            }]
        };

        if (messageType === 'text') {
            messageData.text = text.trim();
        } else if (messageType === 'movie') {
            messageData.movieData = movieData;
        }

        console.log('Datos del mensaje a crear:', {
            chat: messageData.chat,
            sender: messageData.sender,
            type: messageData.messageType,
            hasText: !!messageData.text,
            hasMovieData: !!messageData.movieData
        });

        const message = await Message.create(messageData);
        console.log(`Mensaje creado con ID: ${message._id}`);

        // Actualizar ultimo mensaje del chat
        await Chat.findByIdAndUpdate(chatId, {
            lastMessage: message._id,
            lastActivity: new Date()
        });

        // Poblar el mensaje
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'username avatar');

        // Socket.IO
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

// Obtener todos los chats del usuario
exports.getUserChats = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        console.log(`Obteniendo chats para usuario: ${userId}`);

        const chats = await Chat.find({
            participants: userId,
            archivedBy: { $ne: userId }
        })
        .populate('participants', 'username avatar')
        .populate({
            path: 'lastMessage',
            populate: {
                path: 'sender',
                select: 'username avatar'
            }
        })
        .sort({ lastActivity: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

        console.log(`Chats encontrados: ${chats.length}`);

        const enrichedChats = await Promise.all(chats.map(async (chat) => {
            const otherParticipant = chat.participants.find(p => p._id.toString() !== userId);
            
            const unreadCount = await Message.countDocuments({
                chat: chat._id,
                sender: { $ne: userId },
                'readBy.user': { $ne: userId },
                hiddenFor: { $ne: userId } 
            });

            return {
                ...chat,
                otherParticipant,
                unreadCount,
                isArchived: chat.archivedBy.includes(userId), 
                lastMessagePopulated: chat.lastMessage ? {
                    ...chat.lastMessage,
                    isOwn: chat.lastMessage.sender && chat.lastMessage.sender._id ? 
                        chat.lastMessage.sender._id.toString() === userId : false
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

        if (userId === otherUserId) {
            return res.status(400).json({ message: 'No puedes crear un chat contigo mismo' });
        }

        const otherUser = await User.findById(otherUserId);
        if (!otherUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        let chat = await Chat.findOne({
            chatType: 'private',
            participants: { $all: [userId, otherUserId] }
        }).populate('participants', 'username avatar');

        if (!chat) {
            chat = await Chat.create({
                participants: [userId, otherUserId],
                chatType: 'private'
            });

            chat = await Chat.findById(chat._id).populate('participants', 'username avatar');
        }

        const otherParticipant = chat.participants.find(p => p._id.toString() !== userId);
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

// Editar mensaje
exports.editMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ message: 'El mensaje no puede estar vacio' });
        }

        const message = await Message.findOne({
            _id: messageId,
            sender: userId,
            messageType: 'text'
        });

        if (!message) {
            return res.status(404).json({ message: 'Mensaje no encontrado' });
        }

        message.text = text.trim();
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

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
exports.toggleArchiveChat = async (req, res) => {
    try {
        const userId = req.user.id;
        const { chatId } = req.params;

        const chat = await Chat.findOne({
            _id: chatId,
            participants: userId
        });

        if (!chat) {
            return res.status(404).json({ message: 'Chat no encontrado' });
        }

        // Verificar si ya está archivado por este usuario
        const isArchived = chat.archivedBy.includes(userId);

        if (isArchived) {
            // Desarchivar: remover del array
            await Chat.findByIdAndUpdate(chatId, {
                $pull: { archivedBy: userId }
            });
            res.json({ message: 'Chat desarchivado correctamente', isArchived: false });
        } else {
            // Archivar: añadir al array
            await Chat.findByIdAndUpdate(chatId, {
                $addToSet: { archivedBy: userId }
            });
            res.json({ message: 'Chat archivado correctamente', isArchived: true });
        }
    } catch (error) {
        console.error('Error al archivar/desarchivar chat:', error);
        res.status(500).json({
            message: 'Error al procesar chat',
            error: error.message
        });
    }
};



// Limpiar mensajes del chat para un usuario específico
exports.clearChatForUser = async (req, res) => {
    try {
        const userId = req.user.id;
        const { chatId } = req.params;

        // Verificar que el usuario participa en el chat
        const chat = await Chat.findOne({
            _id: chatId,
            participants: userId
        });

        if (!chat) {
            return res.status(404).json({ message: 'Chat no encontrado' });
        }

        // En lugar de eliminar los mensajes, podríamos añadir un campo "hiddenFor"
        // para ocultar mensajes solo para este usuario
        await Message.updateMany(
            { chat: chatId },
            { 
                $addToSet: { 
                    hiddenFor: userId 
                }
            }
        );

        console.log(`Chat ${chatId} limpiado para usuario ${userId}`);

        res.json({ 
            message: 'Chat limpiado correctamente',
            chatId: chatId
        });
    } catch (error) {
        console.error('Error al limpiar chat:', error);
        res.status(500).json({
            message: 'Error al limpiar chat',
            error: error.message
        });
    }
};

// Buscar usuarios para chat
exports.searchUsersForChat = async (req, res) => {
    try {
        const { query } = req.query;
        const currentUserId = req.user.id;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({ message: 'Query debe tener al menos 2 caracteres' });
        }

        const users = await User.find({
            _id: { $ne: currentUserId },
            username: { $regex: query.trim(), $options: 'i' }
        })
        .select('username avatar')
        .limit(10)
        .lean();

        res.json(users);
    } catch (error) {
        console.error('Error al buscar usuarios para chat:', error);
        res.status(500).json({
            message: 'Error al buscar usuarios',
            error: error.message
        });
    }
};



// Marcar mensajes como leidos
exports.markMessagesAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const { chatId } = req.params;

        // Verificar que el usuario participa en el chat
        const chat = await Chat.findOne({
            _id: chatId,
            participants: userId
        });

        if (!chat) {
            return res.status(404).json({ message: 'Chat no encontrado' });
        }

        // Marcar mensajes como leidos
        const result = await Message.updateMany(
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

        console.log(`Mensajes marcados como leidos: ${result.modifiedCount}`);

        res.json({ 
            message: 'Mensajes marcados como leidos',
            count: result.modifiedCount
        });
    } catch (error) {
        console.error('Error al marcar mensajes como leidos:', error);
        res.status(500).json({
            message: 'Error al marcar mensajes como leidos',
            error: error.message
        });
    }
};