const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const {
    toggleLike,
    checkLike,
    getLikeCount,
    getBulkLikeStatus,
    getLikeUsers
} = require('../controllers/likeController');

// Todas las rutas requieren autenticación
router.use(auth);

// Dar/quitar like a un contenido
router.post('/toggle', toggleLike);

// Verificar si un usuario ha dado like a un contenido
router.get('/:contentType/:contentId/check', checkLike);

// Obtener cantidad de likes para un contenido
router.get('/:contentType/:contentId/count', getLikeCount);

// Verificar estado de likes para múltiples elementos
router.post('/status/bulk', getBulkLikeStatus);

//  Obtener usuarios que dieron like a un contenido
router.get('/:contentType/:contentId/users', getLikeUsers);

module.exports = router;