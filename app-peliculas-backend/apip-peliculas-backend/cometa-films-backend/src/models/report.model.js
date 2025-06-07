const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    // Usuario que reporta
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Usuario reportado (siempre presente)
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Contenido reportado (opcional para reportes de perfil)
    reportedContent: {
        contentType: {
            type: String,
            enum: ['user', 'review', 'comment', 'list'],
            required: true
        },
        contentId: {
            type: mongoose.Schema.Types.ObjectId,
            sparse: true // null para reportes de usuario
        },
        // Snapshot del contenido al momento del reporte para preservar evidencia
        contentSnapshot: {
            text: String, // Para comentarios/reseñas
            title: String, // Para listas
            description: String, // Para listas
            rating: Number, // Para reseñas
            url: String // Para cualquier URL relevante
        }
    },

    // Motivo del reporte
    reason: {
        type: String,
        enum: [
            'inappropriate_language',
            'harassment',
            'discrimination',
            'spam',
            'inappropriate_content',
            'violence_threats',
            'false_information',
            'hate_speech',
            'sexual_content',
            'copyright_violation',
            'impersonation',
            'other'
        ],
        required: true
    },

    // Descripción adicional del usuario
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },

    // Estado del reporte
    status: {
        type: String,
        enum: ['pending', 'under_review', 'resolved', 'dismissed'],
        default: 'pending'
    },

    // Información de resolución
    resolution: {
        action: {
            type: String,
            enum: ['no_action', 'content_deleted', 'user_warned', 'user_banned', 'other']
        },
        notes: String,
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        resolvedAt: Date
    },

    // Notas internas del moderador
    moderatorNotes: {
        type: String,
        trim: true,
        maxlength: 2000
    },

    // Prioridad del reporte
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },

    // Categorías adicionales para organización
    category: {
        type: String,
        enum: ['content', 'behavior', 'spam', 'legal', 'safety'],
        default: 'content'
    }
}, {
    timestamps: true
});

// Índices para optimización
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ reportedUser: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ 'reportedContent.contentType': 1, 'reportedContent.contentId': 1 });
reportSchema.index({ priority: 1, status: 1, createdAt: -1 });

// Prevenir reportes duplicados del mismo usuario al mismo contenido
reportSchema.index({
    reporter: 1,
    reportedUser: 1,
    'reportedContent.contentType': 1,
    'reportedContent.contentId': 1
}, {
    unique: true,
    partialFilterExpression: {
        status: { $in: ['pending', 'under_review'] }
    }
});

// Método para obtener el display del motivo
reportSchema.methods.getReasonDisplay = function () {
    const reasonMap = {
        'inappropriate_language': 'Lenguaje inapropiado',
        'harassment': 'Acoso',
        'discrimination': 'Discriminación',
        'spam': 'Spam',
        'inappropriate_content': 'Contenido inapropiado',
        'violence_threats': 'Amenazas de violencia',
        'false_information': 'Información falsa',
        'hate_speech': 'Discurso de odio',
        'sexual_content': 'Contenido sexual',
        'copyright_violation': 'Violación de derechos de autor',
        'impersonation': 'Suplantación de identidad',
        'other': 'Otro'
    };
    return reasonMap[this.reason] || this.reason;
};

// Método para obtener el display del tipo de contenido
reportSchema.methods.getContentTypeDisplay = function () {
    const typeMap = {
        'user': 'Perfil de usuario',
        'review': 'Reseña',
        'comment': 'Comentario',
        'list': 'Lista personalizada'
    };
    return typeMap[this.reportedContent.contentType] || this.reportedContent.contentType;
};

module.exports = mongoose.model('Report', reportSchema);