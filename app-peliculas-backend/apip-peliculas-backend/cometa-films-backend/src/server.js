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

// CORS - Configuración básica que funciona
const corsOptions = {
    origin: [
        process.env.FRONTEND_URL,
        'http://localhost:4200',
        'https://cometacine.es',
        '*' // Temporalmente permitir todo
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Debug middleware
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

// ============================================
// 🐛 ENDPOINTS DE DEBUG - AGREGAR AQUÍ
// ============================================

app.get('/debug-mobile', (req, res) => {
    const debugInfo = {
        timestamp: new Date().toISOString(),
        headers: req.headers,
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        isMobile: /Mobile|Android|iPhone|iPad/.test(req.headers['user-agent'] || ''),
        isChrome: /Chrome/.test(req.headers['user-agent'] || ''),
        origin: req.headers.origin,
        referer: req.headers.referer,
        host: req.headers.host,
        vercelInfo: {
            region: process.env.VERCEL_REGION,
            url: process.env.VERCEL_URL,
            env: process.env.NODE_ENV,
            isVercel: process.env.VERCEL === '1'
        },
        corsHeaders: {
            'access-control-allow-origin': res.getHeader('access-control-allow-origin'),
            'access-control-allow-methods': res.getHeader('access-control-allow-methods'),
            'access-control-allow-headers': res.getHeader('access-control-allow-headers')
        }
    };
    
    console.log('🔍 DEBUG MOBILE REQUEST:', debugInfo);
    
    res.json(debugInfo);
});

app.post('/debug-login', (req, res) => {
    console.log('🔐 DEBUG LOGIN:', {
        timestamp: new Date().toISOString(),
        method: req.method,
        headers: req.headers,
        body: req.body,
        bodySize: JSON.stringify(req.body).length,
        contentType: req.headers['content-type'],
        userAgent: req.headers['user-agent'],
        isMobile: /Mobile|Android|iPhone|iPad/.test(req.headers['user-agent'] || ''),
        isChrome: /Chrome/.test(req.headers['user-agent'] || ''),
        origin: req.headers.origin
    });
    
    res.json({
        message: 'Login debug successful',
        receivedBody: req.body,
        timestamp: new Date().toISOString(),
        headers: req.headers,
        success: true
    });
});

app.post('/debug-auth', (req, res) => {
    console.log('🎯 DEBUG AUTH SIMULATION:', {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        headers: req.headers,
        body: req.body,
        userAgent: req.headers['user-agent'],
        isMobileChrome: /Mobile.*Chrome/.test(req.headers['user-agent'] || ''),
        origin: req.headers.origin
    });
    
    res.json({
        success: true,
        message: 'Debug auth successful',
        user: {
            id: 'debug-user',
            email: req.body.email || 'debug@test.com'
        },
        token: 'debug-jwt-token',
        timestamp: new Date().toISOString()
    });
});

app.options('/debug-cors', (req, res) => {
    console.log('⚡ OPTIONS DEBUG CORS:', {
        timestamp: new Date().toISOString(),
        headers: req.headers,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin
    });
    
    res.status(200).end();
});

app.get('/debug-cors', (req, res) => {
    console.log('🌐 GET DEBUG CORS:', {
        timestamp: new Date().toISOString(),
        headers: req.headers,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin
    });
    
    res.json({
        message: 'CORS test successful',
        timestamp: new Date().toISOString(),
        origin: req.headers.origin,
        userAgent: req.headers['user-agent']
    });
});

// ============================================
// FIN DE ENDPOINTS DE DEBUG
// ============================================

// Rutas normales 
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

// Iniciamos el servidor
server.listen(config.port, () => {
    console.log('Servidor corriendo en el puerto ' + config.port);
});
