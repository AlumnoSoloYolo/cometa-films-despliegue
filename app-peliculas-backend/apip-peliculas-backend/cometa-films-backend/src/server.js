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

// 🔧 CORS específico para Vercel - ANTES que cualquier otra cosa
app.use((req, res, next) => {
    // Headers específicos para Chrome móvil y Vercel
    const origin = req.headers.origin;
    const allowedOrigins = [
        'https://cometacine.es',                    // ✅ Tu dominio principal
        'https://cometa-films-despliegue-git-main-lotos-projects-808b38b8.vercel.app',  // ✅ URL Git
        'https://cometa-films-despliegue-ps7w62cet-lotos-projects-808b38b8.vercel.app', // ✅ URL Preview
        'http://localhost:4200'                     // ✅ Desarrollo
    ];
    
    // Permitir origin específico o null para requests sin origin
    if (allowedOrigins.includes(origin) || !origin) {
        res.header('Access-Control-Allow-Origin', origin || 'https://cometacine.es');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    
    // Log para debugging móvil
    if (req.headers['user-agent']?.includes('Mobile')) {
        console.log('📱 Request móvil:', {
            origin: req.headers.origin,
            userAgent: req.headers['user-agent']?.substring(0, 50),
            method: req.method,
            path: req.path
        });
    }
    
    // Manejar OPTIONS requests específicamente
    if (req.method === 'OPTIONS') {
        console.log('🔧 OPTIONS request:', req.path);
        return res.status(200).end();
    }
    
    next();
});

// CORS tradicional como respaldo
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'https://cometacine.es',
            'https://tu-frontend.vercel.app', // Cambia por tu URL real
            'http://localhost:4200'
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('🚫 CORS bloqueado para:', origin);
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Debug middleware para auth
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
    console.log(`Servidor corriendo en el puerto ${config.port}`);
});
