import { Injectable } from '@angular/core';
import { environment } from '../../environments/environments';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

// Interfaz para notificaciones 
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

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  private connected = false;

  // Subjects para actividades existentes
  private newActivitySubject = new BehaviorSubject<any>(null);
  private newFollowRequestSubject = new BehaviorSubject<any>(null);
  private systemNotificationSubject = new BehaviorSubject<any>(null);

  // Subjects para chat existentes
  private newMessageSubject = new BehaviorSubject<any>(null);
  private userTypingSubject = new BehaviorSubject<any>(null);

  // NUEVOS: Subjects específicos para reportes
  private reportNotificationSubject = new BehaviorSubject<SystemNotification | null>(null);
  private unreadSystemNotificationsSubject = new BehaviorSubject<number>(0);

  constructor(private authService: AuthService) {
    this.authService.currentUser.subscribe(user => {
      if (user) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  private connect(): void {
    if (this.connected) {
      return;
    }

    const token = this.authService.getToken();
    if (!token) {
      console.error('No hay token disponible para conectar a Socket.IO');
      return;
    }

    const socketUrl = environment.production
      ? `http://${window.location.hostname}:3000`
      : 'http://localhost:3000';

    console.log('🔌 Socket.IO: Intentando conectar a:', socketUrl);

    this.socket = io(socketUrl, {
      auth: { token: token },
      transports: ['websocket', 'polling'],
      timeout: 30000,
      forceNew: true,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      upgrade: true,
      rememberUpgrade: true
    });

    this.socket.on('connect', () => {
      console.log('Socket.IO: Conectado exitosamente');
      this.connected = true;
      this.testConnection();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO: Desconectado -', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO: Error de conexión', error);
      this.connected = false;
    });

    // Listeners existentes
    this.socket.on('connection_confirmed', (data) => {
      console.log('Socket.IO: Conexión confirmada por el servidor:', data);
    });

    this.socket.on('test_response', (data) => {
      console.log('Socket.IO: Respuesta de test recibida:', data);
    });

    this.socket.on('new_activity', (activity) => {
      console.log('Socket.IO: Nueva actividad recibida', activity);
      this.newActivitySubject.next(activity);
    });

    this.socket.on('follow_request', (request) => {
      console.log('Socket.IO: Nueva solicitud de seguimiento recibida', request);
      this.newFollowRequestSubject.next(request);
      this.showBrowserNotification(
        'Nueva solicitud de seguimiento',
        `${request.requester.username} quiere seguirte`
      );
    });

    this.socket.on('chat_message', (data) => {
      console.log('Socket.IO: Nuevo mensaje de chat recibido', data);
      this.newMessageSubject.next(data);

      if (data.message && data.chat && data.chat.otherParticipant) {
        const messagePreview = data.message.messageType === 'movie'
          ? ` ${data.message.movieData?.title}`
          : data.message.text || 'Nuevo mensaje';

        this.showBrowserNotification(
          `Mensaje de ${data.chat.otherParticipant.username}`,
          messagePreview
        );
      }
    });

    this.socket.on('user_typing', (data) => {
      console.log('Socket.IO: Usuario escribiendo:', data);
      this.userTypingSubject.next(data);
    });

    // MEJORADO: Listener para notificaciones del sistema
    this.socket.on('system_notification', (notification) => {
      console.log('Socket.IO: Notificación del sistema recibida:', notification);

      // Procesar la notificación
      this.processSystemNotification(notification);

      // Emitir a los subjects correspondientes
      this.systemNotificationSubject.next(notification);

      // Si es una notificación de reporte, emitir específicamente
      if (this.isReportNotification(notification)) {
        this.reportNotificationSubject.next(notification);
      }

      // Confirmar recepción al servidor
      this.socket?.emit('system_notification_received', {
        notificationId: notification.id,
        timestamp: new Date().toISOString()
      });

      // Mostrar notificación del navegador
      this.showSystemNotification(notification);
    });
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }

  // NUEVO: Procesar notificaciones del sistema
  private processSystemNotification(notification: any): void {
    try {
      const systemNotification: SystemNotification = {
        id: notification.id,
        type: notification.type,
        data: notification.data,
        timestamp: notification.timestamp,
        read: false
      };

      // Incrementar contador de notificaciones no leídas
      const currentCount = this.unreadSystemNotificationsSubject.value;
      this.unreadSystemNotificationsSubject.next(currentCount + 1);

      console.log('Notificación del sistema procesada:', systemNotification);

    } catch (error) {
      console.error('Error procesando notificación del sistema:', error);
    }
  }

  // NUEVO: Verificar si es una notificación de reporte
  private isReportNotification(notification: any): boolean {
    const reportTypes = [
      'report_status_update',
      'report_resolved',
      'content_moderated',
      'account_banned_report',
      'account_warning_report'
    ];

    return reportTypes.includes(notification.data?.notificationType);
  }

  // Función de test existente
  testConnection(): void {
    if (this.socket && this.connected) {
      console.log('Socket.IO: Enviando test de conexión...');
      this.socket.emit('test_connection', {
        message: 'Test desde frontend',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Métodos de chat existentes
  joinChat(chatId: string): void {
    if (this.socket && this.connected) {
      console.log('Socket.IO: Uniéndose al chat:', chatId);
      this.socket.emit('join_chat', chatId);
    }
  }

  leaveChat(chatId: string): void {
    if (this.socket && this.connected) {
      console.log('Socket.IO: Saliendo del chat:', chatId);
      this.socket.emit('leave_chat', chatId);
    }
  }

  sendTypingIndicator(chatId: string, isTyping: boolean): void {
    if (this.socket && this.connected) {
      this.socket.emit('typing', { chatId, isTyping });
    }
  }

  // MEJORADO: Marcar notificación del sistema como leída
  markSystemNotificationAsRead(notificationId: string): void {
    if (this.socket && this.connected) {
      this.socket.emit('mark_notification_read', {
        notificationId: notificationId,
        timestamp: new Date().toISOString()
      });

      // Decrementar contador de notificaciones no leídas
      const currentCount = this.unreadSystemNotificationsSubject.value;
      if (currentCount > 0) {
        this.unreadSystemNotificationsSubject.next(currentCount - 1);
      }
    }
  }

  // NUEVO: Marcar múltiples notificaciones como leídas
  markMultipleNotificationsAsRead(notificationIds: string[]): void {
    if (this.socket && this.connected) {
      notificationIds.forEach(id => {
        this.socket?.emit('mark_notification_read', {
          notificationId: id,
          timestamp: new Date().toISOString()
        });
      });

      // Decrementar contador
      const currentCount = this.unreadSystemNotificationsSubject.value;
      const newCount = Math.max(0, currentCount - notificationIds.length);
      this.unreadSystemNotificationsSubject.next(newCount);
    }
  }

  // NUEVO: Limpiar contador de notificaciones
  clearNotificationCount(): void {
    this.unreadSystemNotificationsSubject.next(0);
  }

  testSystemNotification(): void {
    if (this.socket && this.connected) {
      console.log('Socket.IO: Solicitando notificación de prueba del sistema...');
      this.socket.emit('test_system_notification', {
        message: 'Prueba de notificación del sistema',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Mostrar notificaciones del navegador
  private showBrowserNotification(title: string, body: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico'
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico'
          });
        }
      });
    }
  }

  private showSystemNotification(notification: any): void {
    const data = notification.data;
    if (!data) return;

    const title = data.title || 'Notificación del sistema';
    const message = data.message || '';

    // Personalizar notificación según el tipo
    let finalTitle = title;
    let icon = '/favicon.ico';

    if (data.notificationType?.includes('report')) {
      finalTitle = `🛡️ ${title}`;

      if (data.severity === 'error') {
        finalTitle = `🚫 ${title}`;
      } else if (data.severity === 'warning') {
        finalTitle = `⚠️ ${title}`;
      } else if (data.severity === 'success') {
        finalTitle = `✅ ${title}`;
      }
    }

    this.showBrowserNotification(finalTitle, message);
  }

  getSocketInfo(): any {
    if (this.socket) {
      return {
        connected: this.connected,
        id: this.socket.id,
        hasSocket: !!this.socket
      };
    }
    return { connected: false };
  }

  // Getters para los observables existentes
  get newActivity$(): Observable<any> {
    return this.newActivitySubject.asObservable();
  }

  get newFollowRequest$(): Observable<any> {
    return this.newFollowRequestSubject.asObservable();
  }

  get systemNotification$(): Observable<any> {
    return this.systemNotificationSubject.asObservable();
  }

  get newMessage$(): Observable<any> {
    return this.newMessageSubject.asObservable();
  }

  get userTyping$(): Observable<any> {
    return this.userTypingSubject.asObservable();
  }

  // NUEVOS: Getters para notificaciones de reportes
  get reportNotification$(): Observable<SystemNotification | null> {
    return this.reportNotificationSubject.asObservable();
  }

  get unreadSystemNotificationsCount$(): Observable<number> {
    return this.unreadSystemNotificationsSubject.asObservable();
  }

  isConnected(): boolean {
    return this.connected;
  }
}