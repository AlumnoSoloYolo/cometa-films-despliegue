const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const initializeSocketServer = require('./socket');
const config = require('./config/config');
require('./cron/subscription-checker');
// Importamos las rutas
const authRoutes = require('./routes/auth.routes');
const userMovieRoutes = require('./routes/userMovieRoutes');
const userSocialRoutes = require('./routes/userSocialRoutes');
const commentRoutes = require('./routes/commentRoutes');
const movieListRoutes = require('./routes/movieListRoutes');
const likeRoutes = require('./routes/likeRoutes');
const activityRoutes = require('./routes/activityRoutes');
const premiumRoutes = require('./routes/premiumRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/admin.routes');
const reportRoutes = require('./routes/reportRoutes');
const app = express();
const server = http.createServer(app);
// Cors - Middleware
const corsOptions = {
    origin: [
        process.env.FRONTEND_URL,
        'http://localhost:4200',
        '*' // Temporalmente permitir todo
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
    if (req.method === 'POST' && req.path.includes('/auth/')) {
        console.log('🔍 POST DEBUG:', {
            method: req.method,
            path: req.path,
            userAgent: req.headers['user-agent']?.substring(0, 50),
            contentType: req.headers['content-type'],
            origin: req.headers.origin,
            bodyExists: !!req.body,
            bodyType: typeof req.body,
            bodyContent: req.body
        });
    }
    next();
});
// Conexión a MongoDB
mongoose.connect(config.mongodb.uri)
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error conectando a MongoDB:', err));
// Inicializar Socket.IO
const io = initializeSocketServer(server);
// Rutas 
app.use('/auth', authRoutes);
app.use('/user-movies', userMovieRoutes);
app.use('/social', userSocialRoutes);
app.use('/comments', commentRoutes);
app.use('/movie-lists', movieListRoutes);
app.use('/likes', likeRoutes);
app.use('/activity', activityRoutes);
app.use('/api/premium', premiumRoutes);
app.use('/chat', chatRoutes);
app.use('/admin', adminRoutes);
app.use('/reports', reportRoutes);
// Ruta para prueba de salud del API
app.get('/', (req, res) => {
    res.send('API funcionando correctamente');
});
// Manejador de errores global
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Algo salió mal!',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Error del servidor'
    });
});
// Iniciamos el servidor con HTTP en lugar de Express directamente
server.listen(config.port, () => {
    console.log(Servidor corriendo en el puerto ${config.port});
});
