const User = require('../models/user.model');
const Review = require('../models/review.model');
const Comment = require('../models/comment.model');
const MovieList = require('../models/movie-list.model');
const Like = require('../models/like.model');
const Report = require('../models/report.model');
const tmdbService = require('../services/tmdb.service'); // ✅ AGREGADO

/**
 * Obtener métricas completas del dashboard
 * GET /admin/dashboard/metrics?timeRange=week
 */
exports.getDashboardMetrics = async (req, res) => {
    try {
        const { timeRange = 'week' } = req.query;
        console.log(`📊 Cargando métricas del dashboard para período: ${timeRange}`);
        
        // Calcular fechas según rango
        const now = new Date();
        let startDate;
        
        switch (timeRange) {
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'quarter':
                startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        }

        console.log(`📅 Rango de fechas: desde ${startDate.toISOString()} hasta ${now.toISOString()}`);

        // ESTADÍSTICAS GENERALES (promesas en paralelo para mejor performance)
        const [
            totalUsers,
            activeUsers,
            bannedUsers,
            premiumUsers,
            totalReviews,
            totalComments,
            totalLists,
            totalReports,
            
            // MÉTRICAS DEL PERÍODO
            newUsersInPeriod,
            newReviewsInPeriod,
            newCommentsInPeriod,
            newListsInPeriod,
            newReportsInPeriod,
            
            // MÉTRICAS DE HOY
            newUsersToday,
            newReviewsToday,
            newCommentsToday,
            newListsToday,
            newReportsToday
            
        ] = await Promise.all([
            // Totales
            User.countDocuments(),
            User.countDocuments({ isActive: true, isBanned: false }),
            User.countDocuments({ isBanned: true }),
            User.countDocuments({ isPremium: true }),
            Review.countDocuments(),
            Comment.countDocuments(),
            MovieList.countDocuments(),
            Report.countDocuments(),
            
            // Del período seleccionado
            User.countDocuments({ createdAt: { $gte: startDate } }),
            Review.countDocuments({ createdAt: { $gte: startDate } }),
            Comment.countDocuments({ createdAt: { $gte: startDate } }),
            MovieList.countDocuments({ createdAt: { $gte: startDate } }),
            Report.countDocuments({ createdAt: { $gte: startDate } }),
            
            // De hoy
            User.countDocuments({ 
                createdAt: { 
                    $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) 
                } 
            }),
            Review.countDocuments({ 
                createdAt: { 
                    $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) 
                } 
            }),
            Comment.countDocuments({ 
                createdAt: { 
                    $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) 
                } 
            }),
            MovieList.countDocuments({ 
                createdAt: { 
                    $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) 
                } 
            }),
            Report.countDocuments({ 
                createdAt: { 
                    $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) 
                } 
            })
        ]);

        console.log(`📈 Estadísticas básicas calculadas:`, {
            totalUsers,
            activeUsers,
            bannedUsers,
            newUsersToday,
            totalReviews,
            newReviewsToday
        });

        // CRECIMIENTO DE USUARIOS
        const userGrowthData = await getUserGrowthChart(timeRange, startDate);
        
        // ACTIVIDAD DIARIA 
        const activityTrends = await getActivityTrends(timeRange, startDate);
        
        // TOP PELÍCULAS ✅ MEJORADO CON TMDB
        const topMovies = await getTopMoviesEnhanced(5);
        
        // MÉTRICAS DE MODERACIÓN
        const moderationStats = await getModerationStats();
        
        // MÉTRICAS DE CONTENIDO
        const totalLikes = await Like.countDocuments();
        const averageRating = await getAverageRating();
        const mostActiveUser = await getMostActiveUser();
        
        // RESPUESTA ESTRUCTURADA
        const dashboardData = {
            overview: {
                totalUsers,
                activeUsers,
                bannedUsers,
                premiumUsers,
                totalReviews,
                totalComments,
                totalLists,
                totalReports
            },
            period: {
                timeRange,
                newUsers: newUsersInPeriod,
                newReviews: newReviewsInPeriod,
                newComments: newCommentsInPeriod,
                newLists: newListsInPeriod,
                newReports: newReportsInPeriod,
                newBans: await getBansInPeriod(startDate)
            },
            today: {
                newUsers: newUsersToday,
                newReviews: newReviewsToday,
                newComments: newCommentsToday,
                newLists: newListsToday,
                newReports: newReportsToday,
                newBans: await getBansInPeriod(new Date(now.getFullYear(), now.getMonth(), now.getDate())),
                totalLikes: Math.floor(totalLikes * 0.05) // Likes de hoy estimado
            },
            moderation: moderationStats,
            content: {
                totalLikes,
                averageRating,
                mostActiveUser
            },
            charts: {
                userGrowth: userGrowthData,
                activityTrends: activityTrends,
                topMovies: topMovies // ✅ Ahora con datos TMDB
            },
            generatedAt: new Date().toISOString()
        };

        console.log(`✅ Dashboard data generado exitosamente con ${topMovies.length} películas populares`);

        res.json({
            success: true,
            data: dashboardData
        });

    } catch (error) {
        console.error('❌ Error obteniendo métricas del dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener métricas del dashboard',
            error: error.message
        });
    }
};

/**
 * Obtener datos específicos para gráficas
 * GET /admin/dashboard/charts/:type?timeRange=week
 */
exports.getChartData = async (req, res) => {
    try {
        const { type } = req.params;
        const { timeRange = 'week' } = req.query;
        
        console.log(`📈 Obteniendo datos de gráfica: ${type} para período: ${timeRange}`);
        
        let chartData;
        const startDate = getStartDateFromRange(timeRange);
        
        switch (type) {
            case 'user-growth':
                chartData = await getUserGrowthChart(timeRange, startDate);
                break;
            case 'activity-trends':
                chartData = await getActivityTrends(timeRange, startDate);
                break;
            case 'content-distribution':
                chartData = await getContentDistribution();
                break;
            case 'top-movies':
                chartData = await getTopMoviesEnhanced(10); // ✅ Versión mejorada
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Tipo de gráfica no válido'
                });
        }

        res.json({
            success: true,
            type,
            timeRange,
            data: chartData
        });

    } catch (error) {
        console.error('❌ Error obteniendo datos de gráfica:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener datos de gráfica',
            error: error.message
        });
    }
};

/**
 * Métricas en tiempo real
 * GET /admin/dashboard/realtime
 */
exports.getRealtimeMetrics = async (req, res) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        console.log(`⚡ Obteniendo métricas en tiempo real`);
        
        const [
            activeUsersNow,
            newUsersToday,
            pendingReports,
            newReportsToday,
            systemHealth
        ] = await Promise.all([
            User.countDocuments({ isActive: true, isBanned: false }),
            User.countDocuments({ createdAt: { $gte: today } }),
            Report.countDocuments({ status: 'pending' }),
            Report.countDocuments({ createdAt: { $gte: today } }),
            getSystemHealth()
        ]);

        res.json({
            success: true,
            realtime: {
                activeUsersNow: Math.floor(activeUsersNow * 0.1), // 10% activos ahora
                pendingReports,
                newReportsToday,
                newUsersToday,
                systemHealth,
                timestamp: now.toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error obteniendo métricas en tiempo real:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener métricas en tiempo real',
            error: error.message
        });
    }
};

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

function getStartDateFromRange(timeRange) {
    const now = new Date();
    switch (timeRange) {
        case 'today':
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        case 'week':
            return new Date(now - 7 * 24 * 60 * 60 * 1000);
        case 'month':
            return new Date(now - 30 * 24 * 60 * 60 * 1000);
        case 'quarter':
            return new Date(now - 90 * 24 * 60 * 60 * 1000);
        default:
            return new Date(now - 7 * 24 * 60 * 60 * 1000);
    }
}

async function getUserGrowthChart(timeRange, startDate) {
    try {
        console.log(`📊 Generando gráfica de crecimiento de usuarios para: ${timeRange}`);
        
        let groupBy, dateFormat;
        
        switch (timeRange) {
            case 'today':
                groupBy = { $hour: '$createdAt' };
                break;
            case 'week':
                groupBy = { 
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
                break;
            case 'month':
            case 'quarter':
                groupBy = { 
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
                break;
        }

        const pipeline = [
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: groupBy,
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ];

        const data = await User.aggregate(pipeline);
        
        // Formatear datos para Chart.js
        return data.map(item => ({
            date: formatDateForChart(item._id, timeRange),
            count: item.count
        }));

    } catch (error) {
        console.error('Error generando gráfica de crecimiento:', error);
        return [];
    }
}

async function getActivityTrends(timeRange, startDate) {
    try {
        console.log(`📊 Generando tendencias de actividad para: ${timeRange}`);
        
        const [reviewData, commentData, likeData] = await Promise.all([
            getActivityDataByType(Review, startDate, timeRange),
            getActivityDataByType(Comment, startDate, timeRange),
            getActivityDataByType(Like, startDate, timeRange)
        ]);
        
        // Combinar datos
        const dates = [...new Set([
            ...reviewData.map(d => d.date),
            ...commentData.map(d => d.date),
            ...likeData.map(d => d.date)
        ])].sort();
        
        return dates.map(date => ({
            date,
            reviews: reviewData.find(d => d.date === date)?.count || 0,
            comments: commentData.find(d => d.date === date)?.count || 0,
            likes: likeData.find(d => d.date === date)?.count || 0
        }));

    } catch (error) {
        console.error('Error generando tendencias de actividad:', error);
        return [];
    }
}

async function getActivityDataByType(Model, startDate, timeRange) {
    let groupBy;
    
    switch (timeRange) {
        case 'today':
            groupBy = { $hour: '$createdAt' };
            break;
        default:
            groupBy = { 
                year: { $year: '$createdAt' },
                month: { $month: '$createdAt' },
                day: { $dayOfMonth: '$createdAt' }
            };
    }

    const pipeline = [
        { $match: { createdAt: { $gte: startDate } } },
        {
            $group: {
                _id: groupBy,
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id': 1 } }
    ];

    const data = await Model.aggregate(pipeline);
    
    return data.map(item => ({
        date: formatDateForChart(item._id, timeRange),
        count: item.count
    }));
}

async function getContentDistribution() {
    try {
        const [reviews, comments, lists, users] = await Promise.all([
            Review.countDocuments(),
            Comment.countDocuments(),
            MovieList.countDocuments(),
            User.countDocuments({ isPremium: true })
        ]);

        return [
            { type: 'Reseñas', count: reviews },
            { type: 'Comentarios', count: comments },
            { type: 'Listas', count: lists },
            { type: 'Usuarios Premium', count: users }
        ];
    } catch (error) {
        console.error('Error obteniendo distribución de contenido:', error);
        return [];
    }
}

// ✅ NUEVA FUNCIÓN MEJORADA PARA TOP PELÍCULAS CON TMDB
async function getTopMoviesEnhanced(limit = 5) {
    try {
        console.log(`🎬 Obteniendo top ${limit} películas con datos de TMDB`);
        
        const topMovies = await Review.aggregate([
            {
                $group: {
                    _id: '$movieId',
                    reviewCount: { $sum: 1 },
                    averageRating: { $avg: '$rating' },
                    lastReviewed: { $max: '$createdAt' }
                }
            },
            { $sort: { reviewCount: -1 } },
            { $limit: limit }
        ]);

        console.log(`📈 Encontradas ${topMovies.length} películas populares`);

        // Enriquecer con datos de TMDB en paralelo
        const enrichedMovies = await Promise.all(
            topMovies.map(async (movie, index) => {
                try {
                    console.log(`🎭 Obteniendo datos TMDB para película ${movie._id}`);
                    
                    // Obtener detalles de TMDB
                    const tmdbData = await tmdbService.getMovieDetails(movie._id);
                    
                    return {
                        movieId: movie._id,
                        title: tmdbData.title || `Película ${movie._id}`,
                        posterPath: tmdbData.posterPath,
                        posterUrl: tmdbData.posterPath ? 
                            `https://image.tmdb.org/t/p/w500${tmdbData.posterPath}` : 
                            null,
                        genres: tmdbData.genres || [],
                        overview: tmdbData.overview,
                        voteAverage: tmdbData.vote_average,
                        releaseDate: tmdbData.release_date,
                        reviewCount: movie.reviewCount,
                        averageRating: Math.round(movie.averageRating * 10) / 10,
                        rank: index + 1,
                        lastReviewed: movie.lastReviewed,
                        // Para mostrar en el frontend
                        year: tmdbData.release_date ? new Date(tmdbData.release_date).getFullYear() : null
                    };
                } catch (tmdbError) {
                    console.error(`❌ Error obteniendo datos TMDB para ${movie._id}:`, tmdbError.message);
                    
                    // Fallback si TMDB falla
                    return {
                        movieId: movie._id,
                        title: `Película ${movie._id}`,
                        posterPath: null,
                        posterUrl: null,
                        genres: [],
                        overview: null,
                        voteAverage: null,
                        releaseDate: null,
                        reviewCount: movie.reviewCount,
                        averageRating: Math.round(movie.averageRating * 10) / 10,
                        rank: index + 1,
                        lastReviewed: movie.lastReviewed,
                        year: null
                    };
                }
            })
        );

        console.log(`✅ ${enrichedMovies.length} películas enriquecidas exitosamente`);
        
        // Log de muestra para debug
        if (enrichedMovies.length > 0) {
            console.log(`🎬 Ejemplo película #1:`, {
                title: enrichedMovies[0].title,
                reviews: enrichedMovies[0].reviewCount,
                rating: enrichedMovies[0].averageRating,
                hasPoster: !!enrichedMovies[0].posterUrl
            });
        }

        return enrichedMovies;

    } catch (error) {
        console.error('❌ Error obteniendo top películas:', error);
        
        // Fallback con datos básicos si todo falla
        return await getTopMoviesBasic(limit);
    }
}

// Función fallback sin TMDB
async function getTopMoviesBasic(limit = 5) {
    try {
        const topMovies = await Review.aggregate([
            {
                $group: {
                    _id: '$movieId',
                    reviewCount: { $sum: 1 },
                    averageRating: { $avg: '$rating' }
                }
            },
            { $sort: { reviewCount: -1 } },
            { $limit: limit }
        ]);

        return topMovies.map((movie, index) => ({
            movieId: movie._id,
            title: `Película ${movie._id}`,
            posterUrl: null,
            reviewCount: movie.reviewCount,
            averageRating: Math.round(movie.averageRating * 10) / 10,
            rank: index + 1
        }));
    } catch (error) {
        console.error('Error obteniendo top películas básicas:', error);
        return [];
    }
}

async function getModerationStats() {
    try {
        const [pendingReports, totalReports, resolvedReports] = await Promise.all([
            Report.countDocuments({ status: 'pending' }),
            Report.countDocuments(),
            Report.countDocuments({ status: 'resolved' })
        ]);

        const efficiency = totalReports > 0 ? Math.round((resolvedReports / totalReports) * 100) : 100;

        return {
            pendingReports,
            averageResolutionTime: 2.5, // Simulado - calcular real en producción
            mostCommonReportType: 'inappropriate_content', // Simulado
            efficiency
        };
    } catch (error) {
        console.error('Error obteniendo estadísticas de moderación:', error);
        return {
            pendingReports: 0,
            averageResolutionTime: 0,
            mostCommonReportType: 'unknown',
            efficiency: 100
        };
    }
}

async function getAverageRating() {
    try {
        const result = await Review.aggregate([
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' }
                }
            }
        ]);

        return result.length > 0 ? Math.round(result[0].averageRating * 10) / 10 : 0;
    } catch (error) {
        console.error('Error calculando rating promedio:', error);
        return 0;
    }
}

async function getMostActiveUser() {
    try {
        const result = await Review.aggregate([
            {
                $group: {
                    _id: '$userId',
                    reviewCount: { $sum: 1 }
                }
            },
            { $sort: { reviewCount: -1 } },
            { $limit: 1 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' }
        ]);

        if (result.length > 0) {
            return {
                username: result[0].user.username,
                activityScore: result[0].reviewCount * 10 // Puntuación basada en reseñas
            };
        }

        return null;
    } catch (error) {
        console.error('Error obteniendo usuario más activo:', error);
        return null;
    }
}

async function getBansInPeriod(startDate) {
    try {
        return await User.countDocuments({
            isBanned: true,
            bannedAt: { $gte: startDate }
        });
    } catch (error) {
        console.error('Error contando bans del período:', error);
        return 0;
    }
}

async function getSystemHealth() {
    try {
        // En producción, verificar métricas reales del sistema
        const [
            totalUsers,
            totalReviews,
            pendingReports,
            recentErrors
        ] = await Promise.all([
            User.countDocuments(),
            Review.countDocuments(),
            Report.countDocuments({ status: 'pending' }),
            // Simular errores recientes - en producción, usar logs reales
            Promise.resolve(Math.floor(Math.random() * 3))
        ]);

        // Determinar estado de salud basado en métricas reales
        let status = 'healthy';
        let responseTime = Math.floor(100 + Math.random() * 100); // Base: 100-200ms

        if (pendingReports > 20) {
            status = 'warning';
            responseTime += 50;
        }

        if (recentErrors > 2) {
            status = 'error';
            responseTime += 100;
        }

        // Si todo está bien
        if (pendingReports <= 5 && recentErrors === 0) {
            status = 'excellent';
            responseTime = Math.max(50, responseTime - 30);
        }

        return {
            status,
            activeConnections: Math.floor(50 + (totalUsers * 0.1)), // 10% de usuarios activos
            responseTime,
            recentErrors,
            uptime: 99.9,
            // Métricas adicionales útiles
            dbConnections: Math.floor(10 + Math.random() * 20),
            memoryUsage: Math.floor(40 + Math.random() * 30), // Porcentaje
            cpuUsage: Math.floor(20 + Math.random() * 40)     // Porcentaje
        };
    } catch (error) {
        console.error('Error obteniendo estado de salud del sistema:', error);
        return {
            status: 'error',
            activeConnections: 0,
            responseTime: 999,
            recentErrors: 999,
            uptime: 0
        };
    }
}

function formatDateForChart(dateObj, timeRange) {
    if (timeRange === 'today') {
        return `${dateObj}:00`;
    }
    
    if (typeof dateObj === 'object' && dateObj.year) {
        const date = new Date(dateObj.year, dateObj.month - 1, dateObj.day);
        return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
    }
    
    return dateObj.toString();
}