
require('dotenv').config();
const mongoose = require('mongoose');
const { ROLES } = require('../config/roles.config');
const config = require('../config/config');

async function migrateUsers() {
    try {
        console.log('🚀 Iniciando migración de usuarios...');
        
        // Conectar a la base de datos
        await mongoose.connect(config.mongodb.uri);
        console.log('✅ Conectado a MongoDB');

        // IMPORTANTE: Usar la conexión directa de MongoDB, NO Mongoose
        // Esto evita que Mongoose aplique valores por defecto
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // PASO 1: Contar todos los usuarios
        const totalUsers = await usersCollection.countDocuments({});
        console.log(`📊 Total de usuarios en la base de datos: ${totalUsers}`);

        if (totalUsers === 0) {
            console.log('❌ No hay usuarios en la base de datos');
            return;
        }

        // PASO 2: Buscar usuarios SIN el campo role usando MongoDB directo
        const usersWithoutRole = await usersCollection.find({
            role: { $exists: false }
        }).toArray();

        console.log(`🔍 Usuarios SIN campo role: ${usersWithoutRole.length}`);
        
        // PASO 3: Buscar usuarios con otros campos faltantes
        const usersWithoutOtherFields = await usersCollection.find({
            $or: [
                { isActive: { $exists: false } },
                { isBanned: { $exists: false } },
                { moderationHistory: { $exists: false } }
            ]
        }).toArray();

        console.log(`🔍 Usuarios con otros campos faltantes: ${usersWithoutOtherFields.length}`);

        // Combinar usuarios que necesitan migración
        const allUsersNeedingMigration = new Set();
        
        usersWithoutRole.forEach(user => allUsersNeedingMigration.add(user._id.toString()));
        usersWithoutOtherFields.forEach(user => allUsersNeedingMigration.add(user._id.toString()));

        const totalNeedingMigration = allUsersNeedingMigration.size;
        console.log(`🔍 TOTAL usuarios que necesitan migración: ${totalNeedingMigration}`);

        if (totalNeedingMigration === 0) {
            console.log('✅ Todos los usuarios ya están migrados');
            
            // Mostrar estadísticas actuales
            const currentStats = await usersCollection.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } }
            ]).toArray();
            
            console.log('\n📈 Estadísticas actuales de roles:');
            currentStats.forEach(stat => {
                console.log(`   ${stat._id || 'SIN_CAMPO_ROLE'}: ${stat.count} usuarios`);
            });
            return;
        }

        // PASO 4: Mostrar algunos ejemplos REALES
        console.log('\n📋 Usuarios que necesitan migración (usando MongoDB directo):');
        for (const user of usersWithoutRole.slice(0, 5)) {
            console.log(`   - ${user.username}: role=${user.role || 'NO_EXISTE'}, isPremium=${user.isPremium}`);
        }

        // PASO 5: Confirmar antes de proceder
        console.log(`\n⚠️  Se van a actualizar ${totalNeedingMigration} usuarios`);
        console.log('⏳ Procediendo en 3 segundos...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // PASO 6: Migrar usando MongoDB directo (más eficiente)
        let migrated = 0;
        let errors = 0;

        // Migrar usuarios sin role
        if (usersWithoutRole.length > 0) {
            console.log(`\n🔄 Actualizando ${usersWithoutRole.length} usuarios sin role...`);
            
            for (const user of usersWithoutRole) {
                try {
                    const newRole = user.isPremium ? ROLES.PREMIUM : ROLES.USER;
                    
                    const updateResult = await usersCollection.updateOne(
                        { _id: user._id },
                        { 
                            $set: { 
                                role: newRole,
                                isActive: true,
                                isBanned: false,
                                banReason: null,
                                bannedAt: null,
                                bannedBy: null,
                                banExpiresAt: null,
                                moderationHistory: []
                            }
                        }
                    );

                    if (updateResult.modifiedCount > 0) {
                        migrated++;
                        console.log(`   ✅ ${user.username}: role=${newRole} (isPremium: ${user.isPremium})`);
                    }
                } catch (error) {
                    errors++;
                    console.error(`   ❌ Error con ${user.username}:`, error.message);
                }
            }
        }

        // Migrar usuarios con otros campos faltantes
        const usersOnlyMissingOtherFields = usersWithoutOtherFields.filter(user => 
            user.role !== undefined // Ya tienen role pero les faltan otros campos
        );

        if (usersOnlyMissingOtherFields.length > 0) {
            console.log(`\n🔄 Actualizando ${usersOnlyMissingOtherFields.length} usuarios con campos faltantes...`);
            
            for (const user of usersOnlyMissingOtherFields) {
                try {
                    const fieldsToUpdate = {};
                    
                    if (user.isActive === undefined) fieldsToUpdate.isActive = true;
                    if (user.isBanned === undefined) fieldsToUpdate.isBanned = false;
                    if (user.banReason === undefined) fieldsToUpdate.banReason = null;
                    if (user.bannedAt === undefined) fieldsToUpdate.bannedAt = null;
                    if (user.bannedBy === undefined) fieldsToUpdate.bannedBy = null;
                    if (user.banExpiresAt === undefined) fieldsToUpdate.banExpiresAt = null;
                    if (!user.moderationHistory) fieldsToUpdate.moderationHistory = [];

                    if (Object.keys(fieldsToUpdate).length > 0) {
                        const updateResult = await usersCollection.updateOne(
                            { _id: user._id },
                            { $set: fieldsToUpdate }
                        );

                        if (updateResult.modifiedCount > 0) {
                            console.log(`   ✅ ${user.username}: campos adicionales actualizados`);
                        }
                    }
                } catch (error) {
                    errors++;
                    console.error(`   ❌ Error con ${user.username}:`, error.message);
                }
            }
        }

        // PASO 7: Resumen final
        console.log(`\n🎉 MIGRACIÓN COMPLETADA`);
        console.log(`   ✅ Usuarios actualizados: ${migrated}`);
        console.log(`   ❌ Errores: ${errors}`);

        // PASO 8: Estadísticas finales usando MongoDB directo
        const finalStats = await usersCollection.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } }
        ]).toArray();

        console.log('\n📈 ESTADÍSTICAS FINALES DE ROLES:');
        finalStats.forEach(stat => {
            const roleName = stat._id || 'SIN_CAMPO_ROLE';
            console.log(`   ${roleName}: ${stat.count} usuarios`);
        });

        // PASO 9: Verificación final
        const stillWithoutRole = await usersCollection.countDocuments({
            role: { $exists: false }
        });

        if (stillWithoutRole > 0) {
            console.log(`\n⚠️  ADVERTENCIA: ${stillWithoutRole} usuarios aún sin role`);
        } else {
            console.log('\n✅ TODOS los usuarios tienen campo role');
        }

        // Verificar administradores
        const adminCount = await usersCollection.countDocuments({ role: ROLES.ADMIN });
        console.log(`\n👑 Administradores en el sistema: ${adminCount}`);

    } catch (error) {
        console.error('💥 ERROR CRÍTICO en la migración:', error);
        throw error;
    }
}

// Función principal
async function main() {
    try {
        await migrateUsers();
        console.log('\n🏁 Proceso completado exitosamente');
    } catch (error) {
        console.error('\n💥 Error en el proceso principal:', error);
        process.exit(1);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('🔌 Conexión a MongoDB cerrada');
        }
        process.exit(0);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = { migrateUsers };