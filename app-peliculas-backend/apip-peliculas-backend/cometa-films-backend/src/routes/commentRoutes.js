// routes/commentRoutes.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const {
    getComments,
    addComment,
    editComment,
    deleteComment
} = require('../controllers/commentController');

// Todas las rutas requieren autenticación
router.use(auth);

// Rutas para comentarios
router.get('/reviews/:reviewId/comments', getComments);
router.post('/reviews/:reviewId/comments', addComment);
router.put('/reviews/:reviewId/comments/:commentId', editComment);
router.delete('/reviews/:reviewId/comments/:commentId', deleteComment);

module.exports = router;