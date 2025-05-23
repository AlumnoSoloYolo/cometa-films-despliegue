const recommendationService = require('../services/recomendation.service');

exports.getPersonalizedRecommendations = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 15;
        const forceRefresh = req.query.refresh === 'true';

        if (!req.user.isPremium) {
            return res.status(403).json({
                message: 'Esta funcionalidad requiere una cuenta premium',
                error: 'PREMIUM_REQUIRED'
            });
        }

        const recommendations = await recommendationService.getPersonalizedRecommendations(userId, limit, forceRefresh);

        res.json(recommendations);
    } catch (error) {
        console.error('Error al obtener recomendaciones personalizadas:', error);
        res.status(500).json({
            message: 'Error al obtener recomendaciones',
            error: error.message
        });
    }
};







