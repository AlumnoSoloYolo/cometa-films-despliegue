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

// CORS específico para Vercel - MUY IMPORTANTE
app.use((req, res, next) => {
    // Headers CORS para Vercel
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
    
    // Específico para móviles
    res.header('Access-Control-Max-Age', '3600');
    res.header('Vary', 'Origin');
    
    // Headers adicionales para navegadores móviles
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Manejar preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    next();
});

// CORS básico como fallback
const corsOptions = {
    origin: true, // Permitir cualquier origen
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma']
};

app.use(cors(corsOptions));

// Middleware para JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware específico para Vercel
app.use((req, res, next) => {
    const isAuthRequest = req.path.includes('/auth/');
    const isMobile = req.headers['user-agent'] && req.headers['user-agent'].includes('Mobile');
    
    if (isAuthRequest || isMobile) {
        console.log('🔍 VERCEL DEBUG:', {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            origin: req.headers.origin,
            referer: req.headers.referer,
            userAgent: req.headers['user-agent'],
            contentType: req.headers['content-type'],
            isMobile: isMobile,
            hasBody: !!req.body && Object.keys(req.body).length > 0,
            vercelRegion: process.env.VERCEL_REGION,
            nodeEnv: process.env.NODE_ENV
        });
    }
    
    next();
});

// Conexión a MongoDB - Optimizada para Vercel
const connectToMongoDB = async () => {
    try {
        await mongoose.connect(config.mongodb.uri, {
            serverSelectionTimeoutMS: 5000, // Timeout más corto para Vercel
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 5,
            maxIdleTimeMS: 30000,
            bufferCommands: false,
            bufferMaxEntries: 0
        });
        console.log('✅ Conectado a MongoDB');
    } catch (err) {
        console.error('❌ Error conectando a MongoDB:', err);
        // En Vercel, no fallar completamente
        if (process.env.NODE_ENV !== 'development') {
            console.log('⚠️ Continuando sin MongoDB en Vercel');
        }
    }
};

connectToMongoDB();

// Inicializar Socket.IO solo si no estamos en Vercel
let io;
if (process.env.VERCEL !== '1') {
    io = initializeSocketServer(server);
} else {
    console.log('⚠️ Socket.IO deshabilitado en Vercel');
}

// Rutas con middleware específico para Vercel
app.use('/auth', (req, res, next) => {
    // Headers específicos para auth en móviles
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    next();
}, authRoutes);

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
    res.json({ 
        message: 'API funcionando correctamente en Vercel',
        timestamp: new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        isMobile: req.headers['user-agent']?.includes('Mobile') || false,
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        nodeVersion: process.version
    });
});

// Ruta específica para probar CORS en móviles
app.get('/test-cors', (req, res) => {
    res.json({
        message: 'CORS funcionando en Vercel',
        origin: req.headers.origin,
        userAgent: req.headers['user-agent'],
        isMobile: req.headers['user-agent']?.includes('Mobile') || false,
        headers: req.headers,
        timestamp: new Date().toISOString()
    });
});

// Endpoint específico para login móvil
app.post('/auth/mobile-test', (req, res) => {
    res.json({
        message: 'Endpoint móvil funcionando',
        body: req.body,
        headers: req.headers,
        timestamp: new Date().toISOString()
    });
});

// Manejador de errores específico para Vercel
app.use((err, req, res, next) => {
    console.error('❌ Error en Vercel:', {
        error: err.message,
        stack: err.stack,
        method: req.method,
        path: req.path,
        origin: req.headers.origin,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
        message: 'Error del servidor',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Error interno',
        timestamp: new Date().toISOString()
    });
});

// Manejar 404s
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Endpoint no encontrado',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// Para Vercel, exportar la app directamente
if (process.env.VERCEL === '1') {
    module.exports = app;
} else {
    // Para desarrollo local
    server.listen(config.port, () => {
        console.log('Servidor corriendo en el puerto ' + config.port);
    });
}

// Manejo de eventos de proceso para Vercel
process.on('SIGINT', () => {
    console.log('📴 Cerrando servidor...');
    if (mongoose.connection.readyState === 1) {
        mongoose.connection.close();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('📴 SIGTERM recibido, cerrando servidor...');
    if (mongoose.connection.readyState === 1) {
        mongoose.connection.close();
    }
    process.exit(0);
});
