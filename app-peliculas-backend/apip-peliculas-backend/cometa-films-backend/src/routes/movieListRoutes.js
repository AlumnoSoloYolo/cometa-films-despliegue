const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth.middleware');
const {
    createList,
    getUserLists,
    addMovieToList,
    getUserPublicLists,
    getListById,
    updateList,
    deleteList,
    removeMovieFromList
} = require('../controllers/movieListController');

// Todas las rutas requieren autenticación
router.use(auth);

// Rutas para gestión de listas de películas
router.post('/lists', createList);
router.get('/lists', getUserLists);
router.get('/lists/:listId', getListById);
router.put('/lists/:listId', updateList);
router.delete('/lists/:listId', deleteList);
router.get('/users/:userId/lists', getUserPublicLists);

// Rutas para gestión de películas dentro de las listas
router.post('/lists/:listId/movies', addMovieToList);
router.delete('/lists/:listId/movies', removeMovieFromList);
module.exports = router;