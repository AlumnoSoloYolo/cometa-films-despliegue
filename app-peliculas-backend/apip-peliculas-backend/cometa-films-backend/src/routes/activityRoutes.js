const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const {
    getFeed,
    getUserActivities,
    deleteActivity

} = require('../controllers/activityController');

// Todas las rutas requieren autenticación
router.use(auth);

// Obtener feed de actividad para el usuario actual
router.get('/feed', getFeed);

// Obtener actividades de un usuario específico
router.get('/user/:userId', getUserActivities);

// Eliminar una actividad específica
router.delete('/:activityId', deleteActivity);

module.exports = router;