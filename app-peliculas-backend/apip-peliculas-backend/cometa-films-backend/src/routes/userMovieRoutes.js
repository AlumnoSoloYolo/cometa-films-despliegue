// src/routes/userMovieRoutes.js (ACTUALIZADO CON PERMISOS)
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { 
    requirePermission,
    canDeleteReview 
} = require('../middleware/permissions.middleware');

const {
    addPeliPendiente,
    addPeliVista,
    addReview,
    getUserProfile,
    removePeliPendiente,
    removePeliVista,
    getUserReviews,
    getReviewById,
    getMovieReviews,
    updateReview,
    deleteReview,
    updateUserProfile,
    deleteAccount
} = require('../controllers/userMovieController');
const { getPersonalizedRecommendations } = require('../controllers/recomendationController');

// ========================================
// APLICAR MIDDLEWARES DE PERMISOS
// ========================================

// Todas las rutas requieren autenticación (ya verifican bans automáticamente)
router.use(auth);

// === RUTAS DE PELÍCULAS (requieren permiso básico de crear contenido) ===
router.post('/watchlist', 
    requirePermission('content.create'), 
    addPeliPendiente
);

router.post('/watched', 
    requirePermission('content.create'), 
    addPeliVista
);

router.delete('/watchlist', 
    requirePermission('content.own.delete'), 
    removePeliPendiente
);

router.delete('/watched', 
    requirePermission('content.own.delete'), 
    removePeliVista
);

// === RUTAS DE PERFIL ===
router.get('/profile', getUserProfile); // Sin permisos especiales, solo auth

router.put('/profile/update', 
    requirePermission('profile.edit'), 
    updateUserProfile
);

router.delete('/profile/delete', 
    requirePermission('profile.delete'), 
    deleteAccount
);

// === RUTAS DE RESEÑAS ===
router.get('/reviews/:reviewId', getReviewById); // Lectura libre

router.get('/reviews', getUserReviews); // Sus propias reseñas

router.post('/reviews', 
    requirePermission('content.create'), 
    addReview
);

// Actualizar reseña: debe ser suya O tener permisos de moderación
router.put('/reviews/:movieId', 
    requirePermission('content.own.edit'), 
    updateReview
);

// Eliminar reseña: usa middleware especial que verifica propiedad O permisos de moderación
router.delete('/reviews/:movieId', 
    canDeleteReview, 
    deleteReview
);

router.get('/movies/:movieId/reviews', getMovieReviews); // Lectura libre

// === RUTAS PREMIUM ===
router.get('/recommendations/personalized', 
    requirePermission('premium.recommendations'), 
    getPersonalizedRecommendations
);

module.exports = router;