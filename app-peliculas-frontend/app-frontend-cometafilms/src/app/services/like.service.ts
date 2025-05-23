import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class LikeService {
  private apiUrl = environment.apiUrl + '/likes';

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

  // Dar/quitar like a un contenido
  toggleLike(contentType: string, contentId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/toggle`,
      { contentType, contentId },
      this.getHeaders()
    );
  }

  // Verificar si el usuario actual ha dado like a un contenido
  checkLike(contentType: string, contentId: string): Observable<{ liked: boolean }> {
    return this.http.get<{ liked: boolean }>(
      `${this.apiUrl}/${contentType}/${contentId}/check`,
      this.getHeaders()
    );
  }

  // Obtener conteo de likes para un contenido
  getLikeCount(contentType: string, contentId: string): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(
      `${this.apiUrl}/${contentType}/${contentId}/count`,
      this.getHeaders()
    );
  }

  // Obtener estado de likes para múltiples contenidos
  getBulkLikeStatus(items: { contentType: string, contentId: string }[]): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/status/bulk`,
      { items },
      this.getHeaders()
    );
  }

  // listar usuarios que han dado like
  getLikeUsers(contentType: string, contentId: string): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiUrl}/${contentType}/${contentId}/users`,
      this.getHeaders()
    );
  }
}