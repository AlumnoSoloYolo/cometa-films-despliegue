🎬 Cometa Films - Aplicación de Películas
Aplicación web full-stack para gestión de películas con características sociales, desarrollada con Angular y Node.js.
🚀 Características
✅ Frontend: Angular con diseño responsive
✅ Backend: Node.js con Express y MongoDB
✅ Socket.IO: Notificaciones en tiempo real
✅ Autenticación: JWT con sistema de usuarios
✅ Pagos: Integración con PayPal para cuentas premium
✅ API Externa: TMDB para información de películas
✅ Características Sociales: Seguir usuarios, comentarios, listas personalizadas, reseñas, etc…
✅ Docker: Despliegue completo con docker-compose
📋 Requisitos Previos
Docker y Docker Compose instalados
Cuenta MongoDB (local o Atlas)
API Key de TMDB (themoviedb.org)
Cuenta PayPal Developer (opcional, para pagos)
Servidor con puertos 80 y 3000 abiertos
🛠️ Instalación y Despliegue
1. Clonar el repositorio

git clone git@github.com:AlumnoSoloYolo/cometa-films-despliegue.git
cd proyecto-final-forDocker
2. Configurar variables de entorno

# Copiar plantilla de configuración
cp .env-plantilla .env

# Editar con tus credenciales
vim .env
Variables requeridas:
JWT_SECRET: Clave secreta para JWT (genera una segura)
MONGODB_URI: URI de tu base de datos MongoDB
TMDB_API_KEY: API key de The Movie Database
FRONTEND_URL: URL pública de tu servidor (ej: http://tu-ip-publica)
PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET: Credenciales de PayPal
3. Desplegar con Docker

# Construir y ejecutar
docker-compose up --build -d

# Verificar que los contenedores estén corriendo
docker ps
4. Verificar funcionamiento
Frontend: http://tu-servidor
Backend API: http://tu-servidor:3000
Socket.IO: Conecta automáticamente
🔧 Configuración de Servidor (AWS EC2)
Security Groups requeridos:
HTTP        | Puerto 80   | 0.0.0.0/0
Custom TCP  | Puerto 3000 | 0.0.0.0/0
SSH         | Puerto 22   | Tu IP
Instalación de Docker en Ubuntu:

# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Reiniciar sesión para aplicar permisos
📂 Estructura del Proyecto
proyecto-final-forDocker/
├── docker-compose.yml          # Configuración de contenedores
├── .env-plantilla             # Plantilla de variables de entorno
├── README.md                  # Esta documentación
├── app-peliculas-frontend/    # Frontend Angular
│   └── app-frontend-cometafilms/
│       ├── dockerfile         # Configuración Docker frontend
│       ├── nginx.conf         # Configuración Nginx
│       └── src/               # Código fuente Angular
└── app-peliculas-backend/     # Backend Node.js
    └── apip-peliculas-backend/
        └── cometa-films-backend/
            ├── Dockerfile     # Configuración Docker backend
            └── src/           # Código fuente Node.js
🔍 Troubleshooting
Los contenedores no se inician:

# Ver logs detallados
docker-compose logs

# Reconstruir desde cero
docker-compose down
docker system prune -f
docker-compose up --build -d
Socket.IO no conecta:
Verificar que el puerto 3000 esté abierto en el firewall
Comprobar que FRONTEND_URL en .env sea correcta
Ver logs: docker logs cometa-backend -f
Error de base de datos:
Verificar MONGODB_URI en .env
Comprobar conectividad a MongoDB
Ver logs del backend para detalles específicos
🛡️ Seguridad
No subir archivo .env al repositorio (incluido en .gitignore)
Usar JWT_SECRET fuerte (mínimo 32 caracteres aleatorios)
Configurar CORS correctamente para producción
Usar HTTPS en producción (certificado SSL)
🧪 Testing

# Probar conectividad del backend
curl http://localhost:3000

# Probar frontend
curl http://localhost:80

# Probar Socket.IO
curl http://localhost:3000/socket.io/
📝 Comandos Útiles

# Ver logs en tiempo real
docker-compose logs -f

# Reiniciar servicios
docker-compose restart

# Parar todos los servicios
docker-compose down

# Reconstruir un servicio específico
docker-compose build frontend
docker-compose up -d frontend

# Acceder al contenedor del backend
docker exec -it cometa-backend bash

# Ver estadísticas de uso
docker stats
🤝 Contribución
Fork el proyecto
Crea una rama para tu feature (git checkout -b feature/[nombre-feature])
Commit tus cambios (git commit -m 'Add some [nombre-feature]')
Push a la rama (git push origin feature/[nombre-feature])
Abre un Pull Request
📄 Licencia
Este proyecto está bajo la Licencia MIT - ver el archivo LICENSE para detalles.
🙋‍♂️ Soporte
Si tienes problemas:
Revisa la sección de Troubleshooting
Verifica los logs con docker-compose logs
Abre un issue en GitHub con detalles del error

¡Disfruta CometaFilms! 🎬✨

