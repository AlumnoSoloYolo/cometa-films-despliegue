const Follow = require('../models/follow.model');
const User = require('../models/user.model');
const Watchlist = require('../models/watchlist.model');
const Watched = require('../models/watched.model');
const Review = require('../models/review.model');
const FollowRequest = require('../models/follow-request.model');
const activityService = require('../services/activity.service');
const socket = require('../socket');

// Obtener todos los usuarios
exports.getAllUsers = async (req, res) => {
    try {
        // Parámetros de paginación
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;
        const currentUserId = req.user.id;

        // Obtener usuarios (excluyendo al usuario actual)
        const users = await User.find({ _id: { $ne: currentUserId } })
            .select('username avatar')
            .skip(skip)
            .limit(limit)
            .lean();

        // Enriquecer datos para el frontend
        const usersWithInfo = await Promise.all(users.map(async user => {
            // Contar películas pendientes
            const pelisPendientesCount = await Watchlist.countDocuments({ userId: user._id });

            // Contar películas vistas
            const pelisVistasCount = await Watched.countDocuments({ userId: user._id });

            // Contar reseñas
            const reviewsCount = await Review.countDocuments({ userId: user._id });

            // Contar seguidores
            const followersCount = await Follow.countDocuments({ following: user._id });

            // Contar seguidos
            const followingCount = await Follow.countDocuments({ follower: user._id });

            // Verificar si el usuario actual sigue a este usuario
            const isFollowing = await Follow.exists({
                follower: currentUserId,
                following: user._id
            });

            return {
                ...user,
                pelisVistasCount,
                pelisPendientesCount,
                reviewsCount,
                followersCount,
                followingCount,
                isFollowing: !!isFollowing
            };
        }));

        // Contar total para paginación
        const total = await User.countDocuments({ _id: { $ne: currentUserId } });

        res.json({
            users: usersWithInfo,
            pagination: {
                total,
                page,
                totalPages: Math.ceil(total / limit),
                hasMore: page < Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        res.status(500).json({
            message: 'Error al obtener usuarios',
            error: error.message
        });
    }
};

// Búsqueda de usuarios
exports.searchUsers = async (req, res) => {
    try {
        const { username } = req.query;
        const currentUserId = req.user.id;

        if (!username) {
            return res.status(400).json({ message: 'Se requiere un término de búsqueda' });
        }

        // Búsqueda de usuarios
        const users = await User.find({
            _id: { $ne: currentUserId },
            username: { $regex: username, $options: 'i' }
        })
            .select('username avatar')
            .limit(20)
            .lean();

        // Enriquecer datos
        const usersWithInfo = await Promise.all(users.map(async user => {
            // Contar estadísticas
            const pelisPendientesCount = await Watchlist.countDocuments({ userId: user._id });
            const pelisVistasCount = await Watched.countDocuments({ userId: user._id });
            const reviewsCount = await Review.countDocuments({ userId: user._id });
            const followersCount = await Follow.countDocuments({ following: user._id });
            const followingCount = await Follow.countDocuments({ follower: user._id });

            // Verificar si el usuario actual sigue a este usuario
            const isFollowing = await Follow.exists({
                follower: currentUserId,
                following: user._id
            });

            return {
                ...user,
                pelisVistasCount,
                pelisPendientesCount,
                reviewsCount,
                followersCount,
                followingCount,
                isFollowing: !!isFollowing
            };
        }));

        res.json(usersWithInfo);
    } catch (error) {
        console.error('Error al buscar usuarios:', error);
        res.status(500).json({
            message: 'Error al buscar usuarios',
            error: error.message
        });
    }
};

// Obtener perfil público
exports.getUserPublicProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        // Verificar si el usuario existe
        const user = await User.findById(userId)
            .select('-password')
            .lean();

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Obtener películas pendientes
        const pelisPendientes = await Watchlist.find({ userId }).lean();

        // Obtener películas vistas
        const pelisVistas = await Watched.find({ userId }).lean();

        // Obtener reseñas
        const reviews = await Review.find({ userId }).lean();

        // Contar seguidores y seguidos
        const followersCount = await Follow.countDocuments({ following: userId });
        const followingCount = await Follow.countDocuments({ follower: userId });

        // Verificar si el usuario actual sigue a este usuario
        const isFollowing = await Follow.exists({
            follower: currentUserId,
            following: userId
        });

        // Construir respuesta
        const enrichedUser = {
            ...user,
            pelisPendientes,
            pelisVistas,
            reviews,
            stats: {
                pelisVistasCount: pelisVistas.length,
                pelisPendientesCount: pelisPendientes.length,
                reviewsCount: reviews.length,
                followersCount,
                followingCount
            },
            isFollowing: !!isFollowing
        };

        res.json(enrichedUser);
    } catch (error) {
        console.error('Error al obtener perfil de usuario:', error);
        res.status(500).json({
            message: 'Error al obtener perfil de usuario',
            error: error.message
        });
    }
};

// Seguir a un usuario
exports.followUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        // Validaciones básicas
        if (userId === currentUserId) {
            return res.status(400).json({ message: 'No puedes seguirte a ti mismo' });
        }

        // Verificar si el usuario a seguir existe
        const userToFollow = await User.findById(userId);
        if (!userToFollow) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar si ya sigue al usuario
        const existingFollow = await Follow.findOne({
            follower: currentUserId,
            following: userId
        });

        if (existingFollow) {
            return res.status(400).json({
                message: 'Ya sigues a este usuario',
                status: 'following'
            });
        }

        // Buscar cualquier solicitud existente, sin importar su estado
        const existingRequest = await FollowRequest.findOne({
            requester: currentUserId,
            recipient: userId
        });

        // Si hay una solicitud pendiente, el usuario podría querer cancelarla
        if (existingRequest && existingRequest.status === 'pending') {
            return res.status(400).json({
                message: 'Ya has enviado una solicitud a este usuario',
                status: 'requested',
                requestId: existingRequest._id
            });
        }

        // Si hay una solicitud rechazada o cualquier otro estado, la eliminamos
        // para poder crear una nueva solicitud limpia
        if (existingRequest) {
            await FollowRequest.findByIdAndDelete(existingRequest._id);
        }

        // Si el usuario tiene perfil privado, crear solicitud
        if (userToFollow.perfilPrivado) {
            const newRequest = await FollowRequest.create({
                requester: currentUserId,
                recipient: userId
            });

            // Obtener información del solicitante para la notificación
            const requesterInfo = await User.findById(currentUserId).select('username avatar');

            // Datos para enviar en la notificación
            const requestData = {
                requestId: newRequest._id,
                requester: {
                    userId: currentUserId,
                    username: requesterInfo.username,
                    avatar: requesterInfo.avatar
                },
                timestamp: new Date()
            };

            // Verificar que la función existe antes de llamarla
            let notificationSent = false;
            if (typeof socket.sendFollowRequest === 'function') {
                notificationSent = socket.sendFollowRequest(userId, requestData);
            } else {
                console.log('La función sendFollowRequest no está disponible');
            }

            return res.status(201).json({
                message: 'Solicitud de seguimiento enviada',
                status: 'requested',
                requestId: newRequest._id,
                notificationSent
            });
        } else {
            // Si no es privado, seguir directamente
            await Follow.create({
                follower: currentUserId,
                following: userId
            });

            // Registrar actividad de seguimiento
            await activityService.registerActivity({
                userId: currentUserId,
                actionType: 'followed_user',
                targetUser: {
                    userId: userId,
                    username: userToFollow.username,
                    avatar: userToFollow.avatar
                }
            });

            return res.status(201).json({
                message: 'Usuario seguido con éxito',
                status: 'following'
            });
        }
    } catch (error) {
        console.error('Error al seguir usuario:', error);
        res.status(500).json({
            message: 'Error al seguir al usuario',
            error: error.message
        });
    }
};

// Dejar de seguir a un usuario
exports.unfollowUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        // Validaciones
        if (userId === currentUserId) {
            return res.status(400).json({ message: 'No puedes dejar de seguirte a ti mismo' });
        }

        // Verificar si el usuario existe
        const userToUnfollow = await User.findById(userId);
        if (!userToUnfollow) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Eliminar relación de seguimiento
        const result = await Follow.findOneAndDelete({
            follower: currentUserId,
            following: userId
        });

        if (!result) {
            return res.status(400).json({ message: 'No sigues a este usuario' });
        }

        res.json({ message: 'Has dejado de seguir al usuario' });
    } catch (error) {
        console.error('Error al dejar de seguir usuario:', error);
        res.status(500).json({
            message: 'Error al dejar de seguir al usuario',
            error: error.message
        });
    }
};

// función para obtener solicitudes pendientes
exports.getPendingRequests = async (req, res) => {
    try {
        const userId = req.user.id;

        // Buscar todas las solicitudes pendientes dirigidas al usuario
        const pendingRequests = await FollowRequest.find({
            recipient: userId,
            status: 'pending'
        }).populate('requester', 'username avatar');

        res.json(pendingRequests);
    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({
            message: 'Error al obtener solicitudes pendientes',
            error: error.message
        });
    }
};

// función para aceptar solicitud
exports.acceptFollowRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user.id;

        // Buscar la solicitud
        const request = await FollowRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        // Verificar que el usuario es el receptor de la solicitud
        if (request.recipient.toString() !== userId) {
            return res.status(403).json({ message: 'No tienes permiso para aceptar esta solicitud' });
        }

        // Cambiar estado de la solicitud
        request.status = 'accepted';
        await request.save();

        // Crear relación de seguimiento
        await Follow.create({
            follower: request.requester,
            following: request.recipient
        });

        // Obtener información de los usuarios para la actividad
        const requesterUser = await User.findById(request.requester).select('username avatar');
        const recipientUser = await User.findById(request.recipient).select('username avatar');

        // Registrar actividad de seguimiento
        await activityService.registerActivity({
            userId: request.requester,
            actionType: 'followed_user',
            targetUser: {
                userId: request.recipient,
                username: recipientUser.username,
                avatar: recipientUser.avatar
            }
        });

        res.json({ message: 'Solicitud aceptada' });
    } catch (error) {
        console.error('Error al aceptar solicitud:', error);
        res.status(500).json({
            message: 'Error al aceptar solicitud',
            error: error.message
        });
    }
};

// función para rechazar solicitud
exports.rejectFollowRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user.id;

        // Buscar la solicitud
        const request = await FollowRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        // Verificar que el usuario es el receptor de la solicitud
        if (request.recipient.toString() !== userId) {
            return res.status(403).json({ message: 'No tienes permiso para rechazar esta solicitud' });
        }

        // Cambiar estado de la solicitud
        request.status = 'rejected';
        await request.save();

        res.json({ message: 'Solicitud rechazada' });
    } catch (error) {
        console.error('Error al rechazar solicitud:', error);
        res.status(500).json({
            message: 'Error al rechazar solicitud',
            error: error.message
        });
    }
};

// cancelar una solicitud pendiente
exports.cancelFollowRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user.id;

        // Buscar la solicitud
        const request = await FollowRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({ message: 'Solicitud no encontrada' });
        }

        // Verificar que el usuario es el solicitante
        if (request.requester.toString() !== userId) {
            return res.status(403).json({ message: 'No tienes permiso para cancelar esta solicitud' });
        }

        // Eliminar la solicitud
        await FollowRequest.findByIdAndDelete(requestId);

        res.json({ message: 'Solicitud cancelada correctamente' });
    } catch (error) {
        console.error('Error al cancelar solicitud:', error);
        res.status(500).json({
            message: 'Error al cancelar solicitud',
            error: error.message
        });
    }
};

// función para comprobar el estado de seguimiento
exports.getFollowStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        // Verificar si ya sigue al usuario
        const existingFollow = await Follow.findOne({
            follower: currentUserId,
            following: userId
        });

        if (existingFollow) {
            return res.json({
                status: 'following'
            });
        }

        // Verificar si hay solicitud pendiente
        const pendingRequest = await FollowRequest.findOne({
            requester: currentUserId,
            recipient: userId,
            status: 'pending'
        });

        if (pendingRequest) {
            return res.json({
                status: 'requested',
                requestId: pendingRequest._id
            });
        }

        // No hay relación
        return res.json({
            status: 'none'
        });
    } catch (error) {
        console.error('Error al verificar estado de seguimiento:', error);
        res.status(500).json({
            message: 'Error al verificar estado',
            error: error.message
        });
    }
};

exports.getUserFollowers = async (req, res) => {
    try {
        const { userId } = req.params;

        // Buscar usuarios que siguen al usuario especificado
        const follows = await Follow.find({ following: userId })
            .populate('follower', 'username avatar _id');

        const followers = follows.map(follow => follow.follower);

        res.json({ followers });
    } catch (error) {
        console.error('Error al obtener seguidores:', error);
        res.status(500).json({
            message: 'Error al obtener seguidores',
            error: error.message
        });
    }
};

exports.getUserFollowing = async (req, res) => {
    try {
        const { userId } = req.params;

        // Buscar usuarios a los que sigue el usuario especificado
        const follows = await Follow.find({ follower: userId })
            .populate('following', 'username avatar _id');

        const following = follows.map(follow => follow.following);

        res.json({ following });
    } catch (error) {
        console.error('Error al obtener seguidos:', error);
        res.status(500).json({
            message: 'Error al obtener seguidos',
            error: error.message
        });
    }
};

exports.removeFollower = async (req, res) => {
    try {
        const { followerId } = req.params;
        const userId = req.user.id;

        // Verificar que existe la relación de seguimiento (followerId sigue a userId)
        const followRelation = await Follow.findOne({
            follower: followerId,
            following: userId
        });

        if (!followRelation) {
            return res.status(400).json({ message: 'Este usuario no te sigue' });
        }

        // Eliminar la relación
        await Follow.findByIdAndDelete(followRelation._id);

        res.json({ message: 'Seguidor eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar seguidor:', error);
        res.status(500).json({
            message: 'Error al eliminar seguidor',
            error: error.message
        });
    }
};