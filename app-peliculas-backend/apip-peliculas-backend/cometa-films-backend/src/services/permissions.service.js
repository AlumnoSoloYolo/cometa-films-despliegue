const { ROLES, PERMISSIONS, ROLE_PERMISSIONS, ROLE_HIERARCHY } = require('../config/roles.config');

class PermissionsService {
    /**
     * Verifica si un usuario tiene un permiso específico
     * @param {Object} user - Usuario con role
     * @param {string} permission - Permiso a verificar (ej: 'moderate.reviews.delete')
     * @returns {boolean}
     */
    static hasPermission(user, permission) {
        // SEGURIDAD CRÍTICA: Verificaciones estrictas
        if (!user) {
            console.warn('PermissionsService: Usuario no proporcionado');
            return false;
        }
        
        if (!user.role || user.role === null || user.role === undefined) {
            console.warn(`PermissionsService: Usuario ${user.username || user._id} sin rol definido - ACCESO DENEGADO`);
            return false;
        }
        
        // Usuario baneado o inactivo no puede hacer nada
        if (user.isActive === false || user.isBanned === true) {
            console.warn(`PermissionsService: Usuario ${user.username} inactivo o baneado - ACCESO DENEGADO`);
            return false;
        }
        
        // Verificar que el rol existe en la configuración
        if (!ROLE_PERMISSIONS[user.role]) {
            console.warn(`PermissionsService: Rol "${user.role}" no existe en configuración - ACCESO DENEGADO`);
            return false;
        }
        
        // Obtener permisos del rol del usuario
        const userPermissions = ROLE_PERMISSIONS[user.role];
        
        const hasPermission = userPermissions.includes(permission);
        
        // Log para debugging (solo en desarrollo)
        if (process.env.NODE_ENV === 'development') {
            console.log(`PermissionsService: ${user.username} (${user.role}) ${permission} = ${hasPermission}`);
        }
        
        return hasPermission;
    }
    
    /**
     * Verifica si el usuario puede acceder al panel de admin
     */
    static canAccessAdminPanel(user) {
        return this.hasPermission(user, 'admin.panel.access');
    }
    
    /**
     * Verifica si el usuario puede eliminar una reseña específica
     * @param {Object} user - Usuario
     * @param {Object} review - Reseña con userId 
     */
    static canDeleteReview(user, review) {
        // SEGURIDAD: Verificar que el usuario tiene rol
        if (!user || !user.role) {
            console.warn('PermissionsService.canDeleteReview: Usuario sin rol - ACCESO DENEGADO');
            return false;
        }

        // Puede eliminar su propia reseña
        if (review.userId.toString() === user._id.toString()) {
            return this.hasPermission(user, 'content.own.delete');
        }
        
        // O tener permisos de moderación
        return this.hasPermission(user, 'moderate.reviews.delete');
    }
    
    /**
     * Verifica si el usuario puede eliminar un comentario específico
     * @param {Object} user - Usuario
     * @param {Object} comment - Comentario con userId
     */
    static canDeleteComment(user, comment) {
        // SEGURIDAD: Verificar que el usuario tiene rol
        if (!user || !user.role) {
            console.warn('PermissionsService.canDeleteComment: Usuario sin rol - ACCESO DENEGADO');
            return false;
        }

        // Puede eliminar su propio comentario
        if (comment.userId.toString() === user._id.toString()) {
            return this.hasPermission(user, 'content.own.delete');
        }
        
        // O tener permisos de moderación
        return this.hasPermission(user, 'moderate.comments.delete');
    }
    
    /**
     * Verifica si el usuario puede eliminar una lista específica
     * @param {Object} user - Usuario
     * @param {Object} list - Lista con userId
     */
    static canDeleteList(user, list) {
        // SEGURIDAD: Verificar que el usuario tiene rol
        if (!user || !user.role) {
            console.warn('PermissionsService.canDeleteList: Usuario sin rol - ACCESO DENEGADO');
            return false;
        }

        // Puede eliminar su propia lista
        if (list.userId.toString() === user._id.toString()) {
            return this.hasPermission(user, 'content.own.delete');
        }
        
        // O tener permisos de moderación
        return this.hasPermission(user, 'moderate.lists.delete');
    }
    
    /**
     * Verifica si el usuario puede banear a otro usuario
     * @param {Object} user - Usuario que banea
     * @param {Object} targetUser - Usuario a banear
     */
    static canBanUser(user, targetUser) {
        // Debe tener permisos de ban
        if (!this.hasPermission(user, 'moderate.users.ban') && !this.hasPermission(user, 'admin.users.manage')) {
            return false;
        }
        
        // No puede banear a alguien de rol igual o superior
        const userLevel = ROLE_HIERARCHY[user.role] || 0;
        const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;
        
        return userLevel > targetLevel;
    }
    
    /**
     * Verifica si el usuario puede crear listas ilimitadas
     */
    static canCreateUnlimitedLists(user) {
        return this.hasPermission(user, 'premium.lists.unlimited');
    }
    
    /**
     * Verifica si el usuario puede acceder a recomendaciones
     */
    static canAccessRecommendations(user) {
        return this.hasPermission(user, 'premium.recommendations');
    }
    
    /**
     * Obtiene todos los permisos de un usuario (para enviar al frontend)
     */
    static getUserPermissions(user) {
        if (!user || !user.role) return { role: null, permissions: [] };
        
        const permissions = ROLE_PERMISSIONS[user.role] || [];
        
        return {
            role: user.role,
            permissions: permissions,
            isActive: user.isActive,
            isBanned: user.isBanned,
            // Permisos calculados para facilitar el frontend
            can: {
                accessAdminPanel: this.canAccessAdminPanel(user),
                moderateContent: this.hasPermission(user, 'moderate.reviews.delete') || this.hasPermission(user, 'moderate.comments.delete'),
                banUsers: this.hasPermission(user, 'moderate.users.ban') || this.hasPermission(user, 'admin.users.manage'),
                manageUsers: this.hasPermission(user, 'admin.users.manage'),
                createUnlimitedLists: this.canCreateUnlimitedLists(user),
                accessRecommendations: this.canAccessRecommendations(user)
            }
        };
    }
}

module.exports = PermissionsService;