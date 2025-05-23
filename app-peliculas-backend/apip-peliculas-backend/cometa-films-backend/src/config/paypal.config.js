// src/config/paypal.config.js
const axios = require('axios');

// Función para obtener un token de acceso OAuth 2.0
async function getAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!clientId || !clientSecret) {
        throw new Error('Credenciales de PayPal no configuradas correctamente');
    }

    console.log('Obteniendo token de acceso PayPal en modo:', isProduction ? 'Producción' : 'Sandbox');

    // URL base según entorno
    const baseURL = isProduction
        ? 'https://api-m.paypal.com'
        : 'https://api-m.sandbox.paypal.com';

    try {
        // Solicitar el token usando credenciales
        const response = await axios({
            method: 'post',
            url: `${baseURL}/v1/oauth2/token`,
            headers: {
                'Accept': 'application/json',
                'Accept-Language': 'en_US',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            auth: {
                username: clientId,
                password: clientSecret
            },
            data: 'grant_type=client_credentials'
        });

        return {
            accessToken: response.data.access_token,
            baseURL: baseURL
        };
    } catch (error) {
        console.error('Error al obtener token de PayPal:', error.response ? error.response.data : error.message);
        throw error;
    }
}

// Función para crear el cliente de API con un token
async function createPayPalClient() {
    try {
        const { accessToken, baseURL } = await getAccessToken();

        // Crear cliente axios con el token
        const client = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            }
        });

        return client;
    } catch (error) {
        console.error('Error al crear cliente PayPal:', error);
        throw error;
    }
}

module.exports = { createPayPalClient };