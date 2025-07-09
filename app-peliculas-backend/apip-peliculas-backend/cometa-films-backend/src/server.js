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

// CORS 
app.use((req, res, next) => {
   res.header('Access-Control-Allow-Origin', '*');
   res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
   res.header('Access-Control-Allow-Credentials', 'true');
   
   // Manejar preflight requests
   if (req.method === 'OPTIONS') {
       return res.status(200).end();
   }
   next();
});

// Middleware CORS adicional
const corsOptions = {
   origin: [
       process.env.FRONTEND_URL,
       'http://localhost:4200',
       '*'
   ],
   credentials: true,
   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Middleware para debugging de requests
app.use((req, res, next) => {
   console.log(`🔍 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'No origin'}`);
   next();
});

// Middleware JSON con mejor manejo de errores
app.use(express.json({ 
   limit: '10mb',
   strict: false  // Permite JSON menos estricto
}));

// Middleware adicional para capturar errores de JSON
app.use((err, req, res, next) => {
   if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
       console.error('❌ Error de JSON:', err.message);
       return res.status(400).json({ 
           error: 'Invalid JSON format', 
           message: 'Please check your request body format' 
       });
   }
   next(err);
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
   res.json({ 
       message: 'API funcionando correctamente',
       timestamp: new Date().toISOString(),
       cors: 'enabled'
   });
});

// Manejador de errores global
app.use((err, req, res, next) => {
   console.error('💥 Error global:', err.stack);
   res.status(500).json({
       message: 'Algo salió mal!',
       error: process.env.NODE_ENV === 'development' ? err.message : 'Error del servidor'
   });
});

// Iniciamos el servidor
server.listen(config.port, () => {
   console.log(`Servidor corriendo en el puerto ${config.port}`);
});
