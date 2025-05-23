#!/bin/bash
echo "🔄 Actualizando Cometa Films..."

# Hacer backup del .env actual
cp .env .env.backup 2>/dev/null || echo "⚠️  No hay .env configurado"

# Hacer pull de los cambios
echo "📥 Descargando cambios desde GitHub..."
git pull origin main

# Restaurar .env si existe backup
if [ -f .env.backup ]; then
    echo "🔧 Restaurando configuración..."
    cp .env.backup .env
    rm .env.backup
else
    echo "⚠️  IMPORTANTE: Configura tu .env antes de continuar"
    echo "   cp .env-plantilla .env"
    echo "   nano .env"
    exit 1
fi

# Parar contenedores
echo "⏹️  Parando servicios..."
docker-compose down

# Reconstruir y levantar
echo "🔨 Reconstruyendo servicios..."
docker-compose build --no-cache

echo "🚀 Iniciando servicios..."
docker-compose up -d

# Verificar estado
echo "✅ Verificando estado..."
sleep 10
docker ps

echo "🎉 ¡Actualización completada!"
echo "🌐 Frontend: http://$(curl -s ifconfig.me || echo 'tu-ip-aqui')"
echo "🔌 Backend:  http://$(curl -s ifconfig.me || echo 'tu-ip-aqui'):3000"
