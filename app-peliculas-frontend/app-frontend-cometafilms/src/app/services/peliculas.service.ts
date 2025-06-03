import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, BehaviorSubject, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { tap, shareReplay, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class PeliculasService {
  private baseUrl = 'https://api.themoviedb.org/3/';
  private headers = new HttpHeaders().set('Authorization', `Bearer ${environment.tmdbToken}`)
    .set('accept', 'application/json');

  // Sistema de cache para géneros - una sola petición para toda la app
  private generosCache$: Observable<any> | null = null;
  private generosCacheData: any[] = [];
  private generosSubject = new BehaviorSubject<any[]>([]);
  public generos$ = this.generosSubject.asObservable();

  // Cache de películas para evitar peticiones duplicadas
  private movieCache = new Map<string, any>();

  constructor(private http: HttpClient) {
    this.loadGeneros();
  }

  // MÉTODOS ORIGINALES (mantenidos exactamente como los tenías)

  getPelisPopulares(): Observable<any> {
    return this.http.get(`${this.baseUrl}/movie/popular`, { headers: this.headers });
  }

  getAhoraEnCines(): Observable<any> {
    return this.http.get(`${this.baseUrl}/movie/now_playing`, { headers: this.headers });
  }

  getPeliculasMasValoradas(): Observable<any> {
    return this.http.get(`${this.baseUrl}/movie/top_rated`, { headers: this.headers });
  }

  getProximosEstrenos(): Observable<any> {
    return this.http.get(`${this.baseUrl}/movie/upcoming`, { headers: this.headers });
  }

  getTendenciasSemanales(): Observable<any> {
    return this.http.get(`${this.baseUrl}/trending/movie/week`, { headers: this.headers });
  }

  getDetallesPersona(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/person/${id}`, {
      headers: this.headers,
      params: {
        append_to_response: 'movie_credits,images'
      }
    });
  }

  busquedaAvanzadaPeliculas(params: {
    query?: string,
    year?: number,
    genreIds?: number[],
    sortBy?: string,
    minRating?: number,
    maxRating?: number,
    page?: number
  }): Observable<any> {
    const searchParams: any = { page: params.page || 1, include_adult: false };

    if (params.query) {
      searchParams.with_text_query = params.query;
    }

    if (params.year) {
      searchParams.primary_release_year = params.year;
    }

    if (params.genreIds && params.genreIds.length > 0) {
      searchParams.with_genres = params.genreIds.join(',');
    }

    if (params.sortBy) {
      searchParams.sort_by = params.sortBy;
    }

    if (params.minRating !== undefined) {
      searchParams['vote_average.gte'] = params.minRating;
    }

    if (params.maxRating !== undefined) {
      searchParams['vote_average.lte'] = params.maxRating;
    }

    return this.http.get(`${this.baseUrl}/discover/movie`, {
      headers: this.headers,
      params: searchParams
    });
  }

  // MÉTODOS OPTIMIZADOS (nuevos con cache)

  // Obtener géneros con cache optimizado
  getGeneros(): Observable<any> {
    if (this.generosCacheData.length > 0) {
      return of({ genres: this.generosCacheData });
    }

    if (this.generosCache$) {
      return this.generosCache$;
    }

    this.generosCache$ = this.http.get<any>(`${this.baseUrl}/genre/movie/list`, { headers: this.headers }).pipe(
      tap(response => {
        this.generosCacheData = response.genres || [];
        this.generosSubject.next(this.generosCacheData);
      }),
      shareReplay(1),
      catchError(error => {
        console.error('Error al cargar géneros:', error);
        return of({ genres: [] });
      })
    );

    return this.generosCache$;
  }

  // Obtener géneros desde cache de forma síncrona
  getGenerosSync(): any[] {
    return this.generosCacheData;
  }

  // Cargar géneros al inicializar el servicio
  private loadGeneros(): void {
    this.getGeneros().subscribe({
      next: () => console.log('Géneros cargados en cache'),
      error: (error) => console.error('Error al cargar géneros:', error)
    });
  }

  // Obtener detalles de película con cache (versión básica para tarjetas)
  getDetallesPelicula(id: string): Observable<any> {
    if (this.movieCache.has(id)) {
      return of(this.movieCache.get(id));
    }

    return this.http.get(`${this.baseUrl}/movie/${id}`, {
      headers: this.headers
    }).pipe(
      tap(movie => this.movieCache.set(id, movie)),
      catchError(error => {
        console.error(`Error al cargar película ${id}:`, error);
        return of(null);
      })
    );
  }

  // Obtener detalles completos de película (solo para página de detalles)
  getDetallesCompletoPelicula(id: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/movie/${id}`, {
      headers: this.headers,
      params: {
        append_to_response: 'credits,similar,reviews,actors,videos'
      }
    }).pipe(
      tap(movie => this.movieCache.set(id, movie)),
      catchError(error => {
        console.error(`Error al cargar película completa ${id}:`, error);
        return of(null);
      })
    );
  }

  // Precargar múltiples películas de una vez para optimizar rendimiento
  preloadMovies(movieIds: string[]): Observable<any[]> {
    const requests = movieIds.map(id => this.getDetallesPelicula(id));
    return forkJoin(requests);
  }

  // Obtener información básica de múltiples películas para optimizar listas
  getMoviesBasicInfo(movieIds: string[]): Observable<any[]> {
    const cachedMovies: any[] = [];
    const uncachedIds: string[] = [];

    movieIds.forEach(id => {
      if (this.movieCache.has(id)) {
        cachedMovies.push(this.movieCache.get(id));
      } else {
        uncachedIds.push(id);
      }
    });

    if (uncachedIds.length === 0) {
      return of(cachedMovies);
    }

    const requests = uncachedIds.map(id => this.getDetallesPelicula(id));
    return forkJoin(requests).pipe(
      tap(newMovies => {
        newMovies.forEach((movie, index) => {
          if (movie) {
            this.movieCache.set(uncachedIds[index], movie);
            cachedMovies.push(movie);
          }
        });
      }),
      catchError(error => {
        console.error('Error al cargar películas básicas:', error);
        return of(cachedMovies);
      })
    );
  }

  // Limpiar todos los caches
  clearCache(): void {
    this.movieCache.clear();
    this.generosCacheData = [];
    this.generosCache$ = null;
    this.generosSubject.next([]);
    console.log('Cache limpiado completamente');
  }

  // Limpiar solo el cache de una película específica
  clearMovieCache(movieId: string): void {
    this.movieCache.delete(movieId);
  }

  // Obtener estadísticas del cache para debugging
  getCacheStats(): any {
    return {
      generosCached: this.generosCacheData.length > 0,
      generosCount: this.generosCacheData.length,
      moviesCachedCount: this.movieCache.size,
      cachedMovieIds: Array.from(this.movieCache.keys()).slice(0, 10)
    };
  }

  // Validar si una película está en cache
  isMovieInCache(movieId: string): boolean {
    return this.movieCache.has(movieId);
  }

  // Precargar datos esenciales de la aplicación
  preloadEssentialData(): Observable<any> {
    return this.getGeneros();
  }


  // NUEVO método específico para detalles COMPLETOS con llamadas separadas
  getDetallesCompletaPelicula(id: string): Observable<any> {
    console.log('Haciendo llamadas separadas para película:', id);

    // Llamadas separadas a cada endpoint
    const movieDetails = this.http.get(`${this.baseUrl}/movie/${id}`, { headers: this.headers });
    const movieCredits = this.http.get(`${this.baseUrl}/movie/${id}/credits`, { headers: this.headers });
    const movieSimilar = this.http.get(`${this.baseUrl}/movie/${id}/similar`, { headers: this.headers });
    const movieVideos = this.http.get(`${this.baseUrl}/movie/${id}/videos`, { headers: this.headers });

    // Combinar todas las respuestas en un solo objeto
    return forkJoin({
      details: movieDetails,
      credits: movieCredits,
      similar: movieSimilar,
      videos: movieVideos
    }).pipe(
      map(results => {
        console.log('Resultados combinados:', results);
        return {
          ...results.details,
          credits: results.credits,
          similar: results.similar,
          videos: results.videos
        };
      })
    );
  }

}