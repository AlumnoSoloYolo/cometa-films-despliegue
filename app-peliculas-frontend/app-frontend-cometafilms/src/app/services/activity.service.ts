// src/app/services/activity.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class ActivityService {
  private apiUrl = environment.apiUrl + '/activity';

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

  // Obtener el feed de actividad
  getFeed(page: number = 1, limit: number = 20, includeOwn: boolean = true): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('includeOwn', includeOwn.toString());

    return this.http.get(
      `${this.apiUrl}/feed`,
      { headers: this.getHeaders().headers, params }
    );
  }

  // Obtener actividades de un usuario específico
  getUserActivities(userId: string, page: number = 1, limit: number = 20): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get(
      `${this.apiUrl}/user/${userId}`,
      { headers: this.getHeaders().headers, params }
    );
  }

  // Eliminar una actividad
  deleteActivity(activityId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/${activityId}`,
      this.getHeaders()
    );
  }
}