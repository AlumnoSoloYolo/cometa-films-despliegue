const { ROLES, ROLE_PERMISSIONS, ROLE_HIERARCHY } = require('../config/roles.config');

// ========================================
// VERIFICACIÓN DE PERMISOS
// ========================================

/**
 * Verifica si un usuario tiene un permiso específico
 */
function hasPermission(user, permission) {
    if (!user || !user.role) {
        return false;
    }

    // Usuario baneado no tiene permisos
    if (user.isBanned) {
        return false;
    }

    // Usuario inactivo no tiene permisos
    if (user.isActive === false) {
        return false;
    }

    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    return userPermissions.includes(permission);
}

/**
 * Obtiene todos los permisos de un usuario
 */
function getUserPermissions(user) {
    if (!user || !user.role) {
        return {
            role: 'guest',
            permissions: [],
            isActive: false,
            isBanned: true,
            can: {
                accessAdminPanel: false,
                moderateContent: false,
                banUsers: false,
                manageUsers: false,
                createUnlimitedLists: false,
                accessRecommendations: false,
                viewAnalytics: false,
                manageReports: false,
                createReports: false,
                viewReports: false
            }
        };
    }

    const userRole = user.role;
    const permissions = ROLE_PERMISSIONS[userRole] || [];

    return {
        role: userRole,
        permissions,
        isActive: user.isActive !== false,
        isBanned: user.isBanned === true,
        can: {
            accessAdminPanel: hasPermission(user, 'admin.panel.access'),
            moderateContent: hasPermission(user, 'moderate.reviews.delete') ||
                hasPermission(user, 'moderate.comments.delete'),
            banUsers: hasPermission(user, 'moderate.users.ban'),
            manageUsers: hasPermission(user, 'admin.users.manage'),
            createUnlimitedLists: hasPermission(user, 'premium.lists.unlimited'),
            accessRecommendations: hasPermission(user, 'premium.recommendations'),
            viewAnalytics: hasPermission(user, 'admin.system.view'),
            // PERMISOS DE REPORTES
            manageReports: hasPermission(user, 'moderate.reports.manage'),
            createReports: hasPermission(user, 'reports.create'),
            viewReports: hasPermission(user, 'moderate.reports.view')
        }
    };
}

// ========================================
// PERMISOS ESPECÍFICOS DE ADMIN
// ========================================

function canAccessAdminPanel(user) {
    return hasPermission(user, 'admin.panel.access');
}

function canBanUser(currentUser, targetUser) {
    if (!hasPermission(currentUser, 'moderate.users.ban')) {
        return false;
    }

    if (!targetUser || !targetUser.role) {
        return false;
    }

    // No puedes banearte a ti mismo
    if (currentUser._id.toString() === targetUser._id.toString()) {
        return false;
    }

    // Verificar jerarquía de roles
    const currentLevel = ROLE_HIERARCHY[currentUser.role] || 0;
    const targetLevel = ROLE_HIERARCHY[targetUser.role] || 0;

    return currentLevel > targetLevel;
}

// ========================================
// PERMISOS DE CONTENIDO
// ========================================

function canDeleteReview(user, review) {
    // El usuario puede eliminar su propia reseña
    if (review.userId.toString() === user._id.toString()) {
        return hasPermission(user, 'content.own.delete');
    }

    // Moderadores/admins pueden eliminar cualquier reseña
    return hasPermission(user, 'moderate.reviews.delete');
}

function canDeleteComment(user, comment) {
    // El usuario puede eliminar su propio comentario
    if (comment.userId.toString() === user._id.toString()) {
        return hasPermission(user, 'content.own.delete');
    }

    // Moderadores/admins pueden eliminar cualquier comentario
    return hasPermission(user, 'moderate.comments.delete');
}

function canDeleteList(user, list) {
    // El usuario puede eliminar su propia lista
    if (list.userId.toString() === user._id.toString()) {
        return hasPermission(user, 'content.own.delete');
    }

    // Moderadores/admins pueden eliminar cualquier lista
    return hasPermission(user, 'moderate.lists.delete');
}

function canViewModerationHistory(user) {
    return hasPermission(user, 'admin.panel.access');
}

// ========================================
// PERMISOS DE REPORTES
// ========================================

/**
 * Verifica si un usuario puede crear reportes
 */
function canCreateReport(user) {
    return hasPermission(user, 'reports.create');
}

/**
 * Verifica si un usuario puede ver todos los reportes
 */
function canViewReports(user) {
    return hasPermission(user, 'moderate.reports.view');
}

/**
 * Verifica si un usuario puede gestionar reportes
 */
function canManageReports(user) {
    return hasPermission(user, 'moderate.reports.manage');
}

/**
 * Verifica si un usuario puede resolver reportes
 */
function canResolveReports(user) {
    return hasPermission(user, 'moderate.reports.resolve');
}

/**
 * Verifica si un usuario puede ver estadísticas de reportes
 */
function canViewReportStats(user) {
    return hasPermission(user, 'admin.reports.stats');
}

/**
 * Verifica si un usuario puede resolver un reporte específico
 */
function canResolveReport(user, report) {
    // Primero verificar permisos generales
    if (!canResolveReports(user)) {
        return false;
    }

    // Los admins pueden resolver cualquier reporte
    if (user.role === ROLES.ADMIN) {
        return true;
    }

    // Los moderadores pueden resolver reportes, excepto reportes contra admins
    if (user.role === ROLES.MODERATOR) {
        return report.reportedUser.role !== ROLES.ADMIN;
    }

    return false;
}

/**
 * Verifica si un usuario puede ver el historial de reportes de otro usuario
 */
function canViewUserReports(currentUser, targetUser) {
    if (!canViewReports(currentUser)) {
        return false;
    }

    // Los admins pueden ver reportes de cualquier usuario
    if (currentUser.role === ROLES.ADMIN) {
        return true;
    }

    // Los moderadores pueden ver reportes de usuarios, pero no de otros moderadores o admins
    if (currentUser.role === ROLES.MODERATOR) {
        return targetUser.role === ROLES.USER || targetUser.role === ROLES.PREMIUM;
    }

    return false;
}

// ========================================
// EXPORTAR TODAS LAS FUNCIONES
// ========================================

module.exports = {
    // Funciones básicas
    hasPermission,
    getUserPermissions,

    // Permisos de administración
    canAccessAdminPanel,
    canBanUser,

    // Permisos de contenido
    canDeleteReview,
    canDeleteComment,
    canDeleteList,
    canViewModerationHistory,

    // Permisos de reportes
    canCreateReport,
    canViewReports,
    canManageReports,
    canResolveReports,
    canViewReportStats,
    canResolveReport,
    canViewUserReports
};