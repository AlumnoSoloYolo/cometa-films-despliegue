
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { 
    requirePermission,
    canDeleteComment 
} = require('../middleware/permissions.middleware');

const {
    getComments,
    addComment,
    editComment,
    deleteComment
} = require('../controllers/commentController');

// Todas las rutas requieren autenticación
router.use(auth);

// === RUTAS DE COMENTARIOS CON PERMISOS ===

// Ver comentarios - libre para todos los autenticados
router.get('/reviews/:reviewId/comments', getComments);

// Crear comentario - requiere permiso de crear contenido
router.post('/reviews/:reviewId/comments', 
    requirePermission('content.create'), 
    addComment
);

// Editar comentario - solo el propietario
router.put('/reviews/:reviewId/comments/:commentId', 
    requirePermission('content.own.edit'), 
    editComment
);

// Eliminar comentario - propietario O moderador
router.delete('/reviews/:reviewId/comments/:commentId', 
    canDeleteComment, 
    deleteComment
);

module.exports = router;