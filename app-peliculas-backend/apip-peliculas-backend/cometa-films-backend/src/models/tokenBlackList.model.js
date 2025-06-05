const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    invalidatedAt: {
        type: Date,
        default: Date.now
    },
    reason: {
        type: String,
        enum: ['user_banned', 'manual_logout', 'security_breach'],
        required: true
    },
    invalidatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Índice para consultas rápidas
tokenBlacklistSchema.index({ userId: 1, invalidatedAt: -1 });

// Limpiar entradas antiguas automáticamente (más de 30 días)
tokenBlacklistSchema.index({ invalidatedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);