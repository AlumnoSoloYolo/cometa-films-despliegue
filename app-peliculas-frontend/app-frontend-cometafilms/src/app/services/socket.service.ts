import { Injectable } from '@angular/core';
import { environment } from '../../environments/environments';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

// Interfaz para notificaciones del sistema
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

  // 🆕 NUEVOS Subjects específicos para reportes y notificaciones
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
      console.error('❌ No hay token disponible para conectar a Socket.IO');
      return;
    }

    // 🔧 CORREGIDO: URL dinámica para producción y desarrollo
    const socketUrl = environment.production
      ? environment.apiUrl  // Usar la URL del environment (tu backend de Vercel)
      : 'http://localhost:3000'; // Para desarrollo local

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
      rememberUpgrade: true,
      // 🔧 NUEVO: Configuraciones específicas para HTTPS/Vercel
      secure: environment.production, // true en producción para HTTPS
      rejectUnauthorized: false, // Para certificados de Vercel
      withCredentials: true
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.IO: Conectado exitosamente');
      this.connected = true;
      this.testConnection();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket.IO: Desconectado -', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Socket.IO: Error de conexión', error);
      this.connected = false;
      
      // 🔧 NUEVO: Log detallado del error para debugging
      if (environment.production) {
        console.error('🔍 URL de conexión:', socketUrl);
        console.error('🔍 Configuración:', {
          secure: environment.production,
          transports: ['websocket', 'polling']
        });
      }
    });

    // Listeners básicos
    this.socket.on('connection_confirmed', (data) => {
      console.log('✅ Socket.IO: Conexión confirmada por el servidor:', data);
    });

    this.socket.on('test_response', (data) => {
      console.log('✅ Socket.IO: Respuesta de test recibida:', data);
    });

    // Listeners existentes
    this.socket.on('new_activity', (activity) => {
      console.log('🎯 Socket.IO: Nueva actividad recibida', activity);
      this.newActivitySubject.next(activity);
    });

    this.socket.on('follow_request', (request) => {
      console.log('👥 Socket.IO: Nueva solicitud de seguimiento recibida', request);
      this.newFollowRequestSubject.next(request);
      this.showBrowserNotification(
        'Nueva solicitud de seguimiento',
        `${request.requester.username} quiere seguirte`
      );
    });

    this.socket.on('chat_message', (data) => {
      console.log('💬 Socket.IO: Nuevo mensaje de chat recibido', data);
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
      console.log('✍️ Socket.IO: Usuario escribiendo:', data);
      this.userTypingSubject.next(data);
    });

    // 🔥 LISTENER PRINCIPAL PARA NOTIFICACIONES DEL SISTEMA
    this.socket.on('system_notification', (notification) => {
      console.log('🔔 Socket.IO: Notificación del sistema recibida:', notification);

      try {
        // 📥 Procesar la notificación
        this.processSystemNotification(notification);

        // 📡 Emitir a los subjects correspondientes
        this.systemNotificationSubject.next(notification);

        // 🛡️ Si es una notificación de reporte, emitir específicamente
        if (this.isReportNotification(notification)) {
          console.log('🛡️ Notificación de reporte detectada');
          this.reportNotificationSubject.next(notification);
        }

        // ✅ Confirmar recepción al servidor
        this.socket?.emit('system_notification_received', {
          notificationId: notification.id,
          timestamp: new Date().toISOString()
        });

        // 🔔 Mostrar notificación del navegador
        this.showSystemNotification(notification);

        // 📱 Añadir a localStorage mediante el servicio de notificaciones
        this.addNotificationToStorage(notification);

      } catch (error) {
        console.error('❌ Error procesando notificación del sistema:', error);
      }
    });
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }

  // 🔥 NUEVO: Procesar notificaciones del sistema
  private processSystemNotification(notification: any): void {
    try {
      const systemNotification: SystemNotification = {
        id: notification.id || this.generateNotificationId(),
        type: notification.type || 'system_notification',
        data: notification.data || {},
        timestamp: notification.timestamp || new Date().toISOString(),
        read: false
      };

      // Incrementar contador de notificaciones no leídas
      const currentCount = this.unreadSystemNotificationsSubject.value;
      this.unreadSystemNotificationsSubject.next(currentCount + 1);

      console.log('📊 Notificación del sistema procesada. Contador:', currentCount + 1);

    } catch (error) {
      console.error('❌ Error procesando notificación del sistema:', error);
    }
  }

  // 🔥 NUEVO: Añadir notificación a localStorage
  private addNotificationToStorage(notification: any): void {
    try {
      // Intentar usar el servicio de notificaciones si está disponible
      const notificationService = (window as any).notificationService;
      if (notificationService && typeof notificationService.addNotification === 'function') {
        notificationService.addNotification(notification);
        return;
      }

      // Fallback: manejar directamente en localStorage
      const stored = localStorage.getItem('systemNotifications');
      const notifications = stored ? JSON.parse(stored) : [];

      const systemNotification = {
        id: notification.id || this.generateNotificationId(),
        type: notification.type || 'system_notification',
        data: notification.data || {},
        timestamp: notification.timestamp || new Date().toISOString(),
        read: false,
        receivedAt: new Date().toISOString()
      };

      // Verificar duplicados
      const exists = notifications.find((n: any) => n.id === systemNotification.id);
      if (!exists) {
        notifications.unshift(systemNotification);
        
        // Mantener solo las últimas 100 notificaciones
        const trimmed = notifications.slice(0, 100);
        
        localStorage.setItem('systemNotifications', JSON.stringify(trimmed));
        
        // Disparar evento para actualizar el header
        window.dispatchEvent(new CustomEvent('systemNotificationsUpdated', {
          detail: { count: trimmed.filter((n: any) => !n.read).length }
        }));

        console.log('💾 Notificación guardada en localStorage');
      }

    } catch (error) {
      console.error('❌ Error guardando notificación en storage:', error);
    }
  }

  // 🔥 NUEVO: Verificar si es una notificación de reporte
  private isReportNotification(notification: any): boolean {
    const reportTypes = [
      'report_status_update',
      'report_resolved',
      'content_deleted_by_report',
      'warning_by_report',
      'account_banned_by_report',
      'content_moderated'
    ];

    return reportTypes.includes(notification.data?.notificationType);
  }

  // Función de test existente
  testConnection(): void {
    if (this.socket && this.connected) {
      console.log('🧪 Socket.IO: Enviando test de conexión...');
      this.socket.emit('test_connection', {
        message: 'Test desde frontend',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Métodos de chat existentes
  joinChat(chatId: string): void {
    if (this.socket && this.connected) {
      console.log('🏠 Socket.IO: Uniéndose al chat:', chatId);
      this.socket.emit('join_chat', chatId);
    }
  }

  leaveChat(chatId: string): void {
    if (this.socket && this.connected) {
      console.log('🚪 Socket.IO: Saliendo del chat:', chatId);
      this.socket.emit('leave_chat', chatId);
    }
  }

  sendTypingIndicator(chatId: string, isTyping: boolean): void {
    if (this.socket && this.connected) {
      this.socket.emit('typing', { chatId, isTyping });
    }
  }

  // 🔥 MEJORADO: Marcar notificación del sistema como leída
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

      console.log('📖 Notificación marcada como leída:', notificationId);
    }
  }

  // 🔥 NUEVO: Marcar múltiples notificaciones como leídas
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

      console.log(`📖 ${notificationIds.length} notificaciones marcadas como leídas`);
    }
  }

  // 🔥 NUEVO: Limpiar contador de notificaciones
  clearNotificationCount(): void {
    this.unreadSystemNotificationsSubject.next(0);
    console.log('🧹 Contador de notificaciones limpiado');
  }

  // 🧪 NUEVO: Test de notificación del sistema
  testSystemNotification(): void {
    if (this.socket && this.connected) {
      console.log('🧪 Socket.IO: Solicitando notificación de prueba del sistema...');
      this.socket.emit('test_system_notification', {
        message: 'Prueba de notificación del sistema',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 🔔 Mostrar notificaciones del navegador (método existente mejorado)
  private showBrowserNotification(title: string, body: string): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'general-notification'
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, {
            body,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: 'general-notification'
          });
        }
      });
    }
  }

  // 🔔 NUEVO: Mostrar notificación del sistema
  private showSystemNotification(notification: any): void {
    const data = notification.data;
    if (!data) return;

    const title = data.title || 'Notificación del sistema';
    const message = data.message || '';

    // 🎨 Personalizar notificación según el tipo y severidad
    let finalTitle = title;
    let icon = '/favicon.ico';
    let requireInteraction = false;

    // 🛡️ Notificaciones de reportes
    if (data.notificationType?.includes('report')) {
      if (data.notificationType === 'report_resolved') {
        finalTitle = `✅ ${title}`;
      } else if (data.notificationType === 'content_deleted_by_report') {
        finalTitle = `🗑️ ${title}`;
        requireInteraction = true; // Importante que el usuario lo vea
      } else if (data.notificationType === 'warning_by_report') {
        finalTitle = `⚠️ ${title}`;
        requireInteraction = true;
      } else if (data.notificationType === 'account_banned_by_report') {
        finalTitle = `🚫 ${title}`;
        requireInteraction = true;
      } else {
        finalTitle = `🛡️ ${title}`;
      }
    } else {
      // 🎨 Otras notificaciones por severidad
      switch (data.severity) {
        case 'error':
          finalTitle = `🚨 ${title}`;
          requireInteraction = true;
          break;
        case 'warning':
          finalTitle = `⚠️ ${title}`;
          break;
        case 'success':
          finalTitle = `✅ ${title}`;
          break;
        case 'info':
          finalTitle = `ℹ️ ${title}`;
          break;
        default:
          finalTitle = `🔔 ${title}`;
      }
    }

    // 🔔 Mostrar la notificación
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(finalTitle, {
        body: message,
        icon,
        badge: icon,
        tag: `system-${notification.id}`,
        requireInteraction,
        silent: false
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      // Solicitar permisos si no están concedidos
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(finalTitle, {
            body: message,
            icon,
            badge: icon,
            tag: `system-${notification.id}`,
            requireInteraction
          });
        }
      });
    }
  }

  // 🔧 Método auxiliar para generar IDs
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 📊 Información del socket
  getSocketInfo(): any {
    if (this.socket) {
      return {
        connected: this.connected,
        id: this.socket.id,
        hasSocket: !!this.socket,
        url: environment.production ? environment.apiUrl : 'http://localhost:3000'
      };
    }
    return { connected: false };
  }

  // 🔗 Getters para los observables existentes
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

  // 🔗 NUEVOS: Getters para notificaciones de reportes
  get reportNotification$(): Observable<SystemNotification | null> {
    return this.reportNotificationSubject.asObservable();
  }

  get unreadSystemNotificationsCount$(): Observable<number> {
    return this.unreadSystemNotificationsSubject.asObservable();
  }

  // 🔗 Getter para estado de conexión
  isConnected(): boolean {
    return this.connected;
  }
}
