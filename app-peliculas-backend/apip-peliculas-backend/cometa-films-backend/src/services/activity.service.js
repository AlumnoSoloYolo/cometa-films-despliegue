
const Activity = require('../models/activity.model');
const Follow = require('../models/follow.model');
const User = require('../models/user.model');

let io; // Instancia de Socket.IO

/*Inicializa mosel servicio con la instancia de Socket.IO.
 */
exports.initializeActivityService = (socketIoInstance) => {
    io = socketIoInstance;
    console.log('ActivityService: Socket.IO inicializado.');
};

/**
 * Generamos una clave única para una actividad para prevenir duplicados en el feed.
 */
const generateFeedUniqueKey = (actionType, activityData) => {
    const { userId } = activityData; // ID del usuario que realiza la acción

    switch (actionType) {
        case 'followed_user':
            return activityData.targetUser && activityData.targetUser.userId ?
                `follow_${userId}_${activityData.targetUser.userId}` : null;
        case 'created_review':
            return activityData.movie && activityData.movie.tmdbId ?
                `review_${userId}_${activityData.movie.tmdbId}` : null;
        case 'liked_review':
            return activityData.review && activityData.review.reviewId ?
                `like_review_${userId}_${activityData.review.reviewId}` : null;
        case 'liked_list':
            return activityData.movieList && activityData.movieList.listId ?
                `like_list_${userId}_${activityData.movieList.listId}` : null;
        case 'added_to_watchlist':
            return activityData.movie && activityData.movie.tmdbId ?
                `watchlist_${userId}_${activityData.movie.tmdbId}` : null;
        case 'added_to_watched':
            return activityData.movie && activityData.movie.tmdbId ?
                `watched_${userId}_${activityData.movie.tmdbId}` : null;
        case 'created_public_list':
            return activityData.movieList && activityData.movieList.listId ?
                `create_list_${userId}_${activityData.movieList.listId}` : null;
        default:
            console.warn(`generateFeedUniqueKey: actionType '${actionType}' no reconocido para unicidad.`);
            return null;
    }
};

/**
 * Registra una actividad y notifica a los seguidores del usuario.
 */
exports.registerActivity = async (activityData) => {
    if (!io) {
        console.warn('ActivityService: Socket.IO no está disponible. Las notificaciones en tiempo real no funcionarán.');
    }

    // Asignar userDisplay si no viene (debería venir de req.user en el controlador)
    if (!activityData.userDisplay && activityData.userId) {
        try {
            const user = await User.findById(activityData.userId).select('username avatar').lean();
            if (user) {
                activityData.userDisplay = {
                    username: user.username,
                    avatar: user.avatar || 'avatar1'
                };
            } else {
                console.error(`ActivityService: No se pudo encontrar usuario con ID ${activityData.userId} para userDisplay.`);
                activityData.userDisplay = {
                    username: 'Usuario Desconocido',
                    avatar: 'avatar1'
                };
            }
        } catch (error) {
            console.error('ActivityService: Error al obtener información de usuario:', error);
            activityData.userDisplay = {
                username: 'Usuario Desconocido',
                avatar: 'avatar1'
            };
        }
    }

    // Generar y asignar feedUniqueKey si aplica para el actionType
    const uniqueKey = generateFeedUniqueKey(activityData.actionType, activityData);
    if (uniqueKey) {
        activityData.feedUniqueKey = uniqueKey;

        // Verificar si ya existe esta actividad
        try {
            const existingActivity = await Activity.findOne({ feedUniqueKey: activityData.feedUniqueKey }).lean();
            if (existingActivity) {
                console.log(`ActivityService: Actividad duplicada evitada (feedUniqueKey: ${activityData.feedUniqueKey}).`);
                return null; // No crear ni notificar
            }
        } catch (error) {
            console.error('ActivityService: Error al verificar actividad existente:', error);
            // Continuar con la creación (falló la verificación, no la creación)
        }
    }

    try {
        const newActivity = await Activity.create(activityData);
        console.log('ActivityService: Nueva actividad creada:', newActivity._id);

        if (io) {
            // Obtener seguidores del usuario que realizó la acción
            try {
                const followers = await Follow.find({ following: newActivity.userId })
                    .select('follower -_id')
                    .lean();

                const followerIds = followers.map(f => f.follower.toString());

                if (followerIds.length > 0) {
                    const activityToSend = await Activity.findById(newActivity._id).lean();

                    followerIds.forEach(followerId => {
                        console.log(`ActivityService: Emitiendo actividad a la sala del seguidor: ${followerId}`);
                        io.to(followerId).emit('new_activity', activityToSend);
                    });
                }
            } catch (error) {
                console.error('ActivityService: Error al notificar seguidores:', error);
                // No revertir la creación, solo falló la notificación
            }
        }

        return newActivity.toObject(); // Devolver como objeto plano
    } catch (error) {
        // Si el error es por clave duplicada en feedUniqueKey, es esperado y no crítico
        if (error.code === 11000 && error.message.includes('feedUniqueKey')) {
            console.log(`ActivityService: Conflicto de feedUniqueKey al intentar crear actividad. Key: ${activityData.feedUniqueKey}`);
            return null;
        }
        console.error('ActivityService: Error al crear actividad:', error);
        return { error: 'Error al registrar actividad en el feed.' };
    }
};

/**
 * Elimina una actividad específica del feed.
 */
exports.removeActivity = async (criteria) => {
    try {
        const result = await Activity.deleteOne(criteria);
        return { success: true, result };
    } catch (error) {
        console.error('ActivityService: Error al eliminar actividad:', error);
        return { error: 'Error al eliminar actividad del feed.' };
    }
};

/**
 * Elimina una actividad basada en su clave única.
 */
exports.removeActivityByUniqueKey = async (uniqueKey) => {
    return this.removeActivity({ feedUniqueKey: uniqueKey });
};

/**
 * Alterna (toggle) una actividad basada en su clave única.
 */
exports.toggleActivity = async (uniqueKey, activityData, isActive) => {
    if (isActive) {
        // Crear la actividad
        return this.registerActivity({
            ...activityData,
            feedUniqueKey: uniqueKey
        });
    } else {
        // Eliminar la actividad
        return this.removeActivityByUniqueKey(uniqueKey);
    }
};

/**
 * Obtiene el feed de actividad para un usuario.
 */
exports.getFeed = async (userId, options = {}) => {
    const { page = 1, limit = 20, includeOwnActivities = true } = options;
    const skip = (page - 1) * limit;

    try {
        // Obtener IDs de usuarios que el usuario sigue
        const following = await Follow.find({ follower: userId })
            .select('following -_id')
            .lean();

        const followingIds = following.map(f => f.following);

        // Definir de quiénes se mostrarán las actividades en el feed
        let feedSourceIds = [...followingIds];
        if (includeOwnActivities) {
            feedSourceIds.push(userId);
        }

        if (feedSourceIds.length === 0) {
            return {
                activities: [],
                pagination: { total: 0, page, totalPages: 0, hasMore: false }
            };
        }

        // Obtener las actividades
        const activities = await Activity.find({
            userId: { $in: feedSourceIds }
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Contar total para paginación
        const total = await Activity.countDocuments({
            userId: { $in: feedSourceIds }
        });

        return {
            activities,
            pagination: {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                hasMore: (page * limit) < total
            }
        };
    } catch (error) {
        console.error('ActivityService: Error al obtener feed:', error);
        throw error;
    }
};

/**
 * Obtiene las actividades de un usuario específico.
 */
exports.getUserActivities = async (userId, options = {}) => {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    try {
        // Obtener las actividades del usuario
        const activities = await Activity.find({ userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        // Contar total para paginación
        const total = await Activity.countDocuments({ userId });

        return {
            activities,
            pagination: {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                hasMore: (page * limit) < total
            }
        };
    } catch (error) {
        console.error(`ActivityService: Error al obtener actividades del usuario ${userId}:`, error);
        throw error;
    }
};