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
    severity: 'info' | 'warning' | 'error';
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
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  cambiarTab(tab: TabType): void {
    this.activeTab = tab;

    if (tab === 'solicitudes') {
      this.cargarSolicitudes();
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

          this.cdr.markForCheck();
        }
      });

    this.subscriptions.add(systemNotificationSub);
  }

  // Añadir métodos para manejar notificaciones del sistema:
  markSystemNotificationAsRead(notificationId: string): void {
    const notification = this.systemNotifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.socketService.markSystemNotificationAsRead(notificationId);
      this.cdr.markForCheck();
    }
  }

  markAllSystemNotificationsAsRead(): void {
    const unreadNotifications = this.systemNotifications.filter(n => !n.read);
    unreadNotifications.forEach(notification => {
      notification.read = true;
      this.socketService.markSystemNotificationAsRead(notification.id);
    });
    this.cdr.markForCheck();
  }

  clearSystemNotifications(): void {
    this.systemNotifications = [];
    this.cdr.markForCheck();
  }

  getSystemNotificationIcon(notification: SystemNotification): string {
    const type = notification.data.notificationType;
    const severity = notification.data.severity;

    if (type === 'content_moderated') return 'bi-shield-exclamation';
    if (type === 'account_banned') return 'bi-person-x';
    if (type === 'account_warning') return 'bi-exclamation-triangle';
    if (type === 'role_changed') return 'bi-person-badge';

    if (severity === 'error') return 'bi-x-circle';
    if (severity === 'warning') return 'bi-exclamation-triangle';

    return 'bi-info-circle';
  }

  getSystemNotificationColor(notification: SystemNotification): string {
    const severity = notification.data.severity;

    switch (severity) {
      case 'error': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'info':
      default: return '#3B82F6';
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
    } else {
      const days = Math.floor(diffInHours / 24);
      return `Hace ${days}d`;
    }
  }
}