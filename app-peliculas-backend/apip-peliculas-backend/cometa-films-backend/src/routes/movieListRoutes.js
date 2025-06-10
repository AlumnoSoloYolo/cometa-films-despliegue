const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permissions.middleware');

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
        
        // Si puede crear listas ilimitadas (usuarios PREMIUM), pasar
        if (PermissionsService.canCreateUnlimitedLists(req.user)) {
            console.log(`Usuario ${req.user.username} es premium - listas ilimitadas permitidas`);
            return next();
        }
        
        // Verificar límite para usuarios normales (máximo 5 listas)
        const MovieList = require('../models/movie-list.model');
        const currentCount = await MovieList.countDocuments({ userId: req.user.id });
        
        const LIMIT = 5; // Límite para usuarios no premium
        
        console.log(`Usuario ${req.user.username} tiene ${currentCount} listas, límite: ${LIMIT}`);
        
        if (currentCount >= LIMIT) {
            return res.status(403).json({
                message: `Has alcanzado el límite de ${LIMIT} listas. Actualiza a Premium para crear listas ilimitadas.`,
                error: 'PREMIUM_REQUIRED',
                currentCount,
                limit: LIMIT
            });
        }
        
        next();
    } catch (error) {
        console.error('Error verificando límite de listas:', error);
        res.status(500).json({ 
            message: 'Error verificando límite de listas', 
            error: error.message 
        });
    }
};

// === MIDDLEWARE PARA VERIFICAR PROPIEDAD DE LISTA ===
const checkListOwnership = async (req, res, next) => {
    try {
        const { listId } = req.params;
        const userId = req.user.id;
        
        const MovieList = require('../models/movie-list.model');
        const list = await MovieList.findById(listId);
        
        if (!list) {
            return res.status(404).json({ message: 'Lista no encontrada' });
        }
        
        // Verificar si es el propietario O si tiene permisos de moderación
        const PermissionsService = require('../services/permissions.service');
        const isOwner = list.userId.toString() === userId;
        const canModerate = PermissionsService.canDeleteList(req.user, list);
        
        if (!isOwner && !canModerate) {
            return res.status(403).json({ 
                message: 'No tienes permiso para modificar esta lista' 
            });
        }
        
        // Pasar la lista al siguiente middleware/controlador
        req.list = list;
        req.isOwner = isOwner;
        next();
    } catch (error) {
        console.error('Error verificando propiedad de lista:', error);
        res.status(500).json({ 
            message: 'Error verificando permisos', 
            error: error.message 
        });
    }
};

// === RUTAS DE LISTAS ===

// Crear lista - verificar permiso básico Y límite (solo usuarios premium tienen listas ilimitadas)
router.post('/lists', 
    requirePermission('content.create'),  // Todos pueden crear contenido
    checkListLimit,                       // Pero solo premium tiene listas ilimitadas
    createList
);

// Ver listas propias
router.get('/lists', getUserLists);

// Ver lista específica (verifica permisos internamente)
router.get('/lists/:listId', getListById);

// Actualizar lista - verificar permiso básico Y propiedad
router.put('/lists/:listId', 
    requirePermission('content.own.edit'), // Poder editar propio contenido
    checkListOwnership,                    // Y ser propietario (o moderador)
    updateList
);

// Eliminar lista - verificar propiedad (incluye permisos de moderación)
router.delete('/lists/:listId', checkListOwnership, deleteList);

// Ver listas públicas de otro usuario
router.get('/users/:userId/lists', getUserPublicLists);

// === GESTIÓN DE PELÍCULAS EN LISTAS ===

// Añadir película - verificar permiso básico Y propiedad
router.post('/lists/:listId/movies', 
    requirePermission('content.own.edit'),
    checkListOwnership, 
    addMovieToList
);

// Eliminar película - verificar permiso básico Y propiedad
router.delete('/lists/:listId/movies', 
    requirePermission('content.own.edit'),
    checkListOwnership, 
    removeMovieFromList
);

module.exports = router;