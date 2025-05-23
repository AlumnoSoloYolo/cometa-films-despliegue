// cometa-films-backend/src/services/recommendation.service.js (versión completa corregida)
const User = require('../models/user.model');
const Review = require('../models/review.model');
const Watched = require('../models/watched.model');
const Watchlist = require('../models/watchlist.model');
const tmdbService = require('./tmdb.service');
const mongoose = require('mongoose');

// Cache para mejorar rendimiento - reducido a 2 horas para que se actualice con más frecuencia
const recommendationCache = new Map();
// const CACHE_EXPIRY = 2 * 60 * 60 * 1000; // 2 horas
const CACHE_EXPIRY = 365 * 24 * 60 * 60 * 1000; // 1 año

/**
 * Obtiene recomendaciones personalizadas para un usuario premium
 */
exports.getPersonalizedRecommendations = async (userId, limit = 15, forceRefresh = false) => {
    try {
        // Verificar caché (a menos que se solicite forzar refresco)
        const cacheKey = `recommendations_${userId}`;
        const cached = recommendationCache.get(cacheKey);
        if (!forceRefresh && cached && (Date.now() - cached.timestamp < CACHE_EXPIRY)) {
            console.log('Sirviendo recomendaciones desde caché para usuario:', userId);
            // Asegurarse de que no haya duplicados en la caché
            const uniqueCache = removeDuplicateMovies(cached.data);
            return uniqueCache;
        }

        console.log('Generando nuevas recomendaciones para usuario:', userId);

        // 1. Construir perfil del usuario
        const userProfile = await buildUserProfile(userId);

        if (userProfile.error) {
            return { error: userProfile.error, message: 'No hay suficientes datos para generar recomendaciones' };
        }

        // 2. Obtener películas que el usuario ya ha visto o tiene pendientes (para excluirlas)
        const watchedMovies = await Watched.find({ userId }).select('movieId').lean();
        const pendingMovies = await Watchlist.find({ userId }).select('movieId').lean();

        const excludedIds = new Set([
            ...watchedMovies.map(w => w.movieId),
            ...pendingMovies.map(p => p.movieId)
        ]);

        console.log(`Usuario ${userId} tiene ${excludedIds.size} películas excluidas`);

        // 3. Combinar múltiples fuentes de recomendaciones
        const [genreRecs, peopleRecs, similarRecs] = await Promise.all([
            // a. Recomendaciones por géneros favoritos
            getGenreBasedRecommendations(userProfile.topGenres, excludedIds),

            // b. Recomendaciones por directores/actores favoritos
            getPersonBasedRecommendations(userProfile.topPeople, excludedIds),

            // c. Recomendaciones similares a películas favoritas
            getSimilarToFavoritesRecommendations(userProfile.favoriteMovies, excludedIds),
        ]);

        // 4. Combinar todas las recomendaciones
        let allRecommendations = [
            ...genreRecs,
            ...peopleRecs,
            ...similarRecs
        ];

        // 5. IMPORTANTE: Eliminar duplicados por ID antes de continuar
        allRecommendations = removeDuplicateMovies(allRecommendations);

        console.log(`Recomendaciones después de eliminar duplicados: ${allRecommendations.length}`);

        // 6. Implementar sistema de puntuación personalizada
        const scoredRecommendations = scoreRecommendations(allRecommendations, userProfile);

        // 7. Diversificar recomendaciones (que ya no tendrán duplicados)
        const diversifiedRecommendations = diversifyRecommendations(scoredRecommendations, limit);

        // 8. Verificación final de duplicados (por si acaso)
        const finalRecommendations = removeDuplicateMovies(diversifiedRecommendations);

        // 9. Guardar en caché
        recommendationCache.set(cacheKey, {
            timestamp: Date.now(),
            data: finalRecommendations
        });

        console.log(`Generadas ${finalRecommendations.length} recomendaciones diversificadas para usuario ${userId}`);

        return finalRecommendations;
    } catch (error) {
        console.error('Error generando recomendaciones personalizadas:', error);
        throw error;
    }
};

/**
 * Función auxiliar para eliminar películas duplicadas por ID
 */
function removeDuplicateMovies(movies) {
    const uniqueMovies = [];
    const seenIds = new Set();

    for (const movie of movies) {
        // Usar id o tmdbId (dependiendo de cuál esté disponible)
        const movieId = movie.id || movie.tmdbId;

        if (movieId && !seenIds.has(movieId.toString())) {
            uniqueMovies.push(movie);
            seenIds.add(movieId.toString());
        }
    }

    console.log(`Eliminados ${movies.length - uniqueMovies.length} duplicados`);
    return uniqueMovies;
}

/**
 * Diversifica las recomendaciones para evitar que todas sean del mismo tipo
 */
function diversifyRecommendations(recommendations, limit = 15) {
    // Primero agrupar por tipo de razón
    const reasonGroups = {};

    // Contador para diagnóstico
    const reasonCounts = {};

    recommendations.forEach(movie => {
        // Extraer el tipo general de razón
        let generalReason = "Otros";

        if (movie.recommendationReason) {
            if (movie.recommendationReason.startsWith("Porque te gusta el cine de")) {
                generalReason = "Género";
            }
            else if (movie.recommendationReason.includes("Director:")) {
                generalReason = "Director";
            }
            else if (movie.recommendationReason.includes("Actor:")) {
                generalReason = "Actor";
            }
            else if (movie.recommendationReason.includes("Película similar:")) {
                generalReason = "Similar";
            }
        }

        // Contar para diagnóstico
        reasonCounts[generalReason] = (reasonCounts[generalReason] || 0) + 1;

        // Agrupar
        if (!reasonGroups[generalReason]) {
            reasonGroups[generalReason] = [];
        }
        reasonGroups[generalReason].push(movie);
    });

    // Imprimir diagnóstico
    console.log("Tipos de recomendaciones y cantidades encontradas:");
    Object.keys(reasonCounts).forEach(reason => {
        console.log(`- ${reason}: ${reasonCounts[reason]} películas`);
    });

    // Obtener lista de tipos de razones disponibles
    const reasonTypes = Object.keys(reasonGroups);
    if (reasonTypes.length === 0) return [];

    // Establecer cuotas mínimas por tipo (asegurando que al menos haya algo de género)
    let targetDistribution = {
        'Género': Math.min(5, Math.ceil(limit * 0.33)), // Al menos 33% de género si hay disponibles
        'Director': Math.min(4, Math.ceil(limit * 0.27)),
        'Actor': Math.min(4, Math.ceil(limit * 0.27)),
        'Similar': Math.min(2, Math.ceil(limit * 0.13)),
        'Otros': 0
    };

    // Ajustar cuotas basado en disponibilidad
    Object.keys(targetDistribution).forEach(reason => {
        if (!reasonGroups[reason] || reasonGroups[reason].length === 0) {
            targetDistribution[reason] = 0;
            console.log(`No hay películas disponibles para la categoría: ${reason}`);
        } else if (reasonGroups[reason].length < targetDistribution[reason]) {
            // Si hay menos películas que la cuota, ajustar
            targetDistribution[reason] = reasonGroups[reason].length;
            console.log(`Ajustando cuota de ${reason} a ${targetDistribution[reason]} por disponibilidad limitada`);
        }
    });

    // Calcular total asignado
    const totalAssigned = Object.values(targetDistribution).reduce((sum, count) => sum + count, 0);
    console.log(`Total asignado inicialmente: ${totalAssigned} de ${limit}`);

    // Si hay espacio restante, distribuir entre categorías disponibles
    if (totalAssigned < limit) {
        const remaining = limit - totalAssigned;
        console.log(`Distribuyendo ${remaining} espacios restantes...`);

        // Prioridad para distribuir espacios restantes
        const priorities = ['Género', 'Director', 'Actor', 'Similar', 'Otros'];

        let toDistribute = remaining;
        for (const reason of priorities) {
            if (toDistribute <= 0) break;

            if (reasonGroups[reason] &&
                reasonGroups[reason].length > targetDistribution[reason]) {

                const canAdd = Math.min(
                    toDistribute,
                    reasonGroups[reason].length - targetDistribution[reason]
                );

                targetDistribution[reason] += canAdd;
                toDistribute -= canAdd;

                console.log(`Añadido ${canAdd} espacio(s) adicional(es) a ${reason}`);
            }
        }
    }

    // Construir lista final diversificada
    const diversified = [];

    // Añadir películas según cuotas
    Object.keys(targetDistribution).forEach(reason => {
        if (targetDistribution[reason] > 0 && reasonGroups[reason]) {
            const toAdd = reasonGroups[reason].slice(0, targetDistribution[reason]);
            diversified.push(...toAdd);

            console.log(`Añadidas ${toAdd.length} películas de tipo ${reason}`);
        }
    });

    console.log(`Lista diversificada final: ${diversified.length} películas`);
    return diversified;
}

/**
 * Construye un perfil de usuario basado en su historial
 */
async function buildUserProfile(userId) {
    try {
        // Verificar si hay suficientes películas vistas
        const watchedCount = await Watched.countDocuments({ userId });

        if (watchedCount < 3) {
            return {
                error: 'INSUFFICIENT_DATA',
                watchedCount,
                requiredCount: 3
            };
        }

        // Obtener películas vistas 
        const watched = await Watched.find({ userId }).sort({ watchedAt: -1 }).lean();
        console.log(`Usuario ${userId} ha visto ${watched.length} películas`);

        // Obtener reseñas para analizar preferencias
        const reviews = await Review.find({ userId }).sort({ rating: -1 }).lean();
        console.log(`Usuario ${userId} tiene ${reviews.length} reseñas`);

        // Identificar películas favoritas (con reseñas positivas o vistas recientemente)
        const favoriteMovieIds = new Set([
            // Películas bien valoradas (7 o más)
            ...reviews.filter(r => r.rating >= 7).map(r => r.movieId),
            // Películas vistas recientemente (top 5)
            ...watched.slice(0, 5).map(w => w.movieId)
        ]);

        console.log(`Usuario ${userId} tiene ${favoriteMovieIds.size} películas favoritas`);

        // Obtener detalles completos de todas las películas vistas
        const movieDetails = await Promise.all(
            watched.map(w => tmdbService.getMovieDetails(w.movieId))
        );

        // Obtener detalles de películas favoritas
        const favoriteMovies = await Promise.all(
            Array.from(favoriteMovieIds).map(id => tmdbService.getMovieDetails(id))
        );

        // Analizar preferencias de género
        const genreCounts = {};

        // Contar géneros de todas las películas vistas
        let totalGenresProcessed = 0;

        movieDetails.forEach(movie => {
            if (movie.genres && Array.isArray(movie.genres)) {
                movie.genres.forEach(genre => {
                    if (genre && genre.id) {
                        if (!genreCounts[genre.id]) {
                            genreCounts[genre.id] = { count: 0, name: genre.name };
                        }
                        genreCounts[genre.id].count += 1;
                        totalGenresProcessed++;
                    }
                });
            }
        });

        console.log(`Procesados ${totalGenresProcessed} géneros de ${movieDetails.length} películas`);

        // Obtener créditos para películas favoritas (limitado a 5)
        const favoriteCredits = await Promise.all(
            Array.from(favoriteMovieIds).slice(0, 5).map(id =>
                tmdbService.getMovieCredits(id)
            )
        );

        // Analizar directores y actores favoritos
        const personCounts = {};
        favoriteCredits.forEach(credits => {
            // Directores
            if (credits.crew) {
                credits.crew
                    .filter(p => p.job === 'Director')
                    .forEach(person => {
                        if (!personCounts[person.id]) {
                            personCounts[person.id] = {
                                count: 0,
                                name: person.name,
                                role: 'Director'
                            };
                        }
                        personCounts[person.id].count += 1;
                    });
            }

            // Actores principales (top 3 de cada película)
            if (credits.cast) {
                credits.cast.slice(0, 3).forEach(person => {
                    if (!personCounts[person.id]) {
                        personCounts[person.id] = {
                            count: 0,
                            name: person.name,
                            role: 'Actor'
                        };
                    }
                    personCounts[person.id].count += 1;
                });
            }
        });

        // Ordenar géneros por frecuencia
        const topGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([id, info]) => ({
                id: parseInt(id),
                name: info.name,
                count: info.count
            }));

        console.log("Top géneros encontrados:");
        topGenres.slice(0, 5).forEach(genre => {
            console.log(`- ${genre.name}: ${genre.count} películas`);
        });

        // Ordenar personas por frecuencia
        const topPeople = Object.entries(personCounts)
            .sort((a, b) => b[1].count - a[1].count)
            .map(([id, info]) => ({
                id: parseInt(id),
                name: info.name,
                role: info.role,
                count: info.count
            }));

        console.log("Top personas encontradas:");
        topPeople.slice(0, 5).forEach(person => {
            console.log(`- ${person.role} ${person.name}: ${person.count} apariciones`);
        });

        return {
            userId,
            watchedCount,
            reviewCount: reviews.length,
            favoriteMovies,
            topGenres,
            topPeople
        };
    } catch (error) {
        console.error('Error construyendo perfil de usuario:', error);
        throw error;
    }
}

/**
 * Obtiene recomendaciones basadas en géneros favoritos
 */
async function getGenreBasedRecommendations(topGenres, excludedIds, limit = 15) {
    try {
        if (!topGenres || topGenres.length === 0) {
            console.log('No hay géneros favoritos para generar recomendaciones');
            return [];
        }

        console.log(`Generando recomendaciones para ${topGenres.length} géneros favoritos`);
        const recommendations = [];

        // Tomar los 3 géneros más populares
        for (const genre of topGenres.slice(0, 3)) {
            console.log(`Buscando películas para el género: ${genre.name} (ID: ${genre.id})`);

            // Obtener películas populares del género
            const genreMovies = await tmdbService.getMoviesByGenre(
                genre.id,
                { page: 1, sortBy: 'popularity.desc' }
            );

            console.log(`Se encontraron ${genreMovies.length} películas para el género ${genre.name}`);

            // Filtrar películas ya vistas y añadir razón de recomendación
            const filteredMovies = genreMovies
                .filter(movie => !excludedIds.has(movie.id.toString()))
                .map(movie => ({
                    ...movie,
                    recommendationReason: `Porque te gusta el cine de ${genre.name}`
                }));

            console.log(`Después de filtrar, quedan ${filteredMovies.length} películas del género ${genre.name}`);
            recommendations.push(...filteredMovies.slice(0, 5)); // Tomar hasta 5 películas por género
        }

        console.log(`Total de recomendaciones por género generadas: ${recommendations.length}`);
        return recommendations.slice(0, limit);
    } catch (error) {
        console.error('Error obteniendo recomendaciones por género:', error);
        return [];
    }
}

/**
 * Obtiene recomendaciones basadas en personas favoritas (directores/actores)
 */
async function getPersonBasedRecommendations(topPeople, excludedIds, limit = 15) {
    try {
        if (!topPeople || topPeople.length === 0) {
            return [];
        }

        const recommendations = [];

        // Solo considerar personas con más de una aparición para evitar recomendaciones casuales
        const significantPeople = topPeople.filter(person => person.count > 1);

        // Si no hay personas significativas, usar las top 2 en general
        const peoplesToUse = significantPeople.length > 0 ?
            significantPeople.slice(0, 3) :
            topPeople.slice(0, 2);

        // Limitar a 3 personas como máximo para diversificar
        for (const person of peoplesToUse) {
            const personMovies = await tmdbService.getMoviesByPerson(
                person.id,
                { sortBy: 'popularity.desc' }
            );

            // Filtrar películas ya vistas
            const filteredMovies = personMovies
                .filter(movie => !excludedIds.has(movie.id.toString()))
                .slice(0, 3) // Limitar a 3 películas por persona
                .map(movie => ({
                    ...movie,
                    recommendationReason: `${person.role === 'Director' ? 'Director' : 'Actor'}: Trabajo de ${person.name} que podría interesarte`
                }));

            recommendations.push(...filteredMovies);
        }

        return recommendations.slice(0, limit);
    } catch (error) {
        console.error('Error obteniendo recomendaciones por persona:', error);
        return [];
    }
}

/**
 * Obtiene recomendaciones similares a películas favoritas
 */
async function getSimilarToFavoritesRecommendations(favoriteMovies, excludedIds, limit = 15) {
    try {
        if (!favoriteMovies || favoriteMovies.length === 0) {
            return [];
        }

        const recommendations = [];

        // Limitar a 4 películas favoritas para evitar demasiadas solicitudes
        for (const movie of favoriteMovies.slice(0, 4)) {
            const similarMovies = await tmdbService.getSimilarMovies(movie.id);

            // Filtrar películas ya vistas
            const filteredMovies = similarMovies
                .filter(similarMovie => !excludedIds.has(similarMovie.id.toString()))
                .slice(0, 3) // Limitar a 3 películas similares por favorita
                .map(similarMovie => ({
                    ...similarMovie,
                    recommendationReason: `Película similar: Porque te gustó ${movie.title}`
                }));

            recommendations.push(...filteredMovies);
        }

        return recommendations.slice(0, limit);
    } catch (error) {
        console.error('Error obteniendo recomendaciones similares:', error);
        return [];
    }
}



/**
 * Puntúa las recomendaciones basadas en el perfil del usuario
 */
function scoreRecommendations(recommendations, userProfile) {
    // Extraer preferencias de género del usuario
    const genrePreferences = {};
    userProfile.topGenres.forEach(genre => {
        genrePreferences[genre.id] = genre.count;
    });

    const personPreferences = {};
    userProfile.topPeople.forEach(person => {
        personPreferences[person.id] = person.count;
    });

    // Calcular puntuación para cada recomendación
    return recommendations.map(movie => {
        let score = 0;

        // Puntos base por popularidad (0-3 puntos)
        score += Math.min(movie.popularity / 100, 3);

        // Puntos por valoración (0-2 puntos)
        score += Math.min((movie.vote_average - 5) * 0.4, 2);

        // Puntos por coincidencia de género (0-5 puntos)
        const movieGenres = movie.genre_ids || [];
        movieGenres.forEach(genreId => {
            if (genrePreferences[genreId]) {
                score += (genrePreferences[genreId] / 5); // Normalizado
            }
        });

        // Puntos por actualidad (0-2 puntos)
        if (movie.release_date) {
            const releaseYear = parseInt(movie.release_date.split('-')[0]);
            const currentYear = new Date().getFullYear();
            const yearDiff = currentYear - releaseYear;

            if (yearDiff <= 2) score += 2; // Películas de los últimos 2 años
            else if (yearDiff <= 5) score += 1; // Películas de los últimos 5 años
        }

        return {
            ...movie,
            recommendationScore: score
        };
    }).sort((a, b) => b.recommendationScore - a.recommendationScore);
}

/**
 * Invalida la caché de recomendaciones para un usuario
 */
exports.invalidateCache = (userId) => {
    const cacheKey = `recommendations_${userId}`;
    if (recommendationCache.has(cacheKey)) {
        console.log(`Invalidando caché de recomendaciones para usuario ${userId}`);
        recommendationCache.delete(cacheKey);
        return true;
    }
    return false;
};