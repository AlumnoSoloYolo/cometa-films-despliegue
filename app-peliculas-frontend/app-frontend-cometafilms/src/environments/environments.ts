export const environment = {
    production: true,
    tmdbToken: process.env['TMDB_TOKEN'] || '',
    apiUrl: process.env['API_URL'] || '',
    movieApiUrl: process.env['MOVIE_API_URL'] || ''
};
