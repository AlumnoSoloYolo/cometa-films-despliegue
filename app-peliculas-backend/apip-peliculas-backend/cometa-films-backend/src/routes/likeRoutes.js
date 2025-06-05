
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permissions.middleware');

const {
    toggleLike,
    checkLike,
    getLikeCount,
    getBulkLikeStatus,
    getLikeUsers
} = require('../controllers/likeController');

// Todas las rutas requieren autenticación
router.use(auth);

// ========================================
// RUTAS DE GESTIÓN DE LIKES
// ========================================

// Dar/quitar like a un contenido
router.post('/toggle', 
    requirePermission('likes.manage'), 
    toggleLike
);

// Verificar si un usuario ha dado like a un contenido
router.get('/:contentType/:contentId/check', 
    requirePermission('likes.manage'), 
    checkLike
);

// Obtener cantidad de likes para un contenido (público)
router.get('/:contentType/:contentId/count', getLikeCount);

// Verificar estado de likes para múltiples elementos
router.post('/status/bulk', 
    requirePermission('likes.manage'), 
    getBulkLikeStatus
);

// Obtener usuarios que dieron like a un contenido
// Solo moderadores pueden ver esta información para moderar
router.get('/:contentType/:contentId/users', 
    requirePermission('moderate.likes.view'), 
    getLikeUsers
);

module.exports = router;