const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const initializeSocketServer = require('./socket');
const config = require('./config/config');

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

// CORS ROBUSTO - MANEJAR OPTIONS MANUALMENTE
app.use((req, res, next) => {
    // Siempre añadir headers CORS
    res.header('Access-Control-Allow-Origin', 'https://cometacine.es');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
        console.log('✅ OPTIONS request manejado para:', req.path);
        return res.status(200).end();
    }
    
    console.log(`🔍 ${req.method} ${req.path} - Origin: ${req.headers.origin}`);
    next();
});

app.use(express.json({ limit: '10mb' }));

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
    res.json({ message: 'API funcionando correctamente' });
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
    console.log(`Servidor corriendo en el puerto ${config.port}`);
});
