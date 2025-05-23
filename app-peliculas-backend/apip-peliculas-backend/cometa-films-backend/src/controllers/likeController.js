// controllers/likeController.js
const Like = require('../models/like.model');
const Review = require('../models/review.model');
const Comment = require('../models/comment.model');
const MovieList = require('../models/movie-list.model');
const mongoose = require('mongoose');
const activityService = require('../services/activity.service');
const tmdbService = require('../services/tmdb.service');

// Dar like a un contenido
exports.toggleLike = async (req, res) => {
    try {
        const { contentType, contentId } = req.body;
        const userId = req.user.id;

        // Validaciones
        if (!contentType || !contentId) {
            return res.status(400).json({ message: 'Datos incompletos' });
        }

        // Validar que el contentType sea válido
        if (!['review', 'comment', 'list'].includes(contentType)) {
            return res.status(400).json({ message: 'Tipo de contenido no válido' });
        }

        // Validar que el contentId sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({ message: 'ID de contenido no válido' });
        }

        // Verificar que el contenido existe según su tipo
        let contentExists = false;

        switch (contentType) {
            case 'review':
                contentExists = await Review.exists({ _id: contentId });
                break;
            case 'comment':
                contentExists = await Comment.exists({ _id: contentId });
                break;
            case 'list':
                contentExists = await MovieList.exists({ _id: contentId });
                break;
        }

        if (!contentExists) {
            return res.status(404).json({ message: 'Contenido no encontrado' });
        }

        // Verificar si ya existe un like del usuario para este contenido
        const existingLike = await Like.findOne({
            userId,
            contentType,
            contentId
        });

        // Si ya existe, lo eliminamos (toggle)
        if (existingLike) {
            await Like.findByIdAndDelete(existingLike._id);


            return res.json({
                message: 'Like eliminado',
                liked: false
            });
        }

        // Si no existe, creamos un nuevo like
        const newLike = await Like.create({
            userId,
            contentType,
            contentId
        });

        // Registrar actividad según el tipo de contenido
        if (contentType === 'review') {
            const review = await Review.findById(contentId).populate('userId', 'username');
            const movie = await tmdbService.getMovieDetails(review.movieId);

            await activityService.registerActivity({
                userId,
                actionType: 'liked_review',
                review: {
                    reviewId: contentId,
                    authorUsername: review.userId.username,
                    authorAvatar: review.userId.avatar
                },
                movie: {
                    tmdbId: review.movieId,
                    title: movie.title,
                    posterPath: movie.posterPath
                }
            });
        } else if (contentType === 'list') {
            const list = await MovieList.findById(contentId);

            await activityService.registerActivity({
                userId,
                actionType: 'liked_list',
                movieList: {
                    listId: contentId,
                    title: list.title,
                    coverImage: list.coverImage,
                    authorUsername: list.userId.username,
                    authorAvatar: list.userId.avatar
                }
            });
        }

        res.status(201).json({
            message: 'Like añadido',
            liked: true,
            like: newLike
        });

    } catch (error) {
        console.error('Error al gestionar like:', error);
        res.status(500).json({
            message: 'Error al procesar la solicitud de like',
            error: error.message
        });
    }
};

// Verificar si un usuario ha dado like a un contenido
exports.checkLike = async (req, res) => {
    try {
        const { contentType, contentId } = req.params;
        const userId = req.user.id;

        const like = await Like.findOne({
            userId,
            contentType,
            contentId
        });

        res.json({
            liked: !!like
        });

    } catch (error) {
        console.error('Error al verificar like:', error);
        res.status(500).json({
            message: 'Error al verificar like',
            error: error.message
        });
    }
};

// Obtener conteo de likes para un contenido
exports.getLikeCount = async (req, res) => {
    try {
        const { contentType, contentId } = req.params;

        const count = await Like.countDocuments({
            contentType,
            contentId
        });

        res.json({
            count
        });

    } catch (error) {
        console.error('Error al contar likes:', error);
        res.status(500).json({
            message: 'Error al contar likes',
            error: error.message
        });
    }
};

// Obtener estado de likes para múltiples contenidos (útil para listas)
exports.getBulkLikeStatus = async (req, res) => {
    try {
        const { items } = req.body;
        const userId = req.user.id;

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ message: 'Formato de datos incorrecto' });
        }

        const results = {};

        // Consultar todos los likes del usuario actual para estos items
        const likes = await Like.find({
            userId,
            $or: items.map(item => ({
                contentType: item.contentType,
                contentId: item.contentId
            }))
        });

        // Crear un mapa para búsqueda rápida
        const likeMap = {};
        likes.forEach(like => {
            const key = `${like.contentType}-${like.contentId}`;
            likeMap[key] = true;
        });

        // Verificar estado para cada item
        for (const item of items) {
            const key = `${item.contentType}-${item.contentId}`;
            results[key] = {
                contentType: item.contentType,
                contentId: item.contentId,
                liked: !!likeMap[key]
            };
        }

        res.json({
            results
        });

    } catch (error) {
        console.error('Error al obtener estado de likes:', error);
        res.status(500).json({
            message: 'Error al obtener estado de likes',
            error: error.message
        });
    }
};



exports.getLikeUsers = async (req, res) => {
    try {
        const { contentType, contentId } = req.params;

        // Validaciones
        if (!contentType || !contentId) {
            return res.status(400).json({ message: 'Datos incompletos' });
        }

        // Validar que el contentType sea válido
        if (!['review', 'comment', 'list'].includes(contentType)) {
            return res.status(400).json({ message: 'Tipo de contenido no válido' });
        }

        // Validar que el contentId sea un ObjectId válido
        if (!mongoose.Types.ObjectId.isValid(contentId)) {
            return res.status(400).json({ message: 'ID de contenido no válido' });
        }

        // Buscar todos los likes para este contenido
        const likes = await Like.find({
            contentType,
            contentId
        }).populate('userId', 'username avatar _id'); // Asegúrate de tener este índice para optimizar

        // Extraer solo la información de usuario
        const users = likes.map(like => like.userId);

        res.json(users);
    } catch (error) {
        console.error('Error al obtener usuarios de likes:', error);
        res.status(500).json({
            message: 'Error al obtener usuarios que dieron like',
            error: error.message
        });
    }
};