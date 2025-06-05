const mongoose = require('mongoose');
const { ROLES } = require('../config/roles.config');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    avatar: {
        type: String,
        default: 'avatar1'
    },
    biografia: {
        type: String,
        default: '',
        maxlength: 500
    },
    perfilPrivado: {
        type: Boolean,
        default: false
    },
    
    // === SISTEMA DE ROLES ===
    role: {
        type: String,
        enum: Object.values(ROLES),
        default: ROLES.USER
    },
    
    // === ESTADO DE MODERACIÓN ===
    isActive: {
        type: Boolean,
        default: true
    },
    isBanned: {
        type: Boolean,
        default: false
    },
    banReason: {
        type: String,
        default: null
    },
    bannedAt: {
        type: Date,
        default: null
    },
    bannedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    banExpiresAt: {
        type: Date,
        default: null // null = ban permanente
    },
    
    // ===  SISTEMA PREMIUM  ===
    isPremium: {
        type: Boolean,
        default: false
    },
    premiumExpiry: {
        type: Date,
        default: null
    },
    paypalSubscriptionId: {
        type: String,
        default: null
    },
    premiumHistory: [{
        action: {
            type: String,
            enum: ['subscribed', 'renewed', 'canceled', 'expired']
        },
        date: {
            type: Date,
            default: Date.now
        },
        details: {
            type: String
        }
    }],
    
    // === HISTORIAL DE MODERACIÓN ===
    moderationHistory: [{
        action: {
            type: String,
            enum: ['warning', 'ban', 'unban', 'role_change', 'content_deleted']
        },
        reason: String,
        moderator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        date: {
            type: Date,
            default: Date.now
        },
        details: String,
        expiresAt: Date // Para bans temporales
    }]
}, {
    timestamps: true
});

// Middleware para sincronizar premium con rol
userSchema.pre('save', function(next) {
    // Si se vuelve premium y su rol es user, actualizar a premium
    if (this.isPremium && this.role === ROLES.USER) {
        this.role = ROLES.PREMIUM;
    }
    // Si deja de ser premium y su rol es premium, bajar a user
    else if (!this.isPremium && this.role === ROLES.PREMIUM) {
        this.role = ROLES.USER;
    }
    next();
});

// Método para verificar si el usuario está activo y no baneado
userSchema.methods.canPerformActions = function() {
    if (!this.isActive || this.isBanned) {
        return false;
    }
    
    // Verificar si el ban temporal ha expirado
    if (this.banExpiresAt && new Date() > this.banExpiresAt) {
        // Auto-desbanear si el ban temporal ha expirado
        this.isBanned = false;
        this.banReason = null;
        this.bannedAt = null;
        this.banExpiresAt = null;
        this.save();
        return true;
    }
    
    return !this.isBanned;
};

module.exports = mongoose.model('User', userSchema);