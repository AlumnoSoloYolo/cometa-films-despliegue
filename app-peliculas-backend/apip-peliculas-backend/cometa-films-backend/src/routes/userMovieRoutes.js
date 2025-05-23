
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
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

// Todas las rutas requieren autenticación
router.use(auth);

router.post('/watchlist', addPeliPendiente);
router.post('/watched', addPeliVista);
router.delete('/watchlist', removePeliPendiente);
router.delete('/watched', removePeliVista);
router.get('/profile', getUserProfile);
router.put('/profile/update', auth, updateUserProfile);
router.delete('/profile/delete', auth, deleteAccount);
router.get('/reviews/:reviewId', getReviewById);
router.get('/reviews', getUserReviews);
// router.get('/reviews/:movieId', getReviewsByMovieId);
// router.get('/movies/:movieId/reviews/:reviewId', getReview);
router.post('/reviews', addReview);
router.put('/reviews/:movieId', updateReview);
router.delete('/reviews/:movieId', deleteReview);
router.get('/movies/:movieId/reviews', getMovieReviews);
router.get('/recommendations/personalized', auth, getPersonalizedRecommendations);

module.exports = router;