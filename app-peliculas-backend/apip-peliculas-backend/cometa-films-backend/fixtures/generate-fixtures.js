#!/usr/bin/env node

/**
 * 🎬 COMETACINE - GENERADOR DE FIXTURES CON NEWMAN
 * 
 * Este script utiliza Newman para ejecutar colecciones de Postman
 * y generar datos de prueba realistas para la aplicación de cine hispanohablante.
 */

const newman = require('newman');
const fs = require('fs');
const path = require('path');

// ========================================
// CONFIGURACIÓN
// ========================================

const CONFIG = {
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    environment: {
        name: 'CometaCine Fixtures Environment',
        values: [
            { key: 'base_url', value: process.env.BASE_URL || 'http://localhost:3000' },
        ]
    },
    
    // Perfiles de usuarios cinéfilos hispanohablantes
    userProfiles: [
        {
            username: 'almodovar_eterno',
            email: 'pedro@lamancha.es',
            password: 'password123',
            avatar: 'avatar1',
            biografia: '🌹 "El cine es mentira a 24 fotogramas por segundo" - Almodóvar es mi dios. Viva el cine español.',
            perfilPrivado: false
        },
        {
            username: 'nouvelle_vague_madrid',
            email: 'cahiers@cinema.es',
            password: 'password123', 
            avatar: 'avatar2',
            biografia: '🎭 Entre Godard y Buñuel encontré mi cinefilia. El cine francés y español son mi pasión.',
            perfilPrivado: false
        },
        {
            username: 'tarkovsky_sevilla',
            email: 'tiempo@esculpido.ru',
            password: 'password123',
            avatar: 'avatar3',
            biografia: '⏰ "El tiempo es la sustancia de la que estoy hecho" - Tarkovsky. Nostalghia me cambió la vida.',
            perfilPrivado: true
        },
        {
            username: 'cine_latinoamericano',
            email: 'realismo@magico.com',
            password: 'password123',
            avatar: 'avatar4', 
            biografia: '🌎 Iñárritu, Del Toro, Cuarón. El Nuevo Cine Mexicano y toda Latinoamérica en mis venas.',
            perfilPrivado: false
        },
        {
            username: 'criterion_barcelona',
            email: 'coleccion@criterion.cat',
            password: 'password123',
            avatar: 'avatar5',
            biografia: '📼 Coleccionista obsesivo de Criterion. Si no está restaurado en 4K, no merece mi tiempo.',
            perfilPrivado: false
        },
        {
            username: 'bergman_bilbao',
            email: 'silencio@persona.se',
            password: 'password123',
            avatar: 'avatar6',
            biografia: '🎭 "A través de un cristal, oscuramente" vemos el rostro verdadero del cine. Bergman es eterno.',
            perfilPrivado: true
        },
        {
            username: 'cine_independiente_mx',
            email: 'indie@mexico.com',
            password: 'password123',
            avatar: 'avatar7',
            biografia: '🇲🇽 Reygadas, Escalante, Franco. El cine mexicano independiente es puro arte contemporáneo.',
            perfilPrivado: false
        },
        {
            username: 'lynch_valencia',
            email: 'terciopelo@azul.com',
            password: 'password123',
            avatar: 'avatar8',
            biografia: '☕ "Qué buen café, joder." Twin Peaks no es solo TV, es una forma de entender la realidad.',
            perfilPrivado: false
        },
        {
            username: 'kieslowski_madrid',
            email: 'tres@colores.fr', 
            password: 'password123',
            avatar: 'avatar1',
            biografia: '🔵⚪🔴 Azul, Blanco, Rojo. La trilogía perfecta no exis... ah sí, que sí existe.',
            perfilPrivado: false
        },
        {
            username: 'bunuel_zaragoza',
            email: 'andaluz@surrealista.es',
            password: 'password123',
            avatar: 'avatar2',
            biografia: '🐜 "Gracias a Dios soy ateo." Buñuel, el genio aragonés que conquistó el surrealismo mundial.',
            perfilPrivado: false
        },
        {
            username: 'erice_salamanca',
            email: 'espiritu@colmena.es',
            password: 'password123',
            avatar: 'avatar3',
            biografia: '🐝 El espíritu de la colmena sigue vivo. Erice es poesía pura en celuloide.',
            perfilPrivado: true
        },
        {
            username: 'nouvelle_vague_arg',
            email: 'buenos@aires.com.ar',
            password: 'password123',
            avatar: 'avatar4',
            biografia: '🇦🇷 Lisandro Alonso, Lucrecia Martel. El nuevo cine argentino es pura contemplación.',
            perfilPrivado: false
        }
    ],

    // Películas de cine hispanohablante, arte y autor (IDs reales de TMDB)
    curatedMovies: {
        // Cine Español Clásico y Contemporáneo
        cineEspanol: [
            19771, // El espíritu de la colmena
            10294, // Viridiana
            19485, // Todo sobre mi madre
            392, // Hable con ella
            13810, // El laberinto del fauno
            19486, // Mujeres al borde de un ataque de nervios
            47971, // Celda 211
            11324, // Mar adentro
            19488, // Átame
            393 // La mala educación
        ],
        
        // Nuevo Cine Mexicano
        cineMexicano: [
            1585, // Amores perros
            240, // 21 gramos
            4935, // Babel
            11224, // Y tu mamá también
            508442, // Roma
            286217, // Birdman
            13485, // Los amantes del círculo polar
            466420, // The Shape of Water
            400535, // Hereditary (Ari Aster admirado en México)
            120467 // The Grand Budapest Hotel
        ],
        
        // Cine Latinoamericano
        cineLatino: [
            278154, // No
            18284, // El secreto de sus ojos
            246460, // Una mujer fantástica
            340102, // The Handmaiden
            508947, // The Lighthouse
            19404, // Dogville
            280, // Cidade de Deus
            4944, // Diarios de motocicleta
            340666, // Aquarius
            340485 // Neruda
        ],
        
        // Cine de Autor Europeo
        cineAutorEuropeo: [
            389, // 12 Angry Men
            19404, // Dogville
            207703, // The Square
            46738, // Nymphomaniac
            62, // Blade Runner
            27205, // Inception
            346, // Seven Samurai
            424, // The Shawshank Redemption
            637, // La Dolce Vita
            769 // Goodfellas
        ],
        
        // Horror/Thriller Artístico
        horrorArtistico: [
            419430, // The Witch
            530385, // Midsommar
            508442, // A Quiet Place
            400535, // Hereditary
            346364, // IT
            1724, // The Cabinet of Dr. Caligari
            539, // Psycho
            694, // The Shining
            1930, // The Exorcist
            348 // Alien
        ],
        
        // Ciencia Ficción Cerebral
        scifiCerebral: [
            62, // Blade Runner
            78, // Interstellar
            27205, // Inception
            2062, // Solaris (1972)
            11, // Star Wars
            1726, // Under the Skin
            120, // The Lord of the Rings
            1893, // Alphaville
            152601, // Her
            280 // Cidade de Deus
        ],
        
        // Documentales
        documentales: [
            37165, // The Act of Killing
            333484, // Free Solo
            76170, // The Master
            19995, // Avatar
            120, // The Lord of the Rings
            155, // The Dark Knight
            680, // Pulp Fiction
            13, // Forrest Gump
            122, // The Lord of the Rings: The Two Towers
            121 // The Lord of the Rings: The Return of the King
        ],
        
        // Cine Clásico Universal
        cineClasico: [
            346, // Seven Samurai
            389, // 12 Angry Men
            424, // The Shawshank Redemption
            278, // The Godfather
            637, // La Dolce Vita
            539, // Psycho
            19, // 8½
            38, // Eternal Sunshine of the Spotless Mind
            105, // Back to the Future
            769 // Goodfellas
        ]
    }
};

// ========================================
// COLECCIÓN DE POSTMAN PARA FIXTURES
// ========================================

const FIXTURES_COLLECTION = {
    info: {
        name: 'CometaCine - Generador de Fixtures Hispanohablante',
        description: 'Generador automático de datos de prueba para CometaCine enfocado en cine hispanohablante'
    },
    item: []
};

// ========================================
// FUNCIONES DE GENERACIÓN
// ========================================

/**
 * Genera requests para crear usuarios
 */
function generateUserRequests() {
    const requests = [];
    
    CONFIG.userProfiles.forEach((profile, index) => {
        // Request de registro
        requests.push({
            name: `Crear Usuario ${index + 1}: ${profile.username}`,
            event: [
                {
                    listen: 'test',
                    script: {
                        exec: [
                            `pm.test('Usuario ${profile.username} creado', () => {`,
                            '    pm.expect(pm.response.code).to.equal(201);',
                            '});',
                            '',
                            'if (pm.response.code === 201) {',
                            '    const response = pm.response.json();',
                            `    pm.environment.set('user_${index}_id', response.user.id);`,
                            `    pm.environment.set('user_${index}_token', response.token);`,
                            `    pm.environment.set('user_${index}_username', '${profile.username}');`,
                            '    console.log(`✅ Usuario creado: ${response.user.username}`);',
                            '}'
                        ]
                    }
                }
            ],
            request: {
                method: 'POST',
                header: [
                    { key: 'Content-Type', value: 'application/json' }
                ],
                body: {
                    mode: 'raw',
                    raw: JSON.stringify(profile)
                },
                url: {
                    raw: '{{base_url}}/auth/register',
                    host: ['{{base_url}}'],
                    path: ['auth', 'register']
                }
            }
        });

        // Request para actualizar perfil con biografía
        requests.push({
            name: `Actualizar Perfil ${profile.username}`,
            event: [
                {
                    listen: 'test',
                    script: {
                        exec: [
                            `pm.test('Perfil ${profile.username} actualizado', () => {`,
                            '    pm.expect(pm.response.code).to.equal(200);',
                            '});'
                        ]
                    }
                }
            ],
            request: {
                method: 'PUT',
                header: [
                    { key: 'Content-Type', value: 'application/json' },
                    { key: 'Authorization', value: `Bearer {{user_${index}_token}}` }
                ],
                body: {
                    mode: 'raw',
                    raw: JSON.stringify({
                        biografia: profile.biografia,
                        perfilPrivado: profile.perfilPrivado
                    })
                },
                url: {
                    raw: '{{base_url}}/user-movies/profile/update',
                    host: ['{{base_url}}'],
                    path: ['user-movies', 'profile', 'update']
                }
            }
        });
    });
    
    return requests;
}

/**
 * Genera requests para seguimientos entre usuarios
 */
function generateFollowRequests() {
    const requests = [];
    const userCount = CONFIG.userProfiles.length;
    
    // Crear una red de seguimientos realista
    for (let i = 0; i < userCount; i++) {
        const followersCount = Math.floor(Math.random() * 5) + 2; // Entre 2 y 6 seguimientos
        const followedUsers = new Set();
        
        for (let j = 0; j < followersCount; j++) {
            let targetUser;
            do {
                targetUser = Math.floor(Math.random() * userCount);
            } while (targetUser === i || followedUsers.has(targetUser));
            
            followedUsers.add(targetUser);
            
            requests.push({
                name: `${CONFIG.userProfiles[i].username} sigue a ${CONFIG.userProfiles[targetUser].username}`,
                event: [
                    {
                        listen: 'test',
                        script: {
                            exec: [
                                'pm.test("Seguimiento exitoso", () => {',
                                '    pm.expect([200, 201, 400]).to.include(pm.response.code);',
                                '});'
                            ]
                        }
                    }
                ],
                request: {
                    method: 'POST',
                    header: [
                        { key: 'Authorization', value: `Bearer {{user_${i}_token}}` }
                    ],
                    url: {
                        raw: `{{base_url}}/social/follow/{{user_${targetUser}_id}}`,
                        host: ['{{base_url}}'],
                        path: ['social', 'follow', `{{user_${targetUser}_id}}`]
                    }
                }
            });
        }
    }
    
    return requests;
}

/**
 * Genera requests para añadir películas a watchlist y watched
 */
function generateMovieRequests() {
    const requests = [];
    
    CONFIG.userProfiles.forEach((profile, userIndex) => {
        // Determinar preferencias según el username y personalidad cinéfila
        let preferredGenres = [];
        if (profile.username.includes('almodovar')) preferredGenres = ['cineEspanol', 'cineLatino'];
        else if (profile.username.includes('nouvelle_vague')) preferredGenres = ['cineAutorEuropeo', 'cineClasico'];
        else if (profile.username.includes('tarkovsky')) preferredGenres = ['cineAutorEuropeo', 'scifiCerebral'];
        else if (profile.username.includes('latinoamericano')) preferredGenres = ['cineMexicano', 'cineLatino'];
        else if (profile.username.includes('criterion')) preferredGenres = ['cineClasico', 'cineAutorEuropeo'];
        else if (profile.username.includes('bergman')) preferredGenres = ['cineAutorEuropeo', 'cineClasico'];
        else if (profile.username.includes('independiente')) preferredGenres = ['cineMexicano', 'cineLatino'];
        else if (profile.username.includes('lynch')) preferredGenres = ['horrorArtistico', 'scifiCerebral'];
        else if (profile.username.includes('kieslowski')) preferredGenres = ['cineAutorEuropeo', 'cineClasico'];
        else if (profile.username.includes('bunuel')) preferredGenres = ['cineEspanol', 'cineAutorEuropeo'];
        else if (profile.username.includes('erice')) preferredGenres = ['cineEspanol', 'documentales'];
        else preferredGenres = ['cineEspanol', 'cineMexicano', 'cineLatino']; // Mix para usuarios generales
        
        // Añadir películas vistas
        preferredGenres.forEach(genre => {
            const movies = CONFIG.curatedMovies[genre] || [];
            const moviesToWatch = movies.slice(0, 3); // 3 películas por género
            
            moviesToWatch.forEach(movieId => {
                requests.push({
                    name: `${profile.username} - Marcar película ${movieId} como vista`,
                    event: [
                        {
                            listen: 'test',
                            script: {
                                exec: [
                                    'pm.test("Película marcada como vista", () => {',
                                    '    pm.expect([200, 201, 400]).to.include(pm.response.code);',
                                    '});'
                                ]
                            }
                        }
                    ],
                    request: {
                        method: 'POST',
                        header: [
                            { key: 'Content-Type', value: 'application/json' },
                            { key: 'Authorization', value: `Bearer {{user_${userIndex}_token}}` }
                        ],
                        body: {
                            mode: 'raw',
                            raw: JSON.stringify({ movieId: movieId.toString() })
                        },
                        url: {
                            raw: '{{base_url}}/user-movies/watched',
                            host: ['{{base_url}}'],
                            path: ['user-movies', 'watched']
                        }
                    }
                });
            });
        });
        
        // Añadir películas pendientes (diferentes géneros para diversidad)
        const otherGenres = Object.keys(CONFIG.curatedMovies).filter(g => !preferredGenres.includes(g));
        const randomGenre = otherGenres[Math.floor(Math.random() * otherGenres.length)];
        const pendingMovies = CONFIG.curatedMovies[randomGenre]?.slice(0, 2) || [];
        
        pendingMovies.forEach(movieId => {
            requests.push({
                name: `${profile.username} - Añadir película ${movieId} a pendientes`,
                event: [
                    {
                        listen: 'test',
                        script: {
                            exec: [
                                'pm.test("Película añadida a pendientes", () => {',
                                '    pm.expect([200, 201, 400]).to.include(pm.response.code);',
                                '});'
                            ]
                        }
                    }
                ],
                request: {
                    method: 'POST',
                    header: [
                        { key: 'Content-Type', value: 'application/json' },
                        { key: 'Authorization', value: `Bearer {{user_${userIndex}_token}}` }
                    ],
                    body: {
                        mode: 'raw',
                        raw: JSON.stringify({ movieId: movieId.toString() })
                    },
                    url: {
                        raw: '{{base_url}}/user-movies/watchlist',
                        host: ['{{base_url}}'],
                        path: ['user-movies', 'watchlist']
                    }
                }
            });
        });
    });
    
    return requests;
}

/**
 * Genera requests para crear reseñas en español
 */
function generateReviewRequests() {
    const requests = [];
    
    const reviewTemplates = {
        cinefilo_positivo: [
            "Una obra maestra del séptimo arte. La fotografía es sublime y cada plano es poesía visual.",
            "Almodóvar vuelve a demostrar por qué es el genio del cine español contemporáneo. Pura genialidad.",
            "La narrativa visual de esta película eleva el cine a la categoría de arte puro. Imprescindible.",
            "Una película que exige múltiples visionados. Cada vez descubres nuevas capas de significado.",
            "El uso del color y la composición visual recuerda al mejor Tarkovsky. Una experiencia estética única.",
            "Una reflexión poética sobre la memoria y el tiempo. El cine como literatura visual.",
            "La dirección de fotografía convierte cada escena en un cuadro digno de museo.",
            "Bergman se sentiría orgulloso. Una exploración profunda del alma humana a través del cine.",
            "Interpretaciones magistrales que elevan el texto a categoría de arte dramático.",
            "La banda sonora complementa perfectamente la narrativa visual. Cine total y absoluto."
        ],
        cinefilo_analitico: [
            "Interesante propuesta narrativa, aunque el ritmo se resiente en el segundo acto.",
            "La estética es valiente, pero la historia se queda algo superficial para mi gusto.",
            "Aprecio la experimentación formal, aunque no todos los riesgos narrativos funcionan.",
            "Técnicamente impecable, pero le falta el alma de sus trabajos anteriores.",
            "La influencia de la Nouvelle Vague es evidente, quizás demasiado obvia.",
            "Funciona mejor como ejercicio de estilo que como narrativa coherente.",
            "El tercer acto no está a la altura de la brillante premisa inicial.",
            "Visualmente deslumbrante, pero narrativamente confusa. Estilo sobre sustancia.",
            "Un trabajo honesto dentro de las limitaciones del cine independiente español.",
            "La fotografía salva una historia que se pierde en sus propias pretensiones."
        ],
        cinefilo_negativo: [
            "Pretencioso sin ser profundo. El emperador va desnudo y nadie se atreve a decirlo.",
            "Una decepción viniendo de un director de este calibre. Autocomplaciente y vacía.",
            "Puro postureo cinéfilo disfrazado de arte. Toda forma, cero contenido emocional.",
            "Dos horas y media de mi vida que no recuperaré. Ni el final justifica el tostón.",
            "La crítica especializada la alaba porque es 'arte', pero el arte también debe emocionar.",
            "Una masturbación intelectual disfrazada de cine de autor. Insoportable.",
            "El simbolismo es tan obvio que resulta insultante para cualquier espectador inteligente.",
            "Lenta, pretenciosa y aburrida. No todo lo incomprensible es necesariamente profundo.",
            "Una película hecha para impresionar en festivales, no para ser disfrutada.",
            "Sobrevaloradísima. El cine español puede dar mucho más que esto."
        ],
        cine_espanol_positivo: [
            "El cine español en su máximo esplendor. Almodóvar demuestra una vez más su genialidad.",
            "Víctor Erice consigue capturar la esencia poética del paisaje español como nadie.",
            "Una carta de amor al cine español de los 70. Emotiva y nostálgica.",
            "La fotografia de José Luis Alcaine eleva cada escena a categoría de arte.",
            "Carlos Saura y su danza cinematográfica. Pure Spanish cinema en estado puro.",
            "Buñuel sigue siendo una influencia palpable en el mejor cine español contemporáneo.",
            "La tradición del cine español se fusiona con la modernidad. Brillante.",
            "Un homenaje perfecto al realismo social español. Conmovedor y necesario.",
            "La música de Alberto Iglesias complementa perfectamente la narrativa visual española.",
            "Cine español que no necesita complejos ante ninguna cinematografía mundial."
        ],
        cine_mexicano_positivo: [
            "Iñárritu demuestra una vez más por qué el cine mexicano está en su mejor momento.",
            "La violencia está justificada narrativamente y ejecutada con maestría visual.",
            "Una reflexión profunda sobre la sociedad mexicana contemporánea.",
            "Cuarón construye tensión narrativa como un relojero suizo. Perfección.",
            "El Nuevo Cine Mexicano está en su época dorada y esta película lo confirma.",
            "Una parábola social mexicana tratada con ironía y profundidad intelectual.",
            "La clase social como tema central, abordado con la sutileza del mejor cine de autor.",
            "Del Toro poetiza la fantasía mexicana como nadie más en la actualidad.",
            "México fotografiado como un sueño de realismo mágico cinematográfico.",
            "Melancolía latinoamericana elevada a la categoría de arte universal."
        ],
        cine_latino_positivo: [
            "El cine latinoamericano demuestra su madurez artística y narrativa.",
            "Una reflexión profunda sobre la identidad latinoamericana contemporánea.",
            "El realismo mágico llevado al cine con maestría y sensibilidad.",
            "Narrativa no lineal que respeta la inteligencia del espectador latinoamericano.",
            "Cine comprometido socialmente sin perder calidad artística. Necesario.",
            "La fotografía captura la esencia más profunda del paisaje latinoamericano.",
            "Una obra que dialoga con las tradiciones cinematográficas del continente.",
            "Cine latinoamericano que trasciende fronteras sin perder su identidad.",
            "La música popular latinoamericana integrada magistralmente en la narrativa.",
            "Una celebración del cine independiente latinoamericano y su diversidad."
        ]
    };
    
    CONFIG.userProfiles.forEach((profile, userIndex) => {
        // Cada usuario escribirá entre 3-4 reseñas
        const reviewCount = Math.floor(Math.random() * 2) + 3;
        
        for (let i = 0; i < reviewCount; i++) {
            // Seleccionar una película de sus géneros preferidos
            const allMovies = Object.values(CONFIG.curatedMovies).flat();
            const movieId = allMovies[Math.floor(Math.random() * allMovies.length)];
            
            // Generar rating y comentario coherente según la personalidad del usuario
            const rating = Math.floor(Math.random() * 10) + 1;
            let reviewType;
            
            // Usuarios más "cinéfilos" tienden a ser más críticos y analíticos
            if (profile.username.includes('criterion') || profile.username.includes('bergman') || 
                profile.username.includes('tarkovsky') || profile.username.includes('nouvelle_vague') ||
                profile.username.includes('erice')) {
                // Cinéfilos puristas: más críticos, ratings más diversos
                if (rating >= 8) reviewType = 'cinefilo_positivo';
                else if (rating >= 6) reviewType = 'cinefilo_analitico';
                else reviewType = 'cinefilo_negativo';
            } else if (profile.username.includes('almodovar') || profile.username.includes('bunuel')) {
                // Fans del cine español
                if (rating >= 7) reviewType = 'cine_espanol_positivo';
                else if (rating >= 5) reviewType = 'cinefilo_analitico';
                else reviewType = 'cinefilo_negativo';
            } else if (profile.username.includes('latinoamericano') || profile.username.includes('arg')) {
                // Fans del cine latinoamericano
                if (rating >= 7) reviewType = 'cine_latino_positivo';
                else if (rating >= 5) reviewType = 'cinefilo_analitico';
                else reviewType = 'cinefilo_negativo';
            } else if (profile.username.includes('mexico') || profile.username.includes('mx')) {
                // Fans del cine mexicano
                if (rating >= 7) reviewType = 'cine_mexicano_positivo';
                else if (rating >= 5) reviewType = 'cinefilo_analitico';
                else reviewType = 'cinefilo_negativo';
            } else {
                // Usuarios más generalistas hispanohablantes
                if (rating >= 7) {
                    const positiveTypes = ['cinefilo_positivo', 'cine_espanol_positivo', 'cine_latino_positivo'];
                    reviewType = positiveTypes[Math.floor(Math.random() * positiveTypes.length)];
                } else if (rating >= 5) reviewType = 'cinefilo_analitico';
                else reviewType = 'cinefilo_negativo';
            }
            
            const comments = reviewTemplates[reviewType];
            const comment = comments[Math.floor(Math.random() * comments.length)];
            
            requests.push({
                name: `${profile.username} - Reseña para película ${movieId}`,
                event: [
                    {
                        listen: 'test',
                        script: {
                            exec: [
                                'pm.test("Reseña creada", () => {',
                                '    pm.expect([200, 201, 400]).to.include(pm.response.code);',
                                '});',
                                '',
                                'if (pm.response.code === 201) {',
                                '    const response = pm.response.json();',
                                `    pm.environment.set('review_${userIndex}_${i}_id', response.review._id);`,
                                '}'
                            ]
                        }
                    }
                ],
                request: {
                    method: 'POST',
                    header: [
                        { key: 'Content-Type', value: 'application/json' },
                        { key: 'Authorization', value: `Bearer {{user_${userIndex}_token}}` }
                    ],
                    body: {
                        mode: 'raw',
                        raw: JSON.stringify({
                            movieId: movieId.toString(),
                            rating: rating,
                            comment: comment
                        })
                    },
                    url: {
                        raw: '{{base_url}}/user-movies/reviews',
                        host: ['{{base_url}}'],
                        path: ['user-movies', 'reviews']
                    }
                }
            });
        }
    });
    
    return requests;
}

/**
 * Genera requests para crear listas de películas en español
 */
function generateListRequests() {
    const requests = [];
    
    const listTemplates = [
        { 
            title: "Obras Maestras del Cine Español", 
            description: "Almodóvar, Erice, Buñuel y los genios de nuestro cine", 
            genre: "cineEspanol",
            coverImage: "https://images.unsplash.com/photo-1586899028174-e7098604235b?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Nuevo Cine Mexicano", 
            description: "Los Tres Amigos y la revolución cinematográfica mexicana", 
            genre: "cineMexicano",
            coverImage: "https://images.unsplash.com/photo-1596727147705-61a532a659bd?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Cine Latinoamericano Imprescindible", 
            description: "Desde Argentina hasta México: el mejor cine de nuestro continente", 
            genre: "cineLatino",
            coverImage: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Directores de Autor Europeos", 
            description: "Bergman, Tarkovsky, Kieslowski y los maestros del cine de arte", 
            genre: "cineAutorEuropeo",
            coverImage: "https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Horror Artístico y Experimental", 
            description: "Cuando el miedo se convierte en alta cultura cinematográfica", 
            genre: "horrorArtistico",
            coverImage: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Ciencia Ficción Filosófica", 
            description: "Blade Runner, Solaris y reflexiones sobre el futuro", 
            genre: "scifiCerebral",
            coverImage: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Clásicos Universales", 
            description: "Las películas que definieron el lenguaje cinematográfico mundial", 
            genre: "cineClasico",
            coverImage: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Documentales Reveladores", 
            description: "Cuando la realidad supera a cualquier ficción", 
            genre: "documentales",
            coverImage: "https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Cine Español de los 70", 
            description: "La edad dorada del cine español contemporáneo", 
            genre: "cineEspanol",
            coverImage: "https://images.unsplash.com/photo-1489599134956-5378b4b2b333?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Realismo Mágico Cinematográfico", 
            description: "Del Toro, Iñárritu y la fantasía latinoamericana", 
            genre: "cineMexicano",
            coverImage: "https://images.unsplash.com/photo-1518709268805-4e9042af2ac0?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Cine de Autor Hispanoamericano", 
            description: "Reygadas, Martel, Alonso y la nueva generación", 
            genre: "cineLatino",
            coverImage: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Surrealismo Cinematográfico", 
            description: "Buñuel, Lynch y los maestros del cine onírico", 
            genre: "cineAutorEuropeo",
            coverImage: "https://images.unsplash.com/photo-1489599134956-5378b4b2b333?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Cine Independiente Mexicano", 
            description: "Escalante, Reygadas y la revolución del indie mexicano", 
            genre: "cineMexicano",
            coverImage: "https://images.unsplash.com/photo-1606103781419-75eedab6ba61?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Fotografía Cinematográfica Sublime", 
            description: "Películas donde cada plano es una obra de arte visual", 
            genre: "cineAutorEuropeo",
            coverImage: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Cine Político Latinoamericano", 
            description: "Reflexiones sobre poder y sociedad en nuestro continente", 
            genre: "cineLatino",
            coverImage: "https://images.unsplash.com/photo-1489599134956-5378b4b2b333?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Mujeres Directoras Esenciales", 
            description: "Lucrecia Martel, Icíar Bollaín y las voces femeninas del cine", 
            genre: "cineEspanol",
            coverImage: "https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Cine Underground Español", 
            description: "Desde Iván Zulueta hasta el cine más experimental", 
            genre: "cineEspanol",
            coverImage: "https://images.unsplash.com/photo-1585647347483-22b66260dfff?w=800&h=1200&fit=crop&crop=center"
        },
        { 
            title: "Nouvelle Vague y su Influencia", 
            description: "Godard, Truffaut y su impacto en el cine mundial", 
            genre: "cineAutorEuropeo",
            coverImage: "https://images.unsplash.com/photo-1586899028174-e7098604235b?w=800&h=1200&fit=crop&crop=center"
        }
    ];
    
    CONFIG.userProfiles.forEach((profile, userIndex) => {
        // Cada usuario creará 1-2 listas
        const listCount = Math.floor(Math.random() * 2) + 1;
        
        for (let i = 0; i < listCount; i++) {
            const template = listTemplates[Math.floor(Math.random() * listTemplates.length)];
            const movies = CONFIG.curatedMovies[template.genre] || CONFIG.curatedMovies.cineEspanol;
            const selectedMovies = movies.slice(0, Math.floor(Math.random() * 3) + 2); // 2-4 películas
            
            requests.push({
                name: `${profile.username} - Crear lista: ${template.title}`,
                event: [
                    {
                        listen: 'test',
                        script: {
                            exec: [
                                'pm.test("Lista creada", () => {',
                                '    pm.expect([200, 201, 403]).to.include(pm.response.code);',
                                '});',
                                '',
                                'if (pm.response.code === 201) {',
                                '    const response = pm.response.json();',
                                `    pm.environment.set('list_${userIndex}_${i}_id', response.list._id);`,
                                '}'
                            ]
                        }
                    }
                ],
                request: {
                    method: 'POST',
                    header: [
                        { key: 'Content-Type', value: 'application/json' },
                        { key: 'Authorization', value: `Bearer {{user_${userIndex}_token}}` }
                    ],
                    body: {
                        mode: 'raw',
                        raw: JSON.stringify({
                            title: `${template.title} - ${profile.username}`,
                            description: template.description,
                            isPublic: Math.random() > 0.2, // 80% públicas (más comunidad)
                            coverImage: template.coverImage,
                            movies: selectedMovies.map(id => ({ movieId: id.toString() }))
                        })
                    },
                    url: {
                        raw: '{{base_url}}/movie-lists/lists',
                        host: ['{{base_url}}'],
                        path: ['movie-lists', 'lists']
                    }
                }
            });
        }
    });
    
    return requests;
}

/**
 * Genera requests para comentarios en reseñas en español
 */
function generateCommentRequests() {
    const requests = [];
    
    const commentTemplates = {
        acuerdo: [
            "Totalmente de acuerdo. Una perspectiva muy acertada sobre la película.",
            "Excelente análisis. No había pensado en ese detalle de la puesta en escena.",
            "Coincido completamente. La fotografía es realmente excepcional.",
            "Muy bien explicado. Es exactamente lo que sentí al verla.",
            "Gracias por esta reseña tan detallada. Me ha ayudado a entender mejor la película.",
            "Perfecto análisis. Compartes mi visión sobre esta obra maestra.",
            "Me has hecho ver aspectos que no había notado. Brillante comentario.",
            "Exactamente lo que pensaba. El cine español necesita más reconocimiento así."
        ],
        desacuerdo: [
            "Respeto tu opinión, pero yo la vi de manera completamente diferente.",
            "Interesante perspectiva, aunque no puedo estar más en desacuerdo contigo.",
            "Creo que te has perdido algunos elementos clave de la narrativa.",
            "No comparto tu visión. Para mí fue una experiencia cinematográfica muy diferente.",
            "Entiendo tu punto, pero creo que subestimas el trabajo del director.",
            "Me parece una lectura demasiado superficial de una obra tan compleja.",
            "Discrepo totalmente. Esta película merece mucho más reconocimiento."
        ],
        discusion_tecnica: [
            "¿Notaste el uso del color en la secuencia del segundo acto?",
            "El trabajo de sonido me pareció especialmente brillante en esta.",
            "La influencia de Buñuel es evidente en varias escenas, ¿no crees?",
            "¿Qué opinas sobre la decisión de usar película en lugar de digital?",
            "La edición me recordó mucho al trabajo de los maestros españoles.",
            "El uso de la música popular española fue magistral.",
            "¿Viste las referencias a Erice en los planos de paisaje?"
        ],
        filosofico: [
            "Una reflexión profunda sobre la condición humana y la sociedad española.",
            "El simbolismo es más complejo de lo que parece a primera vista.",
            "¿Crees que el director quería que interpretáramos el final así?",
            "La película funciona en múltiples niveles de lectura cultural.",
            "Cada visionado revela nuevas capas de significado hispanoamericano.",
            "Una metáfora perfecta sobre la memoria histórica española.",
            "El contexto político es fundamental para entender esta obra."
        ],
        cinefilo_friki: [
            "¿Viste la referencia a 'El espíritu de la colmena' en el plano espejo?",
            "La relación de aspecto cambia sutilmente durante la película.",
            "Claramente influenciado por el cine de Víctor Erice.",
            "La paleta de colores recuerda al mejor Almodóvar de los 80.",
            "¿Notaste el homenaje a 'Viridiana' en la secuencia de la cena?",
            "El montaje paralelo es puro Iñárritu en su mejor momento.",
            "Una carta de amor al cine español de la Transición."
        ],
        respuesta_casual: [
            "Me encantó esta película también. Gran elección.",
            "No la he visto todavía, pero ahora tengo muchas ganas.",
            "Interesante punto de vista sobre el cine español.",
            "¿Recomendarías otras películas similares del cine hispano?",
            "Gracias por compartir tu opinión tan detallada.",
            "Coincido. El cine en español está en un gran momento.",
            "Hay que apoyar más este tipo de cine de calidad."
        ]
    };
    
    // Generar comentarios entre usuarios
    CONFIG.userProfiles.forEach((commenter, commenterIndex) => {
        // Cada usuario comentará en 3-4 reseñas de otros usuarios
        const commentCount = Math.floor(Math.random() * 2) + 3;
        
        for (let i = 0; i < commentCount; i++) {
            // Seleccionar un usuario diferente al que hará el comentario
            let targetUserIndex;
            do {
                targetUserIndex = Math.floor(Math.random() * CONFIG.userProfiles.length);
            } while (targetUserIndex === commenterIndex);
            
            // Determinar el tipo de comentario según la personalidad
            let commentType;
            if (commenter.username.includes('criterion') || commenter.username.includes('bergman') || 
                commenter.username.includes('tarkovsky') || commenter.username.includes('erice')) {
                commentType = Math.random() > 0.5 ? 'cinefilo_friki' : 'filosofico';
            } else if (commenter.username.includes('nouvelle_vague') || commenter.username.includes('bunuel') ||
                commenter.username.includes('almodovar')) {
                commentType = Math.random() > 0.5 ? 'discusion_tecnica' : 'cinefilo_friki';
            } else if (commenter.username.includes('lynch') || commenter.username.includes('independiente')) {
                commentType = Math.random() > 0.5 ? 'filosofico' : 'desacuerdo';
            } else {
                // Usuarios más casuales hispanohablantes
                const types = ['acuerdo', 'desacuerdo', 'respuesta_casual'];
                commentType = types[Math.floor(Math.random() * types.length)];
            }
            
            const comments = commentTemplates[commentType];
            const commentText = comments[Math.floor(Math.random() * comments.length)];
            
            requests.push({
                name: `${commenter.username} comenta en reseña de ${CONFIG.userProfiles[targetUserIndex].username}`,
                event: [
                    {
                        listen: 'prerequest',
                        script: {
                            exec: [
                                // Obtener una reseña del usuario objetivo
                                `pm.sendRequest({`,
                                `    url: pm.environment.get('base_url') + '/user-movies/reviews',`,
                                `    method: 'GET',`,
                                `    header: {`,
                                `        'Authorization': 'Bearer ' + pm.environment.get('user_${targetUserIndex}_token')`,
                                `    }`,
                                `}, function (err, response) {`,
                                `    if (!err && response.json().length > 0) {`,
                                `        const reviews = response.json();`,
                                `        const randomReview = reviews[Math.floor(Math.random() * reviews.length)];`,
                                `        pm.environment.set('target_review_id', randomReview._id);`,
                                `    }`,
                                `});`
                            ]
                        }
                    },
                    {
                        listen: 'test',
                        script: {
                            exec: [
                                'pm.test("Comentario añadido", () => {',
                                '    pm.expect([200, 201, 404]).to.include(pm.response.code);',
                                '});'
                            ]
                        }
                    }
                ],
                request: {
                    method: 'POST',
                    header: [
                        { key: 'Content-Type', value: 'application/json' },
                        { key: 'Authorization', value: `Bearer {{user_${commenterIndex}_token}}` }
                    ],
                    body: {
                        mode: 'raw',
                        raw: JSON.stringify({
                            text: commentText
                        })
                    },
                    url: {
                        raw: '{{base_url}}/comments/reviews/{{target_review_id}}/comments',
                        host: ['{{base_url}}'],
                        path: ['comments', 'reviews', '{{target_review_id}}', 'comments']
                    }
                }
            });
        }
    });
    
    return requests;
}

/**
 * Genera requests para dar likes a reseñas y listas
 */
function generateLikeRequests() {
    const requests = [];
    
    CONFIG.userProfiles.forEach((user, userIndex) => {
        // Cada usuario dará likes a 4-6 contenidos de otros usuarios
        const likeCount = Math.floor(Math.random() * 3) + 4;
        
        for (let i = 0; i < likeCount; i++) {
            // Seleccionar un usuario diferente
            let targetUserIndex;
            do {
                targetUserIndex = Math.floor(Math.random() * CONFIG.userProfiles.length);
            } while (targetUserIndex === userIndex);
            
            // Decidir si dar like a una reseña o una lista (75% reseñas, 25% listas)
            const likeType = Math.random() > 0.25 ? 'review' : 'list';
            
            if (likeType === 'review') {
                requests.push({
                    name: `${user.username} da like a reseña de ${CONFIG.userProfiles[targetUserIndex].username}`,
                    event: [
                        {
                            listen: 'prerequest',
                            script: {
                                exec: [
                                    // Obtener reseñas del usuario objetivo
                                    `pm.sendRequest({`,
                                    `    url: pm.environment.get('base_url') + '/user-movies/reviews',`,
                                    `    method: 'GET',`,
                                    `    header: {`,
                                    `        'Authorization': 'Bearer ' + pm.environment.get('user_${targetUserIndex}_token')`,
                                    `    }`,
                                    `}, function (err, response) {`,
                                    `    if (!err && response.json().length > 0) {`,
                                    `        const reviews = response.json();`,
                                    `        const randomReview = reviews[Math.floor(Math.random() * reviews.length)];`,
                                    `        pm.environment.set('target_review_for_like', randomReview._id);`,
                                    `    }`,
                                    `});`
                                ]
                            }
                        },
                        {
                            listen: 'test',
                            script: {
                                exec: [
                                    'pm.test("Like añadido a reseña", () => {',
                                    '    pm.expect([200, 201, 400]).to.include(pm.response.code);',
                                    '});'
                                ]
                            }
                        }
                    ],
                    request: {
                        method: 'POST',
                        header: [
                            { key: 'Content-Type', value: 'application/json' },
                            { key: 'Authorization', value: `Bearer {{user_${userIndex}_token}}` }
                        ],
                        body: {
                            mode: 'raw',
                            raw: JSON.stringify({
                                contentType: 'review',
                                contentId: '{{target_review_for_like}}'
                            })
                        },
                        url: {
                            raw: '{{base_url}}/likes/toggle',
                            host: ['{{base_url}}'],
                            path: ['likes', 'toggle']
                        }
                    }
                });
            } else {
                requests.push({
                    name: `${user.username} da like a lista de ${CONFIG.userProfiles[targetUserIndex].username}`,
                    event: [
                        {
                            listen: 'prerequest',
                            script: {
                                exec: [
                                    // Obtener listas del usuario objetivo
                                    `pm.sendRequest({`,
                                    `    url: pm.environment.get('base_url') + '/movie-lists/lists',`,
                                    `    method: 'GET',`,
                                    `    header: {`,
                                    `        'Authorization': 'Bearer ' + pm.environment.get('user_${targetUserIndex}_token')`,
                                    `    }`,
                                    `}, function (err, response) {`,
                                    `    if (!err && response.json().lists && response.json().lists.length > 0) {`,
                                    `        const lists = response.json().lists;`,
                                    `        const randomList = lists[Math.floor(Math.random() * lists.length)];`,
                                    `        pm.environment.set('target_list_for_like', randomList._id);`,
                                    `    }`,
                                    `});`
                                ]
                            }
                        },
                        {
                            listen: 'test',
                            script: {
                                exec: [
                                    'pm.test("Like añadido a lista", () => {',
                                    '    pm.expect([200, 201, 400]).to.include(pm.response.code);',
                                    '});'
                                ]
                            }
                        }
                    ],
                    request: {
                        method: 'POST',
                        header: [
                            { key: 'Content-Type', value: 'application/json' },
                            { key: 'Authorization', value: `Bearer {{user_${userIndex}_token}}` }
                        ],
                        body: {
                            mode: 'raw',
                            raw: JSON.stringify({
                                contentType: 'list',
                                contentId: '{{target_list_for_like}}'
                            })
                        },
                        url: {
                            raw: '{{base_url}}/likes/toggle',
                            host: ['{{base_url}}'],
                            path: ['likes', 'toggle']
                        }
                    }
                });
            }
        }
    });
    
    return requests;
}

/**
 * Construye la colección completa
 */
function buildFixturesCollection() {
    console.log('🔨 Construyendo colección de fixtures en español...');
    
    FIXTURES_COLLECTION.item = [
        {
            name: "👥 1. Crear Usuarios Cinéfilos",
            item: generateUserRequests()
        },
        {
            name: "🤝 2. Establecer Seguimientos", 
            item: generateFollowRequests()
        },
        {
            name: "🎬 3. Añadir Películas a Listas",
            item: generateMovieRequests()
        },
        {
            name: "📝 4. Crear Reseñas en Español",
            item: generateReviewRequests()
        },
        {
            name: "📋 5. Crear Listas Temáticas",
            item: generateListRequests()
        },
        {
            name: "💬 6. Añadir Comentarios",
            item: generateCommentRequests()
        },
        {
            name: "❤️ 7. Dar Likes",
            item: generateLikeRequests()
        }
    ];
    
    console.log(`✅ Colección construida con ${FIXTURES_COLLECTION.item.length} secciones`);
    return FIXTURES_COLLECTION;
}

/**
 * Ejecuta la colección con Newman con configuración optimizada
 */
async function runFixtures() {
    console.log('🚀 Iniciando generación de fixtures de cine hispanohablante...');
    
    const collection = buildFixturesCollection();
    
    return new Promise((resolve, reject) => {
        newman.run({
            collection: collection,
            environment: CONFIG.environment,
            reporters: ['cli'],
            insecure: true,
            timeout: 120000, // 2 minutos timeout total
            timeoutRequest: 15000, // 15 segundos por request
            timeoutScript: 8000, // 8 segundos para scripts
            delayRequest: 250, // 250ms entre requests
            bail: false, // No parar en fallos
            suppressExitCode: true, // No terminar proceso en error
            iterationCount: 1,
            verbose: false // Menos verboso para evitar spam
        }, (err, summary) => {
            // Siempre resolver, incluso con errores parciales
            if (err && err.message.includes('callback timed out')) {
                console.log('⚠️  Proceso completado con timeout, pero algunos datos fueron procesados');
                console.log('🔄 Intentando guardar resultados parciales...');
                resolve({ 
                    error: 'timeout',
                    message: 'Completado parcialmente',
                    summary: summary || {}
                });
            } else if (err) {
                console.error('❌ Error ejecutando fixtures:', err.message);
                // Aún así intentamos procesar lo que se pudo
                resolve({
                    error: err.message,
                    summary: summary || {}
                });
            } else {
                console.log('✅ Fixtures completados exitosamente!');
                console.log(`📊 Estadísticas:`);
                console.log(`   - Total requests: ${summary.run.stats.requests.total}`);
                console.log(`   - Exitosos: ${summary.run.stats.requests.total - summary.run.stats.requests.failed}`);
                console.log(`   - Fallidos: ${summary.run.stats.requests.failed}`);
                console.log(`   - Tiempo total: ${summary.run.timings.completed - summary.run.timings.started}ms`);
                
                if (summary.run.failures && summary.run.failures.length > 0) {
                    console.log('\n⚠️  Algunos requests fallaron:');
                    summary.run.failures.slice(0, 5).forEach(failure => {
                        console.log(`   - ${failure.source.name}: ${failure.error.message}`);
                    });
                    if (summary.run.failures.length > 5) {
                        console.log(`   ... y ${summary.run.failures.length - 5} errores más`);
                    }
                }
                
                resolve(summary);
            }
        });
    });
}

/**
 * Función principal
 */
async function main() {
    try {
        console.log('🎬 COMETACINE - GENERADOR DE FIXTURES HISPANOHABLANTE');
        console.log('====================================================');
        console.log(`🌐 Base URL: ${CONFIG.baseUrl}`);
        console.log(`👥 Usuarios cinéfilos a crear: ${CONFIG.userProfiles.length}`);
        console.log('🎭 ENFOQUE: Cine hispanohablante, de autor y cultura');
        console.log('📝 MODO: Añadir contenido (preservar datos existentes)');
        console.log('');
        
        // Verificar que Newman esté instalado
        try {
            require('newman');
        } catch (error) {
            console.error('❌ Newman no está instalado. Ejecuta: npm install -g newman');
            process.exit(1);
        }
        
        // Verificar conexión al servidor antes de continuar
        console.log('🔍 Verificando conexión al servidor...');
        try {
            const axios = require('axios');
            const response = await axios.get(`${CONFIG.baseUrl}/`, { timeout: 5000 });
            console.log('✅ Servidor respondiendo correctamente');
        } catch (error) {
            console.error('❌ No se puede conectar al servidor:');
            console.error('   - Asegúrate de que el servidor esté corriendo');
            console.error('   - Verifica la URL en BASE_URL');
            console.error(`   - URL actual: ${CONFIG.baseUrl}`);
            process.exit(1);
        }
        
        // Ejecutar fixtures
        const result = await runFixtures();
        
        if (result.error) {
            console.log('\n⚠️  Proceso completado con algunos errores, pero se generaron datos');
            console.log('🔍 Ve a tu aplicación web para ver el contenido generado');
        } else {
            console.log('\n🎉 ¡Fixtures de cine hispanohablante generados exitosamente!');
            console.log('🔍 Ve a tu aplicación web para ver el nuevo contenido cinéfilo');
        }
        
        console.log('📊 Los nuevos usuarios tienen contraseña: password123');
        console.log('🎭 Perfiles especializados en cine español, mexicano y latinoamericano');
        console.log('📄 Revisa la consola para ver el resumen completo');
        
    } catch (error) {
        console.error('💀 Error fatal:', error);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}

module.exports = {
    CONFIG,
    buildFixturesCollection,
    runFixtures
};