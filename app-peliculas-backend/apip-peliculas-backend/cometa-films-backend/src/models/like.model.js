const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // El tipo de contenido al que se da like (review, comment, list)
    contentType: {
        type: String,
        enum: ['review', 'comment', 'list'],
        required: true
    },
    // ID del contenido al que se da like
    contentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Índice compuesto para evitar duplicados y buscar eficientemente
likeSchema.index({ userId: 1, contentType: 1, contentId: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);