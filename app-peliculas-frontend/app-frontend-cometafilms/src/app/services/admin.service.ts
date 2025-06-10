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
  reports?: T[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
    limit: number;
  };
}

export interface AdminReport {
  _id: string;
  reporter: {
    _id: string;
    username: string;
    avatar: string;
    role: string;
  };
  reportedUser: {
    _id: string;
    username: string;
    avatar: string;
    role: string;
  };
  reportedContent: {
    contentType: 'user' | 'review' | 'comment' | 'list';
    contentId?: string;
    contentSnapshot?: {
      text?: string;
      title?: string;
      description?: string;
      rating?: number;
      movieId?: string;
      moviesCount?: number;
    };
  };
  reason: string;
  description?: string;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  resolution?: {
    action: string;
    notes?: string;
    resolvedBy: {
      _id: string;
      username: string;
    };
    resolvedAt: Date;
  };
  moderatorNotes?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'content' | 'behavior' | 'spam' | 'legal' | 'safety';
  createdAt: Date;
}

export interface ReportStats {
  summary: {
    total: number;
    pending: number;
    underReview: number;
    resolved: number;
    dismissed: number;
    resolutionRate: string;
  };
  byStatus: Array<{ _id: string; count: number }>;
  byContentType: Array<{ _id: string; count: number }>;
  byReason: Array<{ _id: string; count: number }>;
  byPriority: Array<{ _id: string; count: number }>;
  dailyTrend: Array<{ _id: string; count: number }>;
}

export interface ResolveReportRequest {
  action: 'no_action' | 'content_deleted' | 'user_warned' | 'user_banned' | 'other';
  notes?: string;
  shouldNotify?: boolean;
}

export interface UpdateReportStatusRequest {
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  notes?: string;
}


export interface DashboardMetrics {
  overview: {
    totalUsers: number;
    activeUsers: number;
    bannedUsers: number;
    premiumUsers: number;
    totalReviews: number;
    totalComments: number;
    totalLists: number;
    totalReports: number;
  };
  period: {
    timeRange: string;
    newUsers: number;
    newReviews: number;
    newComments: number;
    newLists: number;
    newReports: number;
    newBans: number;
  };
  today: {
    newUsers: number;
    newReviews: number;
    newComments: number;
    newLists: number;
    newReports: number;
    newBans: number;
    totalLikes: number;
  };
  moderation: {
    pendingReports: number;
    averageResolutionTime: number;
    mostCommonReportType: string;
    efficiency: number;
  };
  content: {
    totalLikes: number;
    averageRating: number;
    mostActiveUser: {
      username: string;
      activityScore: number;
    } | null;
  };
  charts: {
    userGrowth: Array<{
      date: string;
      count: number;
    }>;
    activityTrends: Array<{
      date: string;
      reviews: number;
      comments: number;
      likes: number;
    }>;
    topMovies: Array<{
      movieId: string;
      title?: string;
      reviewCount: number;
      averageRating: number;
    }>;
  };
  generatedAt: string;
}

export interface RealtimeMetrics {
  activeUsersNow: number;
  pendingReports: number;
  newReportsToday: number;
  newUsersToday: number;
  systemHealth: {
    status: string;
    recentErrors: number;
    activeConnections: number;
    responseTime: number;
    uptime: number;
  };
  timestamp: string;
}


@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private readonly apiUrl = `${environment.apiUrl}/admin`;
  private readonly reportsApiUrl = `${environment.apiUrl}/reports`;

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

  // ===== GESTIÓN DE REPORTES MEJORADA =====

  /**
   * Obtener reportes para el panel de administración
   */
  getReports(filters: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    category?: string;
    contentType?: string;
    reason?: string;
  } = {}): Observable<PaginatedResponse<AdminReport>> {
    let params = new HttpParams();

    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.status) params = params.set('status', filters.status);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.contentType) params = params.set('contentType', filters.contentType);
    if (filters.reason) params = params.set('reason', filters.reason);

    return this.http.get<any>(`${this.apiUrl}/reports`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(response => ({
        success: response.success,
        reports: response.reports,  // Mapear reports desde la respuesta
        pagination: response.pagination
      })),
      catchError(this.handleError)
    );
  }

  /**
   * Resolver un reporte específico con notificaciones mejoradas
   */
  resolveReport(reportId: string, resolution: ResolveReportRequest): Observable<any> {
    console.log('AdminService: Resolviendo reporte', reportId, resolution);

    return this.http.patch(`${this.apiUrl}/reports/${reportId}/resolve`, resolution, {
      headers: this.getHeaders()
    }).pipe(
      tap((response) => {
        console.log('AdminService: Reporte resuelto exitosamente', response);
        this.refreshDataSubject.next('reports');
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Actualizar el estado de un reporte
   */
  updateReportStatus(reportId: string, update: UpdateReportStatusRequest): Observable<any> {
    console.log('AdminService: Actualizando estado del reporte', reportId, update);

    return this.http.patch(`${this.apiUrl}/reports/${reportId}/status`, update, {
      headers: this.getHeaders()
    }).pipe(
      tap((response) => {
        console.log('AdminService: Estado del reporte actualizado', response);
        this.refreshDataSubject.next('reports');
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Obtener estadísticas de reportes
   */
  getReportStats(): Observable<ReportStats> {
    return this.http.get<{ success: boolean; data: ReportStats }>(`${this.apiUrl}/reports/stats`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Obtener reportes contra un usuario específico
   */
  getReportsAgainstUser(userId: string, page: number = 1, limit: number = 10): Observable<PaginatedResponse<AdminReport>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<any>(`${this.apiUrl}/reports/against/${userId}`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      map(response => ({
        success: response.success,
        reports: response.reports,
        pagination: response.pagination
      })),
      catchError(this.handleError)
    );
  }

  /**
   * Obtener reportes de contenido específico
   */
  getReportsForContent(contentType: string, contentId: string): Observable<AdminReport[]> {
    return this.http.get<{ success: boolean; reports: AdminReport[] }>(`${this.apiUrl}/reports/content/${contentType}/${contentId}`, {
      headers: this.getHeaders()
    }).pipe(
      map(response => response.reports),
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
        return response?.permissions?.can?.accessAdminPanel === true;
      }),
      catchError(() => {
        return of(false);
      })
    );
  }

  /**
   * Verificar si el usuario puede gestionar reportes
   */
  canManageReports(): Observable<boolean> {
    return this.getUserPermissions().pipe(
      map(response => {
        return response?.permissions?.can?.manageReports === true ||
          response?.permissions?.permissions?.includes('moderate.reports.manage') === true;
      }),
      catchError(() => {
        return of(false);
      })
    );
  }

  // ===== MÉTODOS AUXILIARES PARA REPORTES =====

  /**
   * Obtener el texto de display para el motivo del reporte
   */
  getReasonDisplayText(reason: string): string {
    const reasonMap: { [key: string]: string } = {
      'inappropriate_language': 'Lenguaje inapropiado',
      'harassment': 'Acoso',
      'discrimination': 'Discriminación',
      'spam': 'Spam',
      'inappropriate_content': 'Contenido inapropiado',
      'violence_threats': 'Amenazas de violencia',
      'false_information': 'Información falsa',
      'hate_speech': 'Discurso de odio',
      'sexual_content': 'Contenido sexual',
      'copyright_violation': 'Violación de derechos de autor',
      'impersonation': 'Suplantación de identidad',
      'other': 'Otro'
    };
    return reasonMap[reason] || reason;
  }

  /**
   * Obtener el texto de display para el tipo de contenido
   */
  getContentTypeDisplayText(contentType: string): string {
    const typeMap: { [key: string]: string } = {
      'user': 'Perfil de usuario',
      'review': 'Reseña',
      'comment': 'Comentario',
      'list': 'Lista personalizada'
    };
    return typeMap[contentType] || contentType;
  }

  /**
   * Obtener el texto de display para la acción de resolución
   */
  getActionDisplayText(action: string): string {
    const actionMap: { [key: string]: string } = {
      'no_action': 'Sin acción',
      'content_deleted': 'Contenido eliminado',
      'user_warned': 'Usuario advertido',
      'user_banned': 'Usuario baneado',
      'other': 'Otra acción'
    };
    return actionMap[action] || action;
  }

  /**
   * Obtener la clase CSS para la prioridad del reporte
   */
  getPriorityClass(priority: string): string {
    const priorityClasses: { [key: string]: string } = {
      'low': 'priority-low',
      'medium': 'priority-medium',
      'high': 'priority-high',
      'urgent': 'priority-urgent'
    };
    return priorityClasses[priority] || 'priority-medium';
  }

  /**
   * Obtener la clase CSS para el estado del reporte
   */
  getStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'pending': 'status-pending',
      'under_review': 'status-under-review',
      'resolved': 'status-resolved',
      'dismissed': 'status-dismissed'
    };
    return statusClasses[status] || 'status-pending';
  }


  /**
 * Obtener métricas completas del dashboard
 */
getDashboardMetrics(timeRange: string = 'week'): Observable<DashboardMetrics> {
  return this.http.get<any>(`${this.apiUrl}/dashboard/metrics?timeRange=${timeRange}`, {
    headers: this.getHeaders() // ✅ AGREGADO: headers con autenticación
  })
    .pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error(response.message || 'Error obteniendo métricas');
      }),
      catchError(error => {
        console.error('Error obteniendo métricas del dashboard:', error);
        return throwError(() => new Error(error.error?.message || error.message || 'Error desconocido'));
      })
    );
}

/**
 * Obtener datos específicos para gráficas
 */
getChartData(type: string, timeRange: string = 'week'): Observable<any> {
  return this.http.get<any>(`${this.apiUrl}/dashboard/charts/${type}?timeRange=${timeRange}`, {
    headers: this.getHeaders() // ✅ AGREGADO: headers con autenticación
  })
    .pipe(
      map(response => {
        if (response.success) {
          return response.data;
        }
        throw new Error(response.message || 'Error obteniendo datos de gráfica');
      }),
      catchError(error => {
        console.error('Error obteniendo datos de gráfica:', error);
        return throwError(() => new Error(error.error?.message || error.message || 'Error desconocido'));
      })
    );
}

/**
 * Obtener métricas en tiempo real
 */
getRealtimeMetrics(): Observable<RealtimeMetrics> {
  return this.http.get<any>(`${this.apiUrl}/dashboard/realtime`, {
    headers: this.getHeaders() // ✅ AGREGADO: headers con autenticación
  })
    .pipe(
      map(response => {
        if (response.success) {
          return response.realtime;
        }
        throw new Error(response.message || 'Error obteniendo métricas en tiempo real');
      }),
      catchError(error => {
        console.error('Error obteniendo métricas en tiempo real:', error);
        return throwError(() => new Error(error.error?.message || error.message || 'Error desconocido'));
      })
    );
}


  // ==========================================
  // MÉTODOS AUXILIARES
  // ==========================================

  /**
   * Formatear números grandes (1000 -> 1K)
   */
  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  /**
   * Formatear porcentajes
   */
  formatPercentage(num: number): string {
    const sign = num > 0 ? '+' : '';
    return `${sign}${num}%`;
  }

  /**
   * Formatear tiempo en horas a formato legible
   */
  formatTime(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    }
    return `${Math.round(hours / 24)}d`;
  }


  /**
   * Obtener texto display para estados de reporte
   */
  getStatusDisplayText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pendiente',
      'under_review': 'En revisión',
      'resolved': 'Resuelto',
      'dismissed': 'Descartado'
    };
    return statusMap[status] || status;
  }
}