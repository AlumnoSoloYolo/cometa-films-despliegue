const ROLES = {
    ADMIN: 'admin',
    MODERATOR: 'moderator',
    PREMIUM: 'premium',
    USER: 'user'
};

// Permisos simples - lo que cada rol PUEDE hacer
const PERMISSIONS = {
    // Administración
    'admin.panel.access': 'Acceder al panel de administración',
    'admin.users.manage': 'Gestionar usuarios (banear, cambiar roles)',
    'admin.system.view': 'Ver estadísticas del sistema',
    'admin.roles.assign': 'Asignar roles a usuarios',

    // Moderación
    'moderate.reviews.delete': 'Eliminar cualquier reseña',
    'moderate.comments.delete': 'Eliminar cualquier comentario',
    'moderate.lists.delete': 'Eliminar cualquier lista',
    'moderate.chats.view': 'Ver chats de usuarios',
    'moderate.chats.delete': 'Eliminar chats',
    'moderate.messages.delete': 'Eliminar mensajes',
    'moderate.messages.view': 'Ver mensajes privados',
    'moderate.users.ban': 'Banear usuarios (temporal)',
    'moderate.users.unban': 'Desbanear usuarios',
    'moderate.activities.delete': 'Eliminar actividades del feed',
    'moderate.likes.view': 'Ver quién da likes',

    // Premium
    'premium.recommendations': 'Acceso a recomendaciones personalizadas',
    'premium.lists.unlimited': 'Crear listas ilimitadas',
    'premium.stats.advanced': 'Ver estadísticas avanzadas',

    // Follows y Social
    'follow.manage': 'Gestionar seguimientos',
    'follow.requests.manage': 'Gestionar solicitudes de seguimiento',
    'profile.view.private': 'Ver perfiles privados',

    // Chats
    'chat.create': 'Crear chats',
    'chat.participate': 'Participar en chats',
    'chat.archive': 'Archivar chats',
    'chat.clear': 'Limpiar historial de chat',

    // Básicos (todos los roles los tienen)
    'content.create': 'Crear contenido (reseñas, comentarios, listas)',
    'content.own.edit': 'Editar su propio contenido',
    'content.own.delete': 'Eliminar su propio contenido',
    'profile.edit': 'Editar su perfil',
    'profile.delete': 'Eliminar su cuenta',
    'likes.manage': 'Dar y quitar likes',
    'activities.own.delete': 'Eliminar sus propias actividades',

    //  PERMISOS DE REPORTES 
    'reports.create': 'Crear reportes',
    'reports.view': 'Ver reportes propios',

    //  PERMISOS DE MODERACIÓN DE REPORTES 
    'moderate.reports.view': 'Ver todos los reportes',
    'moderate.reports.manage': 'Gestionar reportes',
    'moderate.reports.resolve': 'Resolver reportes',

    //  PERMISOS DE ADMINISTRACIÓN DE REPORTES 
    'admin.reports.stats': 'Ver estadísticas de reportes',
    'admin.reports.export': 'Exportar datos de reportes',
};

// Asignación simple: cada rol tiene ciertos permisos
const ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: [
        // Admins tienen TODOS los permisos
        ...Object.keys(PERMISSIONS)
    ],

    [ROLES.MODERATOR]: [
        // Permisos de moderación + básicos
        'admin.panel.access',
        'moderate.reviews.delete',
        'moderate.comments.delete',
        'moderate.lists.delete',
        'moderate.chats.view',
        'moderate.chats.delete',
        'moderate.messages.delete',
        'moderate.messages.view',
        'moderate.users.ban',
        'moderate.users.unban',
        'moderate.activities.delete',
        'moderate.likes.view',
        'profile.view.private',
        'content.create',
        'content.own.edit',
        'content.own.delete',
        'chat.create',
        'chat.participate',
        'chat.archive',
        'chat.clear',
        'profile.edit',
        'likes.manage',
        'follow.manage',
        'follow.requests.manage',
        'activities.own.delete',
        'reports.create',
        'reports.view',
        'moderate.reports.view',
        'moderate.reports.manage',
        'moderate.reports.resolve',
    ],

    [ROLES.PREMIUM]: [
        // Permisos premium + básicos
        'premium.recommendations',
        'premium.lists.unlimited',
        'premium.stats.advanced',
        'content.create',
        'content.own.edit',
        'content.own.delete',
        'chat.create',
        'chat.participate',
        'chat.archive',
        'chat.clear',
        'profile.edit',
        'profile.delete',
        'likes.manage',
        'follow.manage',
        'follow.requests.manage',
        'activities.own.delete',
        'reports.create',
        'reports.view',
    ],

    [ROLES.USER]: [
        // Solo permisos básicos
        'content.create',
        'content.own.edit',
        'content.own.delete',
        'chat.create',
        'chat.participate',
        'chat.archive',
        'chat.clear',
        'profile.edit',
        'profile.delete',
        'likes.manage',
        'follow.manage',
        'follow.requests.manage',
        'activities.own.delete',
        'reports.create',
        'reports.view'
    ]
};

// Jerarquía simple de roles (para saber quién puede banear a quién)
const ROLE_HIERARCHY = {
    [ROLES.ADMIN]: 4,
    [ROLES.MODERATOR]: 3,
    [ROLES.PREMIUM]: 2,
    [ROLES.USER]: 1
};

module.exports = {
    ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    ROLE_HIERARCHY
};