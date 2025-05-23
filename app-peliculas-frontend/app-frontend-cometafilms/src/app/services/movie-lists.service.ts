// src/app/services/movie-lists.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environments';
import { MovieList, ListsResponse } from '../models/movie-list.model';

@Injectable({
  providedIn: 'root'
})
export class MovieListsService {
  private apiUrl = environment.apiUrl + '/movie-lists';

  constructor(private http: HttpClient) { }

  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private getHeaders(): { headers: HttpHeaders } {
    const token = this.getToken();
    return {
      headers: new HttpHeaders()
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token || ''}`)
    };
  }

  // Crear una nueva lista
  createList(listData: any): Observable<any> {
    console.log('Servicio - Datos enviados:', listData);
    return this.http.post(
      `${this.apiUrl}/lists`,
      listData,
      this.getHeaders()
    );
  }

  // Obtener todas las listas del usuario actual
  getUserLists(): Observable<ListsResponse> {
    return this.http.get<ListsResponse>(
      `${this.apiUrl}/lists`,
      this.getHeaders()
    );
  }

  // Obtener una lista específica por ID
  getListById(listId: string): Observable<MovieList> {
    return this.http.get<MovieList>(
      `${this.apiUrl}/lists/${listId}`,
      this.getHeaders()
    );
  }

  // Añadir película a una lista
  addMovieToList(listId: string, movieId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/lists/${listId}/movies`,
      { movieId },
      this.getHeaders()
    );
  }

  // Eliminar película de una lista
  removeMovieFromList(listId: string, movieId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/lists/${listId}/movies`,
      {
        headers: this.getHeaders().headers,
        body: { movieId }
      }
    );
  }

  // Obtener listas públicas de un usuario específico
  getUserPublicLists(userId: string): Observable<ListsResponse> {
    return this.http.get<ListsResponse>(
      `${this.apiUrl}/users/${userId}/lists`,
      this.getHeaders()
    );
  }

  // Actualizar una lista existente
  updateList(listId: string, listData: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/lists/${listId}`,
      listData,
      this.getHeaders()
    );
  }

  // Eliminar una lista
  deleteList(listId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/lists/${listId}`,
      this.getHeaders()
    );
  }
}