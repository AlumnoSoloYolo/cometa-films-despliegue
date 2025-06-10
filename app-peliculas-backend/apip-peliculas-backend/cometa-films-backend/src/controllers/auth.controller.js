const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const registerUser = async (req, res) => {
    try {
        console.log('Datos recibidos para registro:', req.body);

        const { username, email, password, avatar } = req.body;

        // Validaciones previas
        if (!username || !email || !password) {
            return res.status(400).json({
                message: 'Campos obligatorios incompletos'
            });
        }

        // comprobar si existe
        const userExists = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (userExists) {
            return res.status(400).json({
                message: 'User already exists'
            });
        }

        // Validar y sanitizar el avatar
        const validAvatars = ['avatar1', 'avatar2', 'avatar3', 'avatar4',
            'avatar5', 'avatar6', 'avatar7', 'avatar8'];
        const finalAvatar = validAvatars.includes(avatar) ? avatar : 'avatar1';

        // hashear la contraseña
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            username,
            email,
            password: hashedPassword,
            avatar: finalAvatar,
            following: [],
            followers: []
        });

        // Generar JWT token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        console.log('Usuario registrado con éxito:', {
            username: user.username,
            email: user.email,
            avatar: user.avatar
        });

        res.status(201).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error completo en el registro:', error);

        // Manejo de errores de validación de Mongoose
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                message: 'Error de validación',
                errors: messages
            });
        }

        // Manejo de errores de duplicado de índices
        if (error.code === 11000) {
            return res.status(400).json({
                message: 'Ya existe un usuario con este email o username'
            });
        }

        // Error genérico del servidor
        res.status(500).json({
            message: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error desconocido'
        });
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Buscar usuario por email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verificar contraseña
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generar token
        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                avatar: user.avatar,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({
            message: 'Server error during login',
            error: error.message
        });
    }
};


const verifyPassword = async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.id; // Viene del middleware de autenticación

        // Validaciones básicas
        if (!password) {
            return res.status(400).json({
                message: 'La contraseña es requerida',
                valid: false
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: 'Contraseña demasiado corta',
                valid: false
            });
        }

        // Buscar el usuario en la base de datos
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: 'Usuario no encontrado',
                valid: false
            });
        }

        // Verificar la contraseña usando bcrypt
        const isValidPassword = await bcrypt.compare(password, user.password);

        // Log de seguridad (opcional)
        console.log(`Verificación de contraseña para usuario ${user.username}: ${isValidPassword ? 'ÉXITO' : 'FALLO'}`);

        // Responder con el resultado de la verificación
        res.status(200).json({
            valid: isValidPassword,
            message: isValidPassword 
                ? 'Contraseña verificada correctamente' 
                : 'Contraseña incorrecta'
        });

    } catch (error) {
        console.error('Error en verificación de contraseña:', error);
        
        res.status(500).json({
            message: 'Error interno del servidor',
            valid: false,
            error: process.env.NODE_ENV === 'development' ? error.message : 'Error desconocido'
        });
    }
};

module.exports = {
    registerUser,
    loginUser,
    verifyPassword
};