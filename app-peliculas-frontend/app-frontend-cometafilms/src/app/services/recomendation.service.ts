import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class RecommendationService {
  private apiUrl = environment.apiUrl + '/user-movies';

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

  // Obtener recomendaciones personalizadas
  getPersonalizedRecommendations(limit: number = 15, forceRefresh: boolean = false): Observable<any[]> {
    const params: any = { limit: limit.toString() };

    // parámetro para forzar refresco si es necesario
    if (forceRefresh) {
      params.refresh = 'true';
    }

    return this.http.get<any[]>(
      `${this.apiUrl}/recommendations/personalized`,
      {
        ...this.getHeaders(),
        params
      }
    );
  }
}