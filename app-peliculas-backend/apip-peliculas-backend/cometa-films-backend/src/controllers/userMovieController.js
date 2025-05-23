const mongoose = require('mongoose');
const User = require('../models/user.model');
const Watchlist = require('../models/watchlist.model');
const Watched = require('../models/watched.model');
const Review = require('../models/review.model');
const Comment = require('../models/comment.model');
const tmdbService = require('../services/tmdb.service');
const Follow = require('../models/follow.model');
const activityService = require('../services/activity.service');
const recommendationService = require('../services/recomendation.service');

exports.addPeliPendiente = async (req, res) => {
    try {
        const { movieId } = req.body;
        const userId = req.user.id;

        // Eliminar de películas vistas si está ahí
        await Watched.findOneAndDelete({ userId, movieId });

        // Verificar si la película ya está en la lista de pendientes
        const existingMovie = await Watchlist.findOne({ userId, movieId });

        if (existingMovie) {
            return res.status(400).json({
                message: 'Esta película ya está en tu lista de pendientes'
            });
        }

        // Crear una nueva entrada en la watchlist
        const newWatchlistItem = await Watchlist.create({
            userId,
            movieId,
            addedAt: new Date()
        });


        try {
            // Obtener detalles de la película para la actividad
            const movieDetails = await tmdbService.getMovieDetails(movieId);

            // Registrar actividad
            await activityService.registerActivity({
                userId,
                actionType: 'added_to_watchlist',
                movie: {
                    tmdbId: movieId,
                    title: movieDetails.title,
                    posterPath: movieDetails.posterPath
                }
            });
        } catch (activityError) {
            console.error('Error al registrar actividad de película pendiente:', activityError);
            // No afecta la respuesta principal
        }

        // Recuperar la lista actualizada para mantener el formato anterior
        const pelisPendientes = await Watchlist.find({ userId });

        recommendationService.invalidateCache(userId);

        res.json({
            message: 'Película añadida a pendientes',
            pelisPendientes
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error al añadir la película a pendientes',
            error: error.message
        });
    }
};

exports.addPeliVista = async (req, res) => {
    try {
        const { movieId } = req.body;
        const userId = req.user.id;

        // Eliminar de pendientes
        await Watchlist.findOneAndDelete({ userId, movieId });

        // Verificar si ya está en películas vistas
        const existingWatched = await Watched.findOne({ userId, movieId });

        if (existingWatched) {
            return res.json({
                message: 'Esta película ya estaba marcada como vista',
                watchedItem: existingWatched
            });
        }

        // Añadir a vistas
        const newWatchedItem = await Watched.create({
            userId,
            movieId,
            watchedAt: new Date()
        });

        // Obtener detalles de la película para la actividad
        const movieDetails = await tmdbService.getMovieDetails(movieId); // Implementar esta función

        // Registrar actividad
        await activityService.registerActivity({
            userId,
            actionType: 'added_to_watched',
            movie: {
                tmdbId: movieId,
                title: movieDetails.title,
                posterPath: movieDetails.posterPath
            }
        });

        recommendationService.invalidateCache(userId);

        res.json({
            message: 'Película marcada como vista',
            watchedItem: newWatchedItem
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error al actualizar la película',
            error: error.message
        });
    }
};

exports.addReview = async (req, res) => {
    try {
        const { movieId, rating, comment } = req.body;
        const userId = req.user.id;

        // Verificar si ya existe una reseña para esta película
        const existingReview = await Review.findOne({ userId, movieId });

        if (existingReview) {
            return res.status(400).json({
                message: 'Ya has publicado una reseña para esta película'
            });
        }

        // Obtener datos adicionales del usuario para incluir en la respuesta
        const user = await User.findById(userId).select('username avatar');

        // Crear nueva reseña
        const newReview = await Review.create({
            userId,
            movieId,
            rating,
            comment,
            createdAt: new Date()
        });


        // Obtener detalles de la película para la actividad
        const movieDetails = await tmdbService.getMovieDetails(movieId);

        // Registrar actividad
        await activityService.registerActivity({
            userId,
            actionType: 'created_review',
            movie: {
                tmdbId: movieId,
                title: movieDetails.title,
                posterPath: movieDetails.posterPath
            },
            review: {
                reviewId: newReview._id
            }
        });


        // Añadir datos del usuario para la respuesta (ya que el frontend los espera)
        const reviewWithUserInfo = {
            ...newReview.toObject(),
            username: user.username,
            avatar: user.avatar
        };


        recommendationService.invalidateCache(userId);

        res.json({
            message: 'Reseña añadida correctamente',
            review: reviewWithUserInfo
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error al añadir la reseña',
            error: error.message
        });
    }
};

exports.getUserProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        // Buscar usuario
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Buscar películas pendientes
        const pelisPendientes = await Watchlist.find({ userId }).lean();

        // Buscar películas vistas
        const pelisVistas = await Watched.find({ userId }).lean();

        // Buscar reseñas
        const reviews = await Review.find({ userId }).lean();

        // Construir la respuesta con el mismo formato que esperaba el frontend
        const userProfile = {
            ...user.toObject(),
            pelisPendientes,
            pelisVistas,
            reviews
        };

        console.log('Enviando datos de usuario:', userProfile);
        res.json(userProfile);
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({
            message: 'Error al obtener el perfil del usuario',
            error: error.message
        });
    }
};

exports.updateUserProfile = async (req, res) => {
    try {
        const { username, avatar, biografia, perfilPrivado } = req.body;
        const userId = req.user.id;

        // Validaciones
        if (username) {
            // Verificar si el nuevo username ya existe
            const existingUser = await User.findOne({
                username,
                _id: { $ne: userId }
            });

            if (existingUser) {
                return res.status(400).json({
                    message: 'Este nombre de usuario ya está en uso'
                });
            }
        }

        // Validar avatar
        const validAvatars = ['avatar1', 'avatar2', 'avatar3', 'avatar4',
            'avatar5', 'avatar6', 'avatar7', 'avatar8'];

        if (avatar && !validAvatars.includes(avatar)) {
            return res.status(400).json({
                message: 'Avatar no válido'
            });
        }

        // Preparar objeto de actualización
        const updateData = {};
        if (username) updateData.username = username;
        if (avatar) updateData.avatar = avatar;

        // Añadir los nuevos campos
        if (biografia !== undefined) updateData.biografia = biografia;
        if (perfilPrivado !== undefined) updateData.perfilPrivado = perfilPrivado;

        // Actualizar usuario
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, select: '-password' }
        );

        if (!updatedUser) {
            return res.status(404).json({
                message: 'Usuario no encontrado'
            });
        }

        res.json(updatedUser);
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        res.status(500).json({
            message: 'Error al actualizar perfil',
            error: error.message
        });
    }
};

exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        // Eliminar todas las entradas relacionadas
        await Watchlist.deleteMany({ userId });
        await Watched.deleteMany({ userId });

        // Eliminar reseñas y comentarios asociados
        const userReviews = await Review.find({ userId });
        for (const review of userReviews) {
            await Comment.deleteMany({ reviewId: review._id });
        }
        await Review.deleteMany({ userId });

        // Eliminar relaciones de seguimiento
        await Follow.deleteMany({ follower: userId });
        await Follow.deleteMany({ following: userId });


        // eliminar el usuario
        await User.findByIdAndDelete(userId);

        res.json({
            message: 'Cuenta eliminada correctamente'
        });
    } catch (error) {
        console.error('Error al eliminar cuenta:', error);
        res.status(500).json({
            message: 'Error al eliminar cuenta',
            error: error.message
        });
    }
};

exports.removePeliPendiente = async (req, res) => {
    try {
        const { movieId } = req.body;
        const userId = req.user.id;

        // Eliminar la película de la lista de pendientes
        const result = await Watchlist.findOneAndDelete({ userId, movieId });

        if (!result) {
            return res.status(404).json({
                message: 'Película no encontrada en la lista de pendientes'
            });
        }

        // Recuperar la lista actualizada
        const pelisPendientes = await Watchlist.find({ userId });

        recommendationService.invalidateCache(userId);

        res.json({
            message: 'Película eliminada de pendientes',
            pelisPendientes
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error al eliminar la película de pendientes',
            error: error.message
        });
    }
};

exports.removePeliVista = async (req, res) => {
    try {
        const { movieId } = req.body;
        const userId = req.user.id;

        // Eliminar la película de la lista de vistas
        const result = await Watched.findOneAndDelete({ userId, movieId });

        if (!result) {
            return res.status(404).json({
                message: 'Película no encontrada en la lista de vistas'
            });
        }

        // Recuperar la lista actualizada
        const pelisVistas = await Watched.find({ userId });


        recommendationService.invalidateCache(userId);

        res.json({
            message: 'Película eliminada de vistas',
            pelisVistas
        });

    } catch (error) {
        res.status(500).json({
            message: 'Error al eliminar la película de vistas',
            error: error.message
        });
    }
};

exports.getUserReviews = async (req, res) => {
    try {
        const userId = req.user.id;

        // Buscar todas las reseñas del usuario
        const reviews = await Review.find({ userId }).sort({ createdAt: -1 });

        res.json(reviews);
    } catch (error) {
        res.status(500).json({
            message: 'Error al obtener las reseñas',
            error: error.message
        });
    }
};

exports.getMovieReviews = async (req, res) => {
    try {
        const { movieId } = req.params;

        // Buscar todas las reseñas para la película
        const reviews = await Review.find({ movieId }).sort({ createdAt: -1 });

        // Enriquecer con datos de usuario (username, avatar)
        const enrichedReviews = await Promise.all(reviews.map(async (review) => {
            const user = await User.findById(review.userId).select('username avatar');
            return {
                username: user.username,
                avatar: user.avatar,
                reviewId: review._id,
                movieId: review.movieId,
                rating: review.rating,
                comment: review.comment,
                createdAt: review.createdAt,
                userId: review.userId
            };
        }));

        res.json({
            movie: movieId,
            totalReviews: reviews.length,
            reviews: enrichedReviews
        });

    } catch (error) {
        console.error('Error al obtener las reseñas de la película:', error);
        res.status(500).json({
            message: 'Error al obtener las reseñas de la película',
            error: error.message
        });
    }
};

exports.getReviewById = async (req, res) => {
    try {
        const { reviewId } = req.params;

        // Buscar la reseña por ID
        const review = await Review.findById(reviewId);

        if (!review) {
            return res.status(404).json({ message: 'Reseña no encontrada' });
        }

        // Enriquecer con datos del usuario
        const user = await User.findById(review.userId).select('username avatar');

        res.json({
            _id: review._id,
            movieId: review.movieId,
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
            username: user.username,
            avatar: user.avatar,
            userId: review.userId
        });
    } catch (error) {
        console.error('Error al obtener reseña:', error);
        res.status(500).json({
            message: 'Error al obtener reseña',
            error: error.message
        });
    }
};

exports.updateReview = async (req, res) => {
    try {
        const { movieId } = req.params;
        const { rating, comment } = req.body;
        const userId = req.user.id;

        // Buscar y actualizar la reseña
        const updatedReview = await Review.findOneAndUpdate(
            { userId, movieId },
            {
                rating,
                comment,
                updatedAt: new Date()
            },
            { new: true }
        );

        if (!updatedReview) {
            return res.status(404).json({ message: 'Reseña no encontrada' });
        }

        // Enriquecer con datos del usuario para la respuesta
        const user = await User.findById(userId).select('username avatar');

        res.json({
            message: 'Reseña actualizada correctamente',
            review: {
                ...updatedReview.toObject(),
                username: user.username,
                avatar: user.avatar
            }
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error al actualizar la reseña',
            error: error.message
        });
    }
};

exports.deleteReview = async (req, res) => {
    try {
        const { movieId } = req.params;
        const userId = req.user.id;

        // Buscar la reseña
        const review = await Review.findOne({ userId, movieId });

        if (!review) {
            return res.status(404).json({ message: 'Reseña no encontrada' });
        }

        // Eliminar los comentarios asociados a la reseña
        await Comment.deleteMany({ reviewId: review._id });

        // Eliminar la reseña
        await Review.findByIdAndDelete(review._id);

        recommendationService.invalidateCache(userId);

        res.json({
            message: 'Reseña eliminada correctamente'
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error al eliminar la reseña',
            error: error.message
        });
    }
};