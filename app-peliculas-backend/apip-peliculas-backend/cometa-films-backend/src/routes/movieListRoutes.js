
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { 
    requirePermission,
    canDeleteList 
} = require('../middleware/permissions.middleware');

const {
    createList,
    getUserLists,
    addMovieToList,
    getUserPublicLists,
    getListById,
    updateList,
    deleteList,
    removeMovieFromList
} = require('../controllers/movieListController');

// Todas las rutas requieren autenticación
router.use(auth);

// === MIDDLEWARE PARA VERIFICAR LÍMITE DE LISTAS ===
const checkListLimit = async (req, res, next) => {
    try {
        const PermissionsService = require('../services/permissions.service');
        
        // Si puede crear listas ilimitadas, pasar
        if (PermissionsService.canCreateUnlimitedLists(req.user)) {
            return next();
        }
        
        // Verificar límite para usuarios normales
        const MovieList = require('../models/movie-list.model');
        const currentCount = await MovieList.countDocuments({ userId: req.user._id });
        
        const LIMIT = 5; // Límite para usuarios no premium
        if (currentCount >= LIMIT) {
            return res.status(403).json({
                message: `Has alcanzado el límite de ${LIMIT} listas. Actualiza a Premium para crear listas ilimitadas.`,
                code: 'LIST_LIMIT_EXCEEDED',
                currentCount,
                limit: LIMIT
            });
        }
        
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error verificando límite de listas', error: error.message });
    }
};

// === RUTAS DE LISTAS CON PERMISOS ===

// Crear lista - verificar permiso Y límite
router.post('/lists', 
    requirePermission('content.create'),
    checkListLimit, 
    createList
);

// Ver listas propias
router.get('/lists', getUserLists);

// Ver lista específica
router.get('/lists/:listId', getListById); // Verifica permisos internamente

// Actualizar lista - solo propietario
router.put('/lists/:listId', 
    requirePermission('content.own.edit'), 
    updateList
);

// Eliminar lista - propietario O moderador
router.delete('/lists/:listId', 
    canDeleteList, 
    deleteList
);

// Ver listas públicas de otro usuario
router.get('/users/:userId/lists', getUserPublicLists);

// === GESTIÓN DE PELÍCULAS EN LISTAS ===

// Añadir película - solo propietario
router.post('/lists/:listId/movies', 
    requirePermission('content.own.edit'), 
    addMovieToList
);

// Eliminar película - solo propietario
router.delete('/lists/:listId/movies', 
    requirePermission('content.own.edit'), 
    removeMovieFromList
);

module.exports = router;