const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        trim: true
    },
    messageType: {
        type: String,
        enum: ['text', 'movie'],
        default: 'text'
    },
    // Para mensajes de tipo película
    movieData: {
        tmdbId: String,
        title: String,
        posterPath: String,
        year: String
    },
    readBy: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        readAt: {
            type: Date,
            default: Date.now
        }
    }],
    isEdited: {
        type: Boolean,
        default: false
    },
    editedAt: Date
}, {
    timestamps: true
});

const chatSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    chatType: {
        type: String,
        enum: ['private'],
        default: 'private'
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    // Para marcar chats como archivados por usuario
    archivedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
}, {
    timestamps: true
});

// Crear modelos separados
const Message = mongoose.model('Message', messageSchema);
const Chat = mongoose.model('Chat', chatSchema);

// Índices para optimización
chatSchema.index({ participants: 1, lastActivity: -1 });
messageSchema.index({ chat: 1, createdAt: -1 });

module.exports = { Chat, Message };