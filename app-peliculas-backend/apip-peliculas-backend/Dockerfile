FROM node:18

# Crear directorio de la aplicación
WORKDIR /usr/src/app

# Copiar archivos de dependencias DESDE LA SUBCARPETA
COPY cometa-films-backend/package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente DESDE LA SUBCARPETA
COPY cometa-films-backend/ .

# Exponer puerto
EXPOSE 3000

# Comando para iniciar la aplicación con la ruta correcta
CMD ["node", "src/server.js"]  

