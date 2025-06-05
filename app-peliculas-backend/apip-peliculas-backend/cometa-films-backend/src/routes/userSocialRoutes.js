
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { 
    requirePermission,
    canBanUser 
} = require('../middleware/permissions.middleware');

const {
    getAllUsers,
    searchUsers,
    getUserPublicProfile,
    followUser,
    unfollowUser,
    getFollowStatus,
    getPendingRequests,
    acceptFollowRequest,
    rejectFollowRequest,
    cancelFollowRequest,
    getUserFollowers,
    getUserFollowing,
    removeFollower,
    getUserProfileWithCounts,
    getUserMoviesBasic,
    getBulkFollowStatus,
    getAllUsersOptimized
} = require('../controllers/userSocialController');

// Todas las rutas requieren autenticación
router.use(auth);

// ========================================
// RUTAS DE DESCUBRIMIENTO DE USUARIOS
// ========================================

// Ver lista de usuarios (básico)
router.get('/users/optimized', getAllUsersOptimized);

// Verificar estado de seguimiento masivo
router.post('/follow/status/bulk', 
    requirePermission('follow.manage'), 
    getBulkFollowStatus
);

// Buscar usuarios
router.get('/users/search', searchUsers); // Sin permisos especiales

// Ver todos los usuarios (método menos optimizado)
router.get('/users', getAllUsers);

// ========================================
// RUTAS DE PERFILES
// ========================================

// Ver perfil público de otro usuario
router.get('/users/:userId', getUserPublicProfile); // Sin permisos especiales

// Ver conteos de perfil optimizado
router.get('/users/:userId/profile-counts', getUserProfileWithCounts);

// Ver datos básicos de películas de un usuario
router.get('/users/:userId/movies-basic', getUserMoviesBasic);

// ========================================
// RUTAS DE SEGUIMIENTO
// ========================================

// Seguir usuario
router.post('/follow/:userId', 
    requirePermission('follow.manage'), 
    followUser
);

// Dejar de seguir usuario
router.delete('/follow/:userId', 
    requirePermission('follow.manage'), 
    unfollowUser
);

// Ver estado de seguimiento de un usuario
router.get('/follow/:userId/status', 
    requirePermission('follow.manage'), 
    getFollowStatus
);

// ========================================
// RUTAS DE SOLICITUDES DE SEGUIMIENTO
// ========================================

// Ver solicitudes pendientes
router.get('/follow/requests', 
    requirePermission('follow.requests.manage'), 
    getPendingRequests
);

// Aceptar solicitud de seguimiento
router.post('/follow/requests/:requestId/accept', 
    requirePermission('follow.requests.manage'), 
    acceptFollowRequest
);

// Rechazar solicitud de seguimiento
router.post('/follow/requests/:requestId/reject', 
    requirePermission('follow.requests.manage'), 
    rejectFollowRequest
);

// Cancelar solicitud enviada
router.delete('/follow/requests/:requestId/cancel', 
    requirePermission('follow.requests.manage'), 
    cancelFollowRequest
);

// ========================================
// RUTAS DE GESTIÓN DE SEGUIDORES
// ========================================

// Ver seguidores de un usuario
router.get('/users/:userId/followers', getUserFollowers);

// Ver usuarios que sigue un usuario
router.get('/users/:userId/following', getUserFollowing);

// Eliminar seguidor (solo el usuario puede eliminar sus seguidores)
router.delete('/follower/:followerId/remove', 
    requirePermission('follow.manage'), 
    removeFollower
);

module.exports = router;