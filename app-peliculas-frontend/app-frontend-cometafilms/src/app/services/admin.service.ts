
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environments';
import { AuthService } from './auth.service';

export interface AdminUser {
  _id: string;
  username: string;
  email: string;
  avatar: string;
  isPremium: boolean;
  role: string;
  biografia?: string;
  isActive: boolean;
  isBanned: boolean;
  banReason?: string;
  bannedAt?: Date;
  banExpiresAt?: Date;
  createdAt: Date;
  canBeBanned?: boolean;
  banTimeRemaining?: number;
  moderationHistory?: {
    action: string;
    reason?: string;
    timestamp: Date;
  }[];
  // Indica si el usuario ha editado su perfil
}

export interface AdminReview {
  _id: string;
  userId: {
    _id: string;
    username: string;
    avatar: string;
    role: string;
  };
  movieId: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface AdminComment {
  _id: string;
  userId: {
    _id: string;
    username: string;
    avatar: string;
    role: string;
  };
  text: string;
  reviewId: string;
  createdAt: Date;
  isEdited: boolean;
}

export interface AdminList {
  _id: string;
  userId: {
    _id: string;
    username: string;
    avatar: string;
    role: string;
  };
  title: string;
  description: string;
  isPublic: boolean;
  movies: any[];
  createdAt: Date;
  coverImage?: string;
}

export interface SystemStats {
  overview: {
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
    totalReviews: number;
    totalComments: number;
    totalLists: number;
    totalChats: number;
    totalMessages: number;
  };
  usersByRole: { [key: string]: number };
  today: {
    newUsers: number;
    newReviews: number;
    newComments: number;
    newLists: number;
  };
}

// Interfaz para la respuesta del backend de permisos
export interface PermissionsResponse {
  success: boolean;
  user: {
    id: string;
    username: string;
    role: string;
  };
  permissions: UserPermissions;
}

export interface UserPermissions {
  role: string;
  permissions: string[];
  isActive: boolean;
  isBanned: boolean;
  can: {
    accessAdminPanel: boolean;
    moderateContent: boolean;
    banUsers: boolean;
    manageUsers: boolean;
    createUnlimitedLists: boolean;
    accessRecommendations: boolean;
    viewAnalytics: boolean;
    manageReports: boolean;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data?: T[];
  users?: T[];
  reviews?: T[];
  comments?: T[];
  lists?: T[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
    limit: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly apiUrl = `${environment.apiUrl}/admin`;

  // Subject para notificar cambios
  private refreshDataSubject = new BehaviorSubject<string>('');
  public refreshData$ = this.refreshDataSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  private getHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  private handleError(error: any): Observable<never> {
    console.error('Error en AdminService:', error);

    let errorMessage = 'Error desconocido';

    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.status === 403) {
      errorMessage = 'No tienes permisos para realizar esta acción';
    } else if (error.status === 401) {
      errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente';
    } else if (error.status === 500) {
      errorMessage = 'Error interno del servidor';
    }

    return throwError(() => new Error(errorMessage));
  }

  // ===== PERMISOS Y CONFIGURACIÓN =====

  getUserPermissions(): Observable<PermissionsResponse> {
    return this.http.get<PermissionsResponse>(`${this.apiUrl}/permissions`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ===== ESTADÍSTICAS =====

  getSystemStats(): Observable<SystemStats> {
    return this.http.get<SystemStats>(`${this.apiUrl}/stats`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ===== GESTIÓN DE USUARIOS =====

  getUsers(filters: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    banned?: boolean;
    active?: boolean;
  } = {}): Observable<PaginatedResponse<AdminUser>> {
    let params = new HttpParams();

    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.search) params = params.set('search', filters.search);
    if (filters.role) params = params.set('role', filters.role);
    if (filters.banned !== undefined) params = params.set('banned', filters.banned.toString());
    if (filters.active !== undefined) params = params.set('active', filters.active.toString());

    return this.http.get<PaginatedResponse<AdminUser>>(`${this.apiUrl}/users`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  banUser(userId: string, reason: string, duration?: number): Observable<any> {
    const body: any = { reason };
    if (duration && duration > 0) {
      body.duration = duration;
    }

    return this.http.post(`${this.apiUrl}/users/${userId}/ban`, body, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => this.refreshDataSubject.next('users')),
      catchError(this.handleError)
    );
  }

  unbanUser(userId: string, reason?: string): Observable<any> {
    const body = reason ? { reason } : {};

    return this.http.post(`${this.apiUrl}/users/${userId}/unban`, body, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => this.refreshDataSubject.next('users')),
      catchError(this.handleError)
    );
  }

  changeUserRole(userId: string, newRole: string, reason?: string): Observable<any> {
    const body: any = { newRole };
    if (reason) body.reason = reason;

    return this.http.put(`${this.apiUrl}/users/${userId}/role`, body, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => this.refreshDataSubject.next('users')),
      catchError(this.handleError)
    );
  }

  getUserModerationHistory(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/users/${userId}/moderation-history`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ===== MODERACIÓN DE CONTENIDO =====

  getReviews(filters: {
    page?: number;
    limit?: number;
    user?: string;
  } = {}): Observable<PaginatedResponse<AdminReview>> {
    let params = new HttpParams();

    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.user) params = params.set('user', filters.user);

    return this.http.get<PaginatedResponse<AdminReview>>(`${this.apiUrl}/reviews`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  deleteReview(reviewId: string, reason?: string): Observable<any> {
    const body = reason ? { reason } : {};

    return this.http.delete(`${this.apiUrl}/reviews/${reviewId}`, {
      headers: this.getHeaders(),
      body
    }).pipe(
      tap(() => this.refreshDataSubject.next('reviews')),
      catchError(this.handleError)
    );
  }

  getComments(filters: {
    page?: number;
    limit?: number;
    user?: string;
  } = {}): Observable<PaginatedResponse<AdminComment>> {
    let params = new HttpParams();

    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.user) params = params.set('user', filters.user);

    return this.http.get<PaginatedResponse<AdminComment>>(`${this.apiUrl}/comments`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  deleteComment(commentId: string, reason?: string): Observable<any> {
    const body = reason ? { reason } : {};

    return this.http.delete(`${this.apiUrl}/comments/${commentId}`, {
      headers: this.getHeaders(),
      body
    }).pipe(
      tap(() => this.refreshDataSubject.next('comments')),
      catchError(this.handleError)
    );
  }

  getLists(filters: {
    page?: number;
    limit?: number;
    user?: string;
    public?: boolean;
  } = {}): Observable<PaginatedResponse<AdminList>> {
    let params = new HttpParams();

    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.user) params = params.set('user', filters.user);
    if (filters.public !== undefined) params = params.set('public', filters.public.toString());

    return this.http.get<PaginatedResponse<AdminList>>(`${this.apiUrl}/lists`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  deleteList(listId: string, reason?: string): Observable<any> {
    const body = reason ? { reason } : {};

    return this.http.delete(`${this.apiUrl}/lists/${listId}`, {
      headers: this.getHeaders(),
      body
    }).pipe(
      tap(() => this.refreshDataSubject.next('lists')),
      catchError(this.handleError)
    );
  }

  // ===== UTILIDADES =====

  /**
   * Notifica que los datos han cambiado para refrescar las vistas
   */
  notifyDataRefresh(dataType: string): void {
    this.refreshDataSubject.next(dataType);
  }

  /**
   * Verifica si el usuario actual tiene permisos de administrador
   */
  hasAdminAccess(): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map(response => {
        // Acceder a response.permissions.can.accessAdminPanel
        return response?.permissions?.can?.accessAdminPanel === true;
      }),
      catchError(() => {
        return of(false);
      })
    );
  }



}