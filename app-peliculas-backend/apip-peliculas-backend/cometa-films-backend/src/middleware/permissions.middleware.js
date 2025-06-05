const PermissionsService = require('../services/permissions.service');

/* Middleware simple para verificar un permiso específico*/
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: 'Usuario no autenticado',
                code: 'NOT_AUTHENTICATED'
            });
        }

        if (!PermissionsService.hasPermission(req.user, permission)) {
            return res.status(403).json({
                message: 'No tienes permisos para realizar esta acción',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: permission,
                userRole: req.user.role
            });
        }

        next();
    };
};

/*Middleware para verificar acceso al panel de admin*/
const requireAdminAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            message: 'Usuario no autenticado',
            code: 'NOT_AUTHENTICATED'
        });
    }

    if (!PermissionsService.canAccessAdminPanel(req.user)) {
        return res.status(403).json({
            message: 'No tienes acceso al panel de administración',
            code: 'NO_ADMIN_ACCESS'
        });
    }

    next();
};

/*Middleware para verificar que puede eliminar una reseña específica
 *Busca la reseña y verifica permisos*/
const canDeleteReview = async (req, res, next) => {
    try {
        const { reviewId } = req.params;
        const Review = require('../models/review.model');
        
        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ message: 'Reseña no encontrada' });
        }

        if (!PermissionsService.canDeleteReview(req.user, review)) {
            return res.status(403).json({
                message: 'No puedes eliminar esta reseña',
                code: 'CANNOT_DELETE_REVIEW'
            });
        }

        req.review = review; // Pasar la reseña al siguiente middleware
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error del servidor', error: error.message });
    }
};

/*Middleware para verificar que puede eliminar un comentario específico
 */
const canDeleteComment = async (req, res, next) => {
    try {
        const { commentId } = req.params;
        const Comment = require('../models/comment.model');
        
        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Comentario no encontrado' });
        }

        if (!PermissionsService.canDeleteComment(req.user, comment)) {
            return res.status(403).json({
                message: 'No puedes eliminar este comentario',
                code: 'CANNOT_DELETE_COMMENT'
            });
        }

        req.comment = comment;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error del servidor', error: error.message });
    }
};

/* Middleware para verificar que puede eliminar una lista específica
 */
const canDeleteList = async (req, res, next) => {
    try {
        const { listId } = req.params;
        const MovieList = require('../models/movie-list.model');
        
        const list = await MovieList.findById(listId);
        if (!list) {
            return res.status(404).json({ message: 'Lista no encontrada' });
        }

        if (!PermissionsService.canDeleteList(req.user, list)) {
            return res.status(403).json({
                message: 'No puedes eliminar esta lista',
                code: 'CANNOT_DELETE_LIST'
            });
        }

        req.list = list;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error del servidor', error: error.message });
    }
};

/*Middleware para verificar que puede banear a un usuario específico
 */
const canBanUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const User = require('../models/user.model');
        
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        if (!PermissionsService.canBanUser(req.user, targetUser)) {
            return res.status(403).json({
                message: 'No puedes banear a este usuario',
                code: 'CANNOT_BAN_USER'
            });
        }

        req.targetUser = targetUser;
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error del servidor', error: error.message });
    }
};

// Middlewares específicos comunes
const requireModerator = requirePermission('admin.panel.access');
const requireAdmin = requirePermission('admin.users.manage');
const requirePremium = requirePermission('premium.recommendations');

module.exports = {
    requirePermission,
    requireAdminAccess,
    canDeleteReview,
    canDeleteComment,
    canDeleteList,
    canBanUser,
    requireModerator,
    requireAdmin,
    requirePremium
};