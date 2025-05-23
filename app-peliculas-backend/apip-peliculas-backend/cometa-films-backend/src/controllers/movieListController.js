const MovieList = require('../models/movie-list.model');
const Follow = require('../models/follow.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const activityService = require('../services/activity.service');

// Crear una nueva lista
exports.createList = async (req, res) => {
    try {
        const { title, description, isPublic, coverImage, movies } = req.body;
        const userId = req.user.id;
        const LISTS_LIMIT = 5; // Límite para usuarios no premium

        // Validaciones básicas
        if (!title) {
            return res.status(400).json({ message: 'El título es obligatorio' });
        }

        // Verificar límite para usuarios no premium
        if (!req.user.isPremium) {
            const listsCount = await MovieList.countDocuments({ userId });

            if (listsCount >= LISTS_LIMIT) {
                return res.status(403).json({
                    message: `Has alcanzado el límite de ${LISTS_LIMIT} listas para usuarios gratuitos. Actualiza a Premium para crear listas ilimitadas.`,
                    error: 'PREMIUM_REQUIRED',
                    currentCount: listsCount,
                    limit: LISTS_LIMIT
                });
            }
        }

        // Continuar con la creación de la lista
        const newList = await MovieList.create({
            userId,
            title,
            description: description || '',
            isPublic: isPublic !== undefined ? isPublic : true,
            coverImage: coverImage || null,
            movies: movies || []
        });

        // Registrar actividad si es pública
        if (isPublic) {
            await activityService.registerActivity({
                userId,
                actionType: 'created_public_list',
                movieList: {
                    listId: newList._id,
                    title: newList.title,
                    coverImage: newList.coverImage
                }
            });
        }

        res.status(201).json({
            message: 'Lista creada correctamente',
            list: newList
        });

    } catch (error) {
        console.error('Error al crear lista:', error);
        res.status(500).json({
            message: 'Error al crear la lista',
            error: error.message
        });
    }
};

// Obtener todas las listas de un usuario
exports.getUserLists = async (req, res) => {
    try {
        const userId = req.user.id;
        const isPremium = req.user.isPremium || false;
        const LISTS_LIMIT = 5; // Límite para usuarios no premium

        // Obtener todas las listas del usuario
        const allLists = await MovieList.find({ userId }).sort({ createdAt: 1 });

        // Preparar respuesta con metadatos adicionales
        let response = {
            lists: [],
            isPremium,
            totalLists: allLists.length,
            hiddenLists: 0
        };

        if (isPremium) {
            // Usuario premium: mostrar todas las listas
            response.lists = allLists;
        } else {
            // Usuario no premium: mostrar solo hasta el límite (las más antiguas primero)
            response.lists = allLists.slice(0, LISTS_LIMIT);
            response.hiddenLists = Math.max(0, allLists.length - LISTS_LIMIT);
        }

        res.json(response);
    } catch (error) {
        console.error('Error al obtener listas:', error);
        res.status(500).json({
            message: 'Error al obtener las listas',
            error: error.message
        });
    }
};

// Obtener listas públicas de un usuario específico
exports.getUserPublicLists = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        const LISTS_LIMIT = 5; // Límite para usuarios no premium

        // Verificar si el usuario existe
        const userToShow = await User.findById(userId);
        if (!userToShow) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Determinar si el usuario cuyo perfil visitamos es premium
        const targetIsPremium = userToShow.isPremium || false;
        const currentIsPremium = req.user.isPremium || false;

        // Si es el propio usuario, aplicar lógica existente
        if (userId === currentUserId) {
            // Obtener todas las listas
            const allLists = await MovieList.find({ userId }).sort({ createdAt: 1 });
            
            // Preparar respuesta
            let response = {
                lists: [],
                isPremium: currentIsPremium,
                totalLists: allLists.length,
                hiddenLists: 0
            };

            if (currentIsPremium) {
                // Usuario premium: mostrar todas las listas
                response.lists = allLists;
            } else {
                // Usuario no premium: mostrar solo hasta el límite
                response.lists = allLists.slice(0, LISTS_LIMIT);
                response.hiddenLists = Math.max(0, allLists.length - LISTS_LIMIT);
            }

            return res.json(response);
        }

        // Obtener todas las listas públicas del usuario
        const publicLists = await MovieList.find({
            userId,
            isPublic: true
        }).sort({ createdAt: 1 });

        // Preparar respuesta con metadatos
        let response = {
            lists: [],
            isPremium: targetIsPremium,
            totalLists: publicLists.length,
            hiddenLists: 0
        };

        // Aplicar límite si el usuario objetivo no es premium
        if (!targetIsPremium) {
            response.lists = publicLists.slice(0, LISTS_LIMIT);
            response.hiddenLists = Math.max(0, publicLists.length - LISTS_LIMIT);
        } else {
            response.lists = publicLists;
        }
        
        res.json(response);
    } catch (error) {
        console.error('Error al obtener listas del usuario:', error);
        res.status(500).json({
            message: 'Error al obtener listas del usuario',
            error: error.message
        });
    }
};

// Añadir película a una lista
exports.addMovieToList = async (req, res) => {
    try {
        const { listId } = req.params;
        const { movieId } = req.body;
        const userId = req.user.id;

        if (!movieId) {
            return res.status(400).json({ message: 'El ID de la película es obligatorio' });
        }

        // Buscar la lista
        const list = await MovieList.findById(listId);

        if (!list) {
            return res.status(404).json({ message: 'Lista no encontrada' });
        }

        // Verificar propiedad
        if (list.userId.toString() !== userId) {
            return res.status(403).json({ message: 'No tienes permiso para modificar esta lista' });
        }

        // Verificar si la película ya está en la lista
        const movieExists = list.movies.some(movie => movie.movieId === movieId);

        if (movieExists) {
            return res.status(400).json({ message: 'Esta película ya está en la lista' });
        }

        // Añadir película a la lista
        list.movies.push({
            movieId,
            addedAt: new Date()
        });

        await list.save();

        res.json({
            message: 'Película añadida a la lista correctamente',
            list
        });

    } catch (error) {
        console.error('Error al añadir película a la lista:', error);
        res.status(500).json({
            message: 'Error al añadir película a la lista',
            error: error.message
        });
    }
};



exports.getListById = async (req, res) => {
    try {
        const { listId } = req.params;
        const userId = req.user.id;

        // Buscar la lista por ID
        const list = await MovieList.findById(listId);

        if (!list) {
            return res.status(404).json({ message: 'Lista no encontrada' });
        }

        // Verificar si el usuario tiene permiso para ver la lista
        // El usuario puede ver la lista si:
        // 1. Es el propietario de la lista, o
        // 2. La lista es pública

        // Verificar si es el propietario
        const isOwner = list.userId.toString() === userId;

        if (!isOwner && !list.isPublic) {
            // Si no es propietario y la lista no es pública
            return res.status(403).json({ message: 'No tienes permiso para ver esta lista' });
        }

        // Devolver la lista
        res.json(list);
    } catch (error) {
        console.error('Error al obtener la lista:', error);
        res.status(500).json({
            message: 'Error al obtener la lista',
            error: error.message
        });
    }
};

exports.updateList = async (req, res) => {
    try {
        const { listId } = req.params;
        const { title, description, isPublic, coverImage } = req.body;
        const userId = req.user.id;

        // Validaciones 
        if (!title) {
            return res.status(400).json({ message: 'El título es obligatorio' });
        }

        // Buscar la lista
        const list = await MovieList.findById(listId);

        if (!list) {
            return res.status(404).json({ message: 'Lista no encontrada' });
        }

        // Verificar propiedad
        if (list.userId.toString() !== userId) {
            return res.status(403).json({ message: 'No tienes permiso para modificar esta lista' });
        }

        // Actualizar campos
        list.title = title;
        list.description = description || '';
        list.isPublic = isPublic !== undefined ? isPublic : list.isPublic;
        if (coverImage !== undefined) {
            list.coverImage = coverImage;
        }
        list.updatedAt = new Date();

        // Guardar cambios
        await list.save();

        res.json({
            message: 'Lista actualizada correctamente',
            list
        });
    } catch (error) {
        console.error('Error al actualizar lista:', error);
        res.status(500).json({
            message: 'Error al actualizar la lista',
            error: error.message
        });
    }
};

// Eliminar una lista
exports.deleteList = async (req, res) => {
    try {
        const { listId } = req.params;
        const userId = req.user.id;

        // Buscar la lista
        const list = await MovieList.findById(listId);

        if (!list) {
            return res.status(404).json({ message: 'Lista no encontrada' });
        }

        // Verificar propiedad
        if (list.userId.toString() !== userId) {
            return res.status(403).json({ message: 'No tienes permiso para eliminar esta lista' });
        }

        // Eliminar la lista
        await MovieList.findByIdAndDelete(listId);

        res.json({
            message: 'Lista eliminada correctamente'
        });
    } catch (error) {
        console.error('Error al eliminar lista:', error);
        res.status(500).json({
            message: 'Error al eliminar la lista',
            error: error.message
        });
    }
};

// Eliminar película de una lista
exports.removeMovieFromList = async (req, res) => {
    try {
        const { listId } = req.params;
        const { movieId } = req.body;
        const userId = req.user.id;

        if (!movieId) {
            return res.status(400).json({ message: 'El ID de la película es obligatorio' });
        }

        // Buscar la lista
        const list = await MovieList.findById(listId);

        if (!list) {
            return res.status(404).json({ message: 'Lista no encontrada' });
        }

        // Verificar propiedad
        if (list.userId.toString() !== userId) {
            return res.status(403).json({ message: 'No tienes permiso para modificar esta lista' });
        }

        // Verificar si la película está en la lista
        const movieIndex = list.movies.findIndex(movie => movie.movieId === movieId);

        if (movieIndex === -1) {
            return res.status(400).json({ message: 'Esta película no está en la lista' });
        }

        // Eliminar película de la lista
        list.movies.splice(movieIndex, 1);
        await list.save();

        res.json({
            message: 'Película eliminada de la lista correctamente',
            list
        });
    } catch (error) {
        console.error('Error al eliminar película de la lista:', error);
        res.status(500).json({
            message: 'Error al eliminar película de la lista',
            error: error.message
        });
    }
};