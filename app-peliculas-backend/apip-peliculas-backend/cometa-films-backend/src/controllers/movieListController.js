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

        console.log(`[CREATE LIST] Usuario: ${req.user.username} (Premium: ${req.user.isPremium})`);
        console.log(`[CREATE LIST] Datos recibidos:`, { title, description, isPublic });

        // Validaciones básicas
        if (!title || title.trim() === '') {
            return res.status(400).json({ 
                message: 'El título es obligatorio',
                error: 'VALIDATION_ERROR'
            });
        }

        // El middleware checkListLimit ya verificó el límite para usuarios no-premium
        // Solo llegamos aquí si:
        // 1. El usuario es premium (listas ilimitadas), O
        // 2. El usuario no es premium pero aún no ha alcanzado el límite de 5
        
        console.log(`[CREATE LIST] Procediendo a crear lista para usuario ${req.user.username}`);
        
        // Crear la nueva lista
        const newList = await MovieList.create({
            userId,
            title: title.trim(),
            description: description ? description.trim() : '',
            isPublic: isPublic !== undefined ? isPublic : true,
            coverImage: coverImage || null,
            movies: movies || []
        });

        console.log(`[CREATE LIST] Lista creada exitosamente: ${newList._id}`);

        // Registrar actividad si es pública
        if (newList.isPublic) {
            try {
                await activityService.registerActivity({
                    userId,
                    actionType: 'created_public_list',
                    movieList: {
                        listId: newList._id,
                        title: newList.title,
                        coverImage: newList.coverImage
                    }
                });
                console.log(`[CREATE LIST] Actividad registrada para lista pública`);
            } catch (activityError) {
                // No fallar si hay error en la actividad, solo loguear
                console.error('[CREATE LIST] Error registrando actividad:', activityError);
            }
        }

        res.status(201).json({
            message: 'Lista creada correctamente',
            list: newList
        });

    } catch (error) {
        console.error('[CREATE LIST] Error detallado:', error);
        
        // Manejar errores específicos de MongoDB
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Datos de la lista inválidos',
                error: 'VALIDATION_ERROR',
                details: error.message
            });
        }

        res.status(500).json({
            message: 'Error interno del servidor al crear la lista',
            error: error.message
        });
    }
};

// Obtener todas las listas de un usuario (para su propio perfil)
exports.getUserLists = async (req, res) => {
    try {
        const userId = req.user.id; // El ID del usuario autenticado
        const isPremium = req.user.isPremium || false;
        const LISTS_LIMIT = 5; // Límite para usuarios no premium

        // Obtener todas las listas del usuario, ordenadas por fecha de creación
        const allLists = await MovieList.find({ userId }).sort({ createdAt: 1 });

        let listsToReturn;
        let hiddenLists = 0;

        if (isPremium) {
            // Usuario premium: mostrar todas las listas
            listsToReturn = allLists;
        } else {
            // Usuario no premium: mostrar solo hasta el límite (las más antiguas primero)
            listsToReturn = allLists.slice(0, LISTS_LIMIT);
            hiddenLists = Math.max(0, allLists.length - LISTS_LIMIT);
        }
        
        res.json({
            lists: listsToReturn,
            isPremium, // El estado premium del usuario que hace la solicitud (dueño del perfil)
            totalLists: allLists.length, // El número total real de listas que tiene el usuario
            hiddenLists
        });
    } catch (error) {
        console.error('Error al obtener listas del propio usuario:', error);
        res.status(500).json({
            message: 'Error al obtener las listas',
            error: error.message
        });
    }
};


// Obtener listas públicas de un usuario específico (para cuando un visitante ve un perfil)
exports.getUserPublicLists = async (req, res) => {
    try {
        const { userId } = req.params; // ID del usuario cuyo perfil se está visitando
        // const currentUserId = req.user ? req.user.id : null; // ID del usuario que realiza la solicitud (visitante)
        const LISTS_LIMIT = 5;

        const userToShow = await User.findById(userId).select('username profileImageUrl isPremium');
        if (!userToShow) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }
        const targetIsPremium = userToShow.isPremium || false; // Premium status del dueño del perfil

        let listsToReturn;
        let totalListsForVisitor; // Este será el contador que vea el visitante

        if (targetIsPremium) {
            // Dueño del perfil ES PREMIUM: mostrar todas sus listas públicas
            listsToReturn = await MovieList.find({ userId, isPublic: true }).sort({ createdAt: 1 });
            totalListsForVisitor = listsToReturn.length;
        } else {
            // Dueño del perfil NO ES PREMIUM:
            // 1. Obtener las primeras LISTS_LIMIT listas creadas por este usuario (públicas o privadas)
            const firstCreatedListsOverall = await MovieList.find({ userId })
                .sort({ createdAt: 1 }) // Las más antiguas primero
                .limit(LISTS_LIMIT);

            // 2. De estas (máximo) 5 primeras listas creadas, filtrar y devolver solo las que son públicas
            listsToReturn = firstCreatedListsOverall.filter(list => list.isPublic);
            totalListsForVisitor = listsToReturn.length; // El contador es el número de estas listas públicas visibles
        }

        res.json({
            lists: listsToReturn, // Las listas que el visitante verá
            totalLists: totalListsForVisitor, // El número para el contador que verá el visitante
            isPremium: targetIsPremium, // Estado premium del dueño del perfil
            username: userToShow.username,
            profileImageUrl: userToShow.profileImageUrl,
            // No es necesario enviar hiddenLists aquí, ya que es la perspectiva de un visitante.
        });

    } catch (error) {
        console.error('Error al obtener listas públicas del usuario:', error);
        res.status(500).json({
            message: 'Error interno del servidor al obtener listas públicas.',
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
        const userId = req.user ? req.user.id : null; // Manejar si el usuario no está autenticado

        // Buscar la lista por ID
        const list = await MovieList.findById(listId).populate('userId', 'username avatar'); // Populate para obtener datos del creador

        if (!list) {
            return res.status(404).json({ message: 'Lista no encontrada' });
        }

        const isOwner = userId && list.userId._id.toString() === userId;

        if (!list.isPublic && !isOwner) {
            // Si no es propietario y la lista no es pública
            return res.status(403).json({ message: 'No tienes permiso para ver esta lista. Es privada.' });
        }

        // Devolver la lista (y si el que la solicita es el dueño)
        res.json({ list, isOwner });

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
        
        const oldIsPublic = list.isPublic;

        // Actualizar campos
        list.title = title;
        list.description = description || '';
        list.isPublic = isPublic !== undefined ? isPublic : list.isPublic;
        if (coverImage !== undefined) { // Permite enviar null para borrarla o una nueva URL
            list.coverImage = coverImage;
        }
        list.updatedAt = new Date();

        // Guardar cambios
        await list.save();
        
        // Registrar actividad si la lista se hace pública o si ya era pública y se actualiza
        if (list.isPublic) {
            if (!oldIsPublic) { // Si se acaba de hacer pública
                 await activityService.registerActivity({
                    userId,
                    actionType: 'created_public_list', // O un nuevo tipo 'made_list_public'
                    movieList: { listId: list._id, title: list.title, coverImage: list.coverImage }
                });
            } else { // Si ya era pública y se actualiza (podría ser opcional)
                 await activityService.registerActivity({
                    userId,
                    actionType: 'updated_public_list', 
                    movieList: { listId: list._id, title: list.title, coverImage: list.coverImage }
                });
            }
        }


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
        // Aquí podrías querer eliminar la actividad asociada si es necesario

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
        // El movieId vendrá en el cuerpo de la solicitud para DELETE, o como parámetro de ruta si prefieres.
        // Asumiendo que viene en el cuerpo:
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