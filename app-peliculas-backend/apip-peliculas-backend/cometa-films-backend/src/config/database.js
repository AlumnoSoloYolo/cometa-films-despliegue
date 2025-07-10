const mongoose = require('mongoose');

const connectDB = async () => {
    try {
      
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
        
        if (!mongoUri) {
            throw new Error('MongoDB URI no configurada. Verifica MONGODB_URI o MONGO_URI en variables de entorno');
        }

        console.log('🔌 Intentando conectar a MongoDB...');
        console.log('🔗 URI configurada:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Ocultar credenciales en logs

        const conn = await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 15000, // 🔧 AUMENTADO: 15 segundos
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000, // 🔧 NUEVO: Timeout de conexión
            maxPoolSize: 10, // 🔧 NUEVO: Pool de conexiones
            retryWrites: true,
            w: 'majority'
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        
        // 🔧  Listener para desconexiones
        mongoose.connection.on('disconnected', () => {
            console.log('❌ MongoDB disconnected');
        });

        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB error:', err);
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB reconnected');
        });

    } catch (error) {
        console.error(`❌ Error conectando a MongoDB: ${error.message}`);
        console.error('🔍 Detalles del error:', error);
        
        // 🔧  No terminar el proceso inmediatamente, permitir reintentos
        setTimeout(() => {
            console.log('🔄 Reintentando conexión a MongoDB...');
            connectDB();
        }, 10000); // Reintentar en 10 segundos
    }
};

module.exports = connectDB;
