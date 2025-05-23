
const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true  // Para búsquedas eficientes
    },
    userDisplay: { // QUIÉN HIZO LA ACCIÓN
        username: { type: String, required: true },
        avatar: { type: String, required: true }
    },
    actionType: {
        type: String,
        enum: [
            'followed_user', 'created_review', 'liked_review',
            'liked_list', 'added_to_watchlist', 'added_to_watched',
            'created_public_list'
        ],
        required: true,
        index: true  // Para filtrar por tipo de acción
    },
    targetUser: { // INFO DEL USUARIO OBJETIVO (para 'followed_user')
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', sparse: true },
        username: { type: String },
        avatar: { type: String }
    },
    movie: { // INFO DE LA PELÍCULA (para reseñas, watchlist, watched)
        tmdbId: { type: String, sparse: true },
        title: { type: String },
        posterPath: { type: String }
    },
    review: { // INFO DE LA RESEÑA 
        reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', sparse: true },
    },
    movieList: { // INFO DE LA LISTA 
        listId: { type: mongoose.Schema.Types.ObjectId, ref: 'MovieList', sparse: true },
        title: { type: String },
        coverImage: { type: String }
    },
    feedUniqueKey: { // PARA PREVENIR DUPLICADOS EN EL FEED
        type: String,
        unique: true,
        sparse: true
    }
}, {
    timestamps: true // Para createdAt y updatedAt
});

// Índices para optimizar consultas
activitySchema.index({ createdAt: -1 }); // Para ordenar por fecha
activitySchema.index({ userId: 1, createdAt: -1 }); // Para filtrar por usuario y ordenar


module.exports = mongoose.model('Activity', activitySchema);