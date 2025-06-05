const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permissions.middleware');

const {
    getFeed,
    getUserActivities,
    deleteActivity
} = require('../controllers/activityController');

// Todas las rutas requieren autenticación
router.use(auth);

// ========================================
// RUTAS DE FEED DE ACTIVIDAD
// ========================================

// Obtener feed de actividad para el usuario actual
// Requiere seguir a otros usuarios para ver su actividad
router.get('/feed', getFeed); // Sin permisos especiales, solo auth

// Obtener actividades de un usuario específico
router.get('/user/:userId', getUserActivities); // Sin permisos especiales

// ========================================
// RUTAS DE GESTIÓN DE ACTIVIDADES
// ========================================

// Eliminar una actividad específica
// Solo puede eliminar sus propias actividades OR ser moderador
router.delete('/:activityId', async (req, res, next) => {
    try {
        const { activityId } = req.params;
        const Activity = require('../models/activity.model');
        
        const activity = await Activity.findById(activityId);
        if (!activity) {
            return res.status(404).json({ message: 'Actividad no encontrada' });
        }

        // Verificar si es su propia actividad
        const isOwner = activity.userId.toString() === req.user._id.toString();
        
        // Verificar si tiene permisos de moderación
        const PermissionsService = require('../services/permissions.service');
        const canModerate = PermissionsService.hasPermission(req.user, 'moderate.activities.delete');

        if (!isOwner && !canModerate) {
            return res.status(403).json({ 
                message: 'No tienes permisos para eliminar esta actividad' 
            });
        }

        req.activity = activity;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error del servidor', error: error.message });
    }
}, deleteActivity);

module.exports = router;