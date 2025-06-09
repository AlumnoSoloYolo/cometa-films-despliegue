import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { catchError, EMPTY } from 'rxjs';

import { UserSocialService } from '../../services/social.service';
import { SocketService } from '../../services/socket.service';

interface FollowRequest {
  _id: string;
  requester: {
    _id: string;
    username: string;
    avatar: string;
  };
  createdAt: string;
}

type TabType = 'solicitudes' | 'notificaciones';

export interface SystemNotification {
  id: string;
  type: string;
  data: {
    notificationType: string;
    title: string;
    message: string;
    reason?: string;
    severity: 'info' | 'warning' | 'error' | 'success';
    category: string;
    actionRequired: boolean;
    metadata?: any;
  };
  timestamp: string;
  read: boolean;
}

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notificaciones.component.html',
  styleUrl: './notificaciones.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificacionesComponent implements OnInit, OnDestroy {
  followRequests: FollowRequest[] = [];
  cargando = false;
  activeTab: TabType = 'solicitudes';
  systemNotifications: SystemNotification[] = [];
  loadingSystemNotifications = false;

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly userSocialService: UserSocialService,
    private readonly socketService: SocketService,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cargarSolicitudes();
    this.setupSocketListener();
    this.setupSystemNotificationListener();
    this.loadStoredSystemNotifications();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  cambiarTab(tab: TabType): void {
    this.activeTab = tab;

    if (tab === 'solicitudes') {
      this.cargarSolicitudes();
    } else if (tab === 'notificaciones') {
      this.loadStoredSystemNotifications();
    }

    this.cdr.markForCheck();
  }

  aceptarSolicitud(requestId: string): void {
    const acceptSub = this.userSocialService.acceptFollowRequest(requestId)
      .pipe(
        catchError(error => {
          console.error('Error al aceptar solicitud:', error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.followRequests = this.followRequests.filter(req => req._id !== requestId);
        this.emitirCambioContador();
        this.cdr.markForCheck();
      });

    this.subscriptions.add(acceptSub);
  }

  rechazarSolicitud(requestId: string): void {
    const rejectSub = this.userSocialService.rejectFollowRequest(requestId)
      .pipe(
        catchError(error => {
          console.error('Error al rechazar solicitud:', error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.followRequests = this.followRequests.filter(req => req._id !== requestId);
        this.emitirCambioContador();
        this.cdr.markForCheck();
      });

    this.subscriptions.add(rejectSub);
  }

  getAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }

  private cargarSolicitudes(): void {
    this.cargando = true;
    this.cdr.markForCheck();

    const loadSub = this.userSocialService.getPendingFollowRequests()
      .pipe(
        catchError(error => {
          console.error('Error al cargar solicitudes de seguimiento:', error);
          this.cargando = false;
          this.cdr.markForCheck();
          return EMPTY;
        })
      )
      .subscribe(solicitudes => {
        this.followRequests = solicitudes;
        this.cargando = false;
        this.emitirCambioContador();
        this.cdr.markForCheck();
      });

    this.subscriptions.add(loadSub);
  }

  private setupSocketListener(): void {
    const socketSub = this.socketService.newFollowRequest$
      .pipe(
        catchError(error => {
          console.error('Error en socket de solicitudes:', error);
          return EMPTY;
        })
      )
      .subscribe(request => {
        if (request) {
          const existingIndex = this.followRequests.findIndex(r => r._id === request.requestId);

          if (existingIndex === -1) {
            this.followRequests.unshift({
              _id: request.requestId,
              requester: request.requester,
              createdAt: request.timestamp
            });

            this.emitirCambioContador();
            this.cdr.markForCheck();
          }
        }
      });

    this.subscriptions.add(socketSub);
  }

  private emitirCambioContador(): void {
    const event = new CustomEvent('updateNotificationCount', {
      detail: { count: this.followRequests.length }
    });
    window.dispatchEvent(event);
  }

  // ===== MANEJO DE NOTIFICACIONES DEL SISTEMA MEJORADO =====

  private setupSystemNotificationListener(): void {
    const systemNotificationSub = this.socketService.systemNotification$
      .pipe(
        catchError(error => {
          console.error('Error en socket de notificaciones del sistema:', error);
          return EMPTY;
        })
      )
      .subscribe(notification => {
        if (notification) {
          console.log('Nueva notificación del sistema recibida:', notification);

          // Añadir a la lista de notificaciones del sistema
          const systemNotification: SystemNotification = {
            id: notification.id,
            type: notification.type,
            data: notification.data,
            timestamp: notification.timestamp,
            read: false
          };

          // Añadir al principio de la lista
          this.systemNotifications.unshift(systemNotification);

          // Limitar a las últimas 50 notificaciones
          if (this.systemNotifications.length > 50) {
            this.systemNotifications = this.systemNotifications.slice(0, 50);
          }

          // Guardar en localStorage para persistencia
          this.saveSystemNotificationsToStorage();

          this.cdr.markForCheck();
        }
      });

    this.subscriptions.add(systemNotificationSub);
  }

  // ===== PERSISTENCIA DE NOTIFICACIONES =====

  private loadStoredSystemNotifications(): void {
    try {
      const stored = localStorage.getItem('systemNotifications');
      if (stored) {
        this.systemNotifications = JSON.parse(stored);
        console.log(`Cargadas ${this.systemNotifications.length} notificaciones del sistema desde localStorage`);
      }
    } catch (error) {
      console.error('Error cargando notificaciones del sistema:', error);
      this.systemNotifications = [];
    }
    this.cdr.markForCheck();
  }

  private saveSystemNotificationsToStorage(): void {
    try {
      localStorage.setItem('systemNotifications', JSON.stringify(this.systemNotifications));
    } catch (error) {
      console.error('Error guardando notificaciones del sistema:', error);
    }
  }

  // ===== ACCIONES DE NOTIFICACIONES DEL SISTEMA =====

  markSystemNotificationAsRead(notificationId: string): void {
    const notification = this.systemNotifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.socketService.markSystemNotificationAsRead(notificationId);
      this.saveSystemNotificationsToStorage();
      this.cdr.markForCheck();
    }
  }

  markAllSystemNotificationsAsRead(): void {
    const unreadNotifications = this.systemNotifications.filter(n => !n.read);
    unreadNotifications.forEach(notification => {
      notification.read = true;
      this.socketService.markSystemNotificationAsRead(notification.id);
    });
    this.saveSystemNotificationsToStorage();
    this.cdr.markForCheck();
  }

  clearSystemNotifications(): void {
    this.systemNotifications = [];
    this.saveSystemNotificationsToStorage();
    this.cdr.markForCheck();
  }

  // ===== MÉTODOS DE FORMATEO MEJORADOS =====

  getSystemNotificationIcon(notification: SystemNotification): string {
    const type = notification.data.notificationType;
    const severity = notification.data.severity;
    const category = notification.data.category;

    // Iconos específicos para reportes
    if (category === 'reports') {
      switch (type) {
        case 'report_resolved': return 'bi-shield-check';
        case 'report_status_update': return 'bi-shield-exclamation';
        default: return 'bi-flag';
      }
    }

    // Iconos específicos para moderación
    if (category === 'moderation') {
      switch (type) {
        case 'content_moderated':
        case 'content_deleted_by_report': return 'bi-shield-exclamation';
        case 'warning_by_report':
        case 'account_warning': return 'bi-exclamation-triangle';
        default: return 'bi-shield';
      }
    }

    // Iconos para cuenta
    if (category === 'account') {
      switch (type) {
        case 'account_banned': return 'bi-person-x';
        case 'role_changed': return 'bi-person-badge';
        default: return 'bi-person-gear';
      }
    }

    // Iconos por severidad como fallback
    switch (severity) {
      case 'error': return 'bi-x-circle';
      case 'warning': return 'bi-exclamation-triangle';
      case 'success': return 'bi-check-circle';
      case 'info':
      default: return 'bi-info-circle';
    }
  }

  getSystemNotificationColor(notification: SystemNotification): string {
    const severity = notification.data.severity;
    const category = notification.data.category;

    // Colores específicos para categorías
    if (category === 'reports') {
      return '#3B82F6'; // Azul para reportes
    }

    if (category === 'moderation') {
      return severity === 'error' ? '#EF4444' : '#F59E0B'; // Rojo para errores, amarillo para moderación
    }

    // Colores por severidad
    switch (severity) {
      case 'error': return '#EF4444';   // Rojo
      case 'warning': return '#F59E0B'; // Amarillo
      case 'success': return '#10B981'; // Verde
      case 'info':
      default: return '#3B82F6';       // Azul
    }
  }

  formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return minutes <= 1 ? 'Hace un momento' : `Hace ${minutes} min`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `Hace ${hours}h`;
    } else if (diffInHours < 168) { // 7 días
      const days = Math.floor(diffInHours / 24);
      return `Hace ${days}d`;
    } else {
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: diffInHours > 8760 ? 'numeric' : undefined // Mostrar año solo si es más de un año
      });
    }
  }

  // ===== MÉTODOS PARA FORMATEAR CONTENIDO DE REPORTES =====

  getNotificationDisplayMessage(notification: SystemNotification): string {
    const data = notification.data;
    const metadata = data.metadata;

    // Para notificaciones de reportes resueltos, agregar contexto
    if (data.notificationType === 'report_resolved' && metadata) {
      const contentType = this.getContentTypeDisplayText(metadata.reportedContentType);
      const action = this.getActionDisplayText(metadata.action);

      return `${data.message} Tipo: ${contentType}. Acción: ${action}.`;
    }

    // Para notificaciones de contenido eliminado por reporte
    if (data.notificationType === 'content_deleted_by_report' && metadata) {
      const reason = this.getReportReasonDisplayText(metadata.reportReason);
      return `${data.message} Motivo del reporte: ${reason}.`;
    }

    // Para otras notificaciones, usar el mensaje original
    return data.message;
  }

  public getContentTypeDisplayText(contentType: string): string {
    const typeMap: { [key: string]: string } = {
      'user': 'Perfil de usuario',
      'review': 'Reseña',
      'comment': 'Comentario',
      'list': 'Lista personalizada'
    };
    return typeMap[contentType] || contentType;
  }

  public getActionDisplayText(action: string): string {
    const actionMap: { [key: string]: string } = {
      'no_action': 'Sin acción',
      'content_deleted': 'Contenido eliminado',
      'user_warned': 'Usuario advertido',
      'user_banned': 'Usuario baneado',
      'other': 'Otra acción'
    };
    return actionMap[action] || action;
  }

  public getReportReasonDisplayText(reason: string): string {
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

  // ===== MÉTODOS PARA GESTIÓN AVANZADA =====

  onSystemNotificationClick(notification: SystemNotification): void {
    // Marcar como leída al hacer clic
    if (!notification.read) {
      this.markSystemNotificationAsRead(notification.id);
    }

    // Navegación específica según el tipo de notificación
    const data = notification.data;
    const metadata = data.metadata;

    // Para reportes, podrías navegar a una página específica
    if (data.category === 'reports' && metadata?.reportId) {
      // Aquí podrías navegar a una vista detallada del reporte si la tienes
      console.log('Clic en notificación de reporte:', metadata.reportId);
    }

    // Para moderación de contenido, mostrar más detalles
    if (data.category === 'moderation') {
      console.log('Clic en notificación de moderación:', data);
    }
  }

  getUnreadSystemNotificationsCount(): number {
    return this.systemNotifications.filter(n => !n.read).length;
  }

  hasSystemNotifications(): boolean {
    return this.systemNotifications.length > 0;
  }
}