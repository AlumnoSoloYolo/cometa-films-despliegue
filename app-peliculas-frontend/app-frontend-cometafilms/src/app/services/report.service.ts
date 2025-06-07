import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environments';
import { AuthService } from './auth.service';

export interface CreateReportRequest {
  reportedUserId: string;
  contentType: 'user' | 'review' | 'comment' | 'list';
  contentId?: string;
  reason: string;
  description?: string;
}

export interface Report {
  _id: string;
  reporter: {
    _id: string;
    username: string;
    avatar: string;
  };
  reportedUser: {
    _id: string;
    username: string;
    avatar: string;
    role: string;
    isBanned: boolean;
  };
  reportedContent: {
    contentType: string;
    contentId?: string;
    contentSnapshot?: {
      text?: string;
      title?: string;
      description?: string;
      rating?: number;
    };
  };
  reason: string;
  description?: string;
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  resolution?: {
    action: string;
    notes?: string;
    resolvedBy: {
      _id: string;
      username: string;
    };
    resolvedAt: string;
  };
  moderatorNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReportStats {
  summary: {
    total: number;
    pending: number;
    resolved: number;
    resolutionRate: string;
  };
  byStatus: Array<{ _id: string; count: number }>;
  byContentType: Array<{ _id: string; count: number }>;
  byReason: Array<{ _id: string; count: number }>;
  dailyTrend: Array<{ _id: string; count: number }>;
}

export interface ReportFilters {
  page?: number;
  limit?: number;
  status?: string;
  contentType?: string;
  priority?: string;
  reason?: string;
}

export interface ReportResponse {
  success: boolean;
  data: Report[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private readonly apiUrl = `${environment.apiUrl}/reports`;

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
    console.error('Error en ReportService:', error);

    let errorMessage = 'Error desconocido';

    if (error.error?.message) {
      errorMessage = error.error.message;
    } else if (error.status === 403) {
      errorMessage = 'No tienes permisos para realizar esta acción';
    } else if (error.status === 401) {
      errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente';
    } else if (error.status === 409) {
      errorMessage = 'Ya has reportado este contenido anteriormente';
    } else if (error.status === 404) {
      errorMessage = 'El usuario o contenido no fue encontrado';
    } else if (error.status === 400) {
      errorMessage = 'Datos del reporte inválidos';
    } else if (error.status === 500) {
      errorMessage = 'Error interno del servidor';
    }

    return throwError(() => new Error(errorMessage));
  }

  // CREAR REPORTE
  createReport(reportData: CreateReportRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}`, reportData, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // OBTENER REPORTES (ADMIN)
  getReports(filters: ReportFilters = {}): Observable<ReportResponse> {
    let params = new HttpParams();

    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    if (filters.status) params = params.set('status', filters.status);
    if (filters.contentType) params = params.set('contentType', filters.contentType);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.reason) params = params.set('reason', filters.reason);

    return this.http.get<ReportResponse>(`${this.apiUrl}`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  // RESOLVER REPORTE
  resolveReport(reportId: string, resolution: {
    action: string;
    notes?: string;
    deleteContent?: boolean;
  }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${reportId}/resolve`, resolution, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ACTUALIZAR ESTADO
  updateReportStatus(reportId: string, status: string, notes?: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${reportId}/status`, { status, notes }, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // ESTADÍSTICAS
  getReportStats(): Observable<{ success: boolean; data: ReportStats }> {
    return this.http.get<{ success: boolean; data: ReportStats }>(`${this.apiUrl}/stats`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // REPORTES POR USUARIO
  getReportsByUser(userId: string, page: number = 1, limit: number = 10): Observable<ReportResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<ReportResponse>(`${this.apiUrl}/user/${userId}`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  getReportsAgainstUser(userId: string, page: number = 1, limit: number = 10): Observable<ReportResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<ReportResponse>(`${this.apiUrl}/against/${userId}`, {
      headers: this.getHeaders(),
      params
    }).pipe(
      catchError(this.handleError)
    );
  }

  // REPORTES DE CONTENIDO ESPECÍFICO
  getReportsForContent(contentType: string, contentId: string): Observable<{ success: boolean; data: Report[]; count: number }> {
    return this.http.get<{ success: boolean; data: Report[]; count: number }>(`${this.apiUrl}/content/${contentType}/${contentId}`, {
      headers: this.getHeaders()
    }).pipe(
      catchError(this.handleError)
    );
  }

  // MÉTODOS AUXILIARES
  getReasonDisplayName(reason: string): string {
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

  getContentTypeDisplayName(contentType: string): string {
    const typeMap: { [key: string]: string } = {
      'user': 'Perfil de usuario',
      'review': 'Reseña',
      'comment': 'Comentario',
      'list': 'Lista personalizada'
    };
    return typeMap[contentType] || contentType;
  }

  getStatusDisplayName(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pendiente',
      'under_review': 'En revisión',
      'resolved': 'Resuelto',
      'dismissed': 'Desestimado'
    };
    return statusMap[status] || status;
  }

  getPriorityDisplayName(priority: string): string {
    const priorityMap: { [key: string]: string } = {
      'low': 'Baja',
      'medium': 'Media',
      'high': 'Alta',
      'urgent': 'Urgente'
    };
    return priorityMap[priority] || priority;
  }

  getPriorityColor(priority: string): string {
    const colorMap: { [key: string]: string } = {
      'low': '#10B981',      // verde
      'medium': '#F59E0B',   // amarillo
      'high': '#EF4444',     // rojo
      'urgent': '#DC2626'    // rojo oscuro
    };
    return colorMap[priority] || '#6B7280';
  }

  getStatusColor(status: string): string {
    const colorMap: { [key: string]: string } = {
      'pending': '#F59E0B',     // amarillo
      'under_review': '#3B82F6', // azul
      'resolved': '#10B981',     // verde
      'dismissed': '#6B7280'     // gris
    };
    return colorMap[status] || '#6B7280';
  }
}