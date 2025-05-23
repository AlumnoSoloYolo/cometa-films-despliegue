require('dotenv').config();
const axios = require('axios');



/*Obtiene titulo, id y poster de la película*/
exports.getMovieDetails = async (movieId) => {
    try {
        console.log(`Intentando obtener película con ID: ${movieId}`);

        const response = await axios.get(
            `https://api.themoviedb.org/3/movie/${movieId}`,
            {
                params: {
                    language: 'es-ES'
                },
                headers: {
                    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                    accept: 'application/json'
                }
            }
        );

        console.log(`Respuesta exitosa para película ${movieId}:`, {
            status: response.status,
            title: response.data.title,
            id: response.data.id
        });

        return {
            tmdbId: movieId,
            id: response.data.id,
            title: response.data.title,
            posterPath: response.data.poster_path,
            genres: response.data.genres || [],
            overview: response.data.overview,
            vote_average: response.data.vote_average,
            release_date: response.data.release_date
        };
    } catch (error) {
        console.error(`Error al obtener detalles de película ${movieId}:`);

        if (error.response) {
            // La solicitud se hizo y el servidor respondió con un código de estado
            // que no está en el rango 2xx
            console.error('Respuesta de error:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            });
        } else if (error.request) {
            // La solicitud se hizo pero no se recibió respuesta
            console.error('No se recibió respuesta de TMDb');
        } else {
            // Algo ocurrió al configurar la solicitud que desencadenó un error
            console.error('Error de configuración:', error.message);
        }

        return {
            tmdbId: movieId,
            id: movieId,
            title: 'Película desconocida',
            posterPath: null,
            genres: []
        };
    }
};


/*Obtiene películas por género*/
exports.getMoviesByGenre = async (genreId, options = {}) => {
    try {
        const { page = 1, sortBy = 'popularity.desc' } = options;

        const response = await axios.get(
            'https://api.themoviedb.org/3/discover/movie',
            {
                params: {
                    with_genres: genreId,
                    sort_by: sortBy,
                    page,
                    language: 'es-ES'
                },
                headers: {
                    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                    accept: 'application/json'
                }
            }
        );

        return response.data.results;
    } catch (error) {
        console.error(`Error al obtener películas del género ${genreId}:`, error);
        return [];
    }
};

/*Obtiene películas en las que ha participado una persona*/
exports.getMoviesByPerson = async (personId, options = {}) => {
    try {
        const { sortBy = 'popularity.desc' } = options;

        const response = await axios.get(
            `https://api.themoviedb.org/3/person/${personId}/movie_credits`,
            {
                params: {
                    language: 'es-ES'
                },
                headers: {
                    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                    accept: 'application/json'
                }
            }
        );

        // Combinar películas como director (crew) y actor (cast)
        let movies = [];

        // Añadir películas como actor
        movies = movies.concat(response.data.cast || []);

        // Añadir películas como director/crew
        const directorMovies = (response.data.crew || [])
            .filter(item => item.job === 'Director');

        movies = movies.concat(directorMovies);

        // Eliminar duplicados
        const uniqueMovies = [];
        const seenIds = new Set();

        for (const movie of movies) {
            if (!seenIds.has(movie.id)) {
                uniqueMovies.push(movie);
                seenIds.add(movie.id);
            }
        }

        // Ordenar según la opción especificada
        if (sortBy === 'popularity.desc') {
            uniqueMovies.sort((a, b) => b.popularity - a.popularity);
        } else if (sortBy === 'release_date.desc') {
            uniqueMovies.sort((a, b) => {
                if (!a.release_date) return 1;
                if (!b.release_date) return -1;
                return new Date(b.release_date) - new Date(a.release_date);
            });
        }

        return uniqueMovies;
    } catch (error) {
        console.error(`Error al obtener películas de la persona ${personId}:`, error);
        return [];
    }
};

/*Obtiene películas similares a una película dada*/
exports.getSimilarMovies = async (movieId, limit = 10) => {
    try {
        const response = await axios.get(
            `https://api.themoviedb.org/3/movie/${movieId}/similar`,
            {
                params: {
                    language: 'es-ES',
                    page: 1
                },
                headers: {
                    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                    accept: 'application/json'
                }
            }
        );

        return response.data.results.slice(0, limit);
    } catch (error) {
        console.error(`Error al obtener películas similares a ${movieId}:`, error);
        return [];
    }
};

/* Obtiene créditos (equipo y reparto) de una película*/
exports.getMovieCredits = async (movieId) => {
    try {
        const response = await axios.get(
            `https://api.themoviedb.org/3/movie/${movieId}/credits`,
            {
                params: {
                    language: 'es-ES'
                },
                headers: {
                    Authorization: `Bearer ${process.env.TMDB_API_KEY}`,
                    accept: 'application/json'
                }
            }
        );

        return response.data;
    } catch (error) {
        console.error(`Error al obtener créditos de la película ${movieId}:`, error);
        return { cast: [], crew: [] };
    }
};