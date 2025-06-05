require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { ROLES } = require('../config/roles.config');
const config = require('../config/config');

async function createAdmin() {
    try {
        // Conectar a MongoDB
        await mongoose.connect(config.mongodb.uri);
        console.log(' Conectado a MongoDB');

        console.log(' Creando usuario administrador...');

        // Verificar si ya hay algún admin
        const existingAdmins = await User.find({ role: ROLES.ADMIN });
        if (existingAdmins.length > 0) {
            console.log('\n Administradores existentes:');
            existingAdmins.forEach(admin => {
                console.log(`   - ${admin.username} (${admin.email})`);
            });
            
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            return new Promise((resolve) => {
                rl.question('\n¿Quieres crear otro administrador? (y/n): ', (answer) => {
                    rl.close();
                    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                        console.log(' Operación cancelada');
                        resolve();
                        return;
                    }
                    createNewAdmin().then(resolve);
                });
            });
        } else {
            await createNewAdmin();
        }

    } catch (error) {
        console.error(' Error:', error);
        throw error;
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('🔌 Conexión cerrada');
        }
    }
}

async function createNewAdmin() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve, reject) => {
        console.log('\n Datos del nuevo administrador:');
        
        rl.question('Username: ', (username) => {
            rl.question('Email: ', (email) => {
                rl.question('Password: ', async (password) => {
                    rl.close();
                    
                    try {
                        // Validaciones básicas
                        if (!username || username.length < 3) {
                            throw new Error('Username debe tener al menos 3 caracteres');
                        }
                        
                        if (!email || !email.includes('@')) {
                            throw new Error('Email no válido');
                        }
                        
                        if (!password || password.length < 6) {
                            throw new Error('Password debe tener al menos 6 caracteres');
                        }

                        // Verificar si ya existe
                        const existingUser = await User.findOne({ 
                            $or: [
                                { username: username },
                                { email: email }
                            ]
                        });

                        if (existingUser) {
                            if (existingUser.username === username) {
                                throw new Error(`Ya existe un usuario con el username "${username}"`);
                            }
                            if (existingUser.email === email) {
                                throw new Error(`Ya existe un usuario con el email "${email}"`);
                            }
                        }

                        // Hashear contraseña
                        const salt = await bcrypt.genSalt(12);
                        const hashedPassword = await bcrypt.hash(password, salt);

                        // Crear admin
                        const admin = await User.create({
                            username: username,
                            email: email,
                            password: hashedPassword,
                            role: ROLES.ADMIN,
                            isActive: true,
                            isBanned: false,
                            avatar: 'avatar1',
                            moderationHistory: [{
                                action: 'role_change',
                                reason: 'Usuario administrador creado',
                                date: new Date(),
                                details: 'Creado mediante script create-admin.js'
                            }]
                        });

                        console.log('\n Usuario administrador creado exitosamente:');
                        console.log(`   ID: ${admin._id}`);
                        console.log(`   Username: ${admin.username}`);
                        console.log(`   Email: ${admin.email}`);
                        console.log(`   Rol: ${admin.role}`);
                        console.log('\n  IMPORTANTE: Guarda estas credenciales en un lugar seguro');
                        
                        resolve();
                        
                    } catch (error) {
                        console.error(' Error creando administrador:', error.message);
                        reject(error);
                    }
                });
            });
        });
    });
}

// Función alternativa: crear admin con datos hardcodeados
async function createQuickAdmin() {
    try {
        await mongoose.connect(config.mongodb.uri);
        
        const adminData = {
            username: 'admin',
            email: 'admin@cometacine.com',
            password: 'admin123' // ¡CAMBIAR DESPUÉS!
        };

        // Verificar si ya existe
        const existing = await User.findOne({ 
            $or: [
                { username: adminData.username },
                { email: adminData.email }
            ]
        });

        if (existing) {
            console.log(' Ya existe un usuario con ese username o email');
            return;
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(adminData.password, salt);

        const admin = await User.create({
            username: adminData.username,
            email: adminData.email,
            password: hashedPassword,
            role: ROLES.ADMIN,
            isActive: true,
            isBanned: false
        });

        console.log(' Admin creado:');
        console.log(`   Username: ${admin.username}`);
        console.log(`   Password: ${adminData.password}`);
        console.log('  ¡CAMBIA LA CONTRASEÑA!');
        
    } finally {
        await mongoose.connection.close();
    }
}

// Ejecutar según argumentos
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--quick')) {
        createQuickAdmin().then(() => process.exit(0)).catch(e => {
            console.error(e);
            process.exit(1);
        });
    } else {
        createAdmin().then(() => process.exit(0)).catch(e => {
            console.error(e);
            process.exit(1);
        });
    }
}

module.exports = { createAdmin, createQuickAdmin };