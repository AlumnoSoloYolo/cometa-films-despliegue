const Activity = require('../models/activity.model');
const activityService = require('../services/activity.service');

/*Obtiene el feed de actividad para el usuario actual.*/
exports.getFeed = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const includeOwnActivities = req.query.includeOwn !== 'false';

        const result = await activityService.getFeed(userId, {
            page,
            limit,
            includeOwnActivities
        });

        res.json(result);
    } catch (error) {
        console.error('Error al obtener feed de actividad:', error);
        res.status(500).json({
            message: 'Error al obtener feed de actividad',
            error: error.message
        });
    }
};

/*Obtiene las actividades de un usuario específico.*/
exports.getUserActivities = async (req, res) => {
    try {
        const { userId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await activityService.getUserActivities(userId, {
            page,
            limit
        });

        res.json(result);
    } catch (error) {
        console.error('Error al obtener actividades del usuario:', error);
        res.status(500).json({
            message: 'Error al obtener actividades del usuario',
            error: error.message
        });
    }
};

/*Elimina una actividad específica.*/
exports.deleteActivity = async (req, res) => {
    try {
        const { activityId } = req.params;
        const userId = req.user.id;

        // Verificar que el usuario es el dueño de la actividad
        const activity = await Activity.findById(activityId);
        if (!activity) {
            return res.status(404).json({ message: 'Actividad no encontrada' });
        }

        if (activity.userId.toString() !== userId) {
            return res.status(403).json({ message: 'No tienes permiso para eliminar esta actividad' });
        }

        const result = await activityService.removeActivity({ _id: activityId });

        if (result.error) {
            return res.status(500).json({ message: result.error });
        }

        res.json({ message: 'Actividad eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar actividad:', error);
        res.status(500).json({
            message: 'Error al eliminar actividad',
            error: error.message
        });
    }
};