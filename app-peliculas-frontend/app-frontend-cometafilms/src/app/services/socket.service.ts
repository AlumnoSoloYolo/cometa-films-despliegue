import { Injectable } from '@angular/core';
import { environment } from '../../environments/environments';
import { AuthService } from './auth.service';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket: Socket | null = null;
  private connected = false;
  
  // Subjects para actividades
  private newActivitySubject = new BehaviorSubject<any>(null);
  private newFollowRequestSubject = new BehaviorSubject<any>(null);
  
  // Subjects para chat
  private newMessageSubject = new BehaviorSubject<any>(null);
  private userTypingSubject = new BehaviorSubject<any>(null);

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

    // Configurar URL de Socket.IO para producción
    const socketUrl = environment.production 
      ? `http://${window.location.hostname}:3000`
      : 'http://localhost:3000';

    console.log('🔌 Socket.IO: Intentando conectar a:', socketUrl);

    this.socket = io(socketUrl, {
      auth: {
        token: token
      },
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
      console.log('Socket.IO: ID de conexión:', this.socket?.id);
      this.connected = true;
      
      // Enviar test de conexión
      this.testConnection();
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO: Desconectado -', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.IO: Error de conexión', error);
      console.error('Socket.IO: URL intentada:', socketUrl);
      this.connected = false;
    });

    // Escuchar confirmación de conexión
    this.socket.on('connection_confirmed', (data) => {
      console.log('Socket.IO: Conexión confirmada por el servidor:', data);
    });

    // Escuchar respuesta de test
    this.socket.on('test_response', (data) => {
      console.log('Socket.IO: Respuesta de test recibida:', data);
    });

    // Escuchar nuevas actividades
    this.socket.on('new_activity', (activity) => {
      console.log('Socket.IO: Nueva actividad recibida', activity);
      this.newActivitySubject.next(activity);
    });

    // Escuchar nuevas solicitudes de seguimiento
    this.socket.on('follow_request', (request) => {
      console.log('Socket.IO: Nueva solicitud de seguimiento recibida', request);
      this.newFollowRequestSubject.next(request);

      this.showBrowserNotification(
        'Nueva solicitud de seguimiento',
        `${request.requester.username} quiere seguirte`
      );
    });

    // Eventos de chat
    this.socket.on('chat_message', (data) => {
      console.log('Socket.IO: Nuevo mensaje de chat recibido', data);
      this.newMessageSubject.next(data);

      // Mostrar notificación del navegador si el chat no está activo
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

    // Evento para indicador de "escribiendo"
    this.socket.on('user_typing', (data) => {
      console.log('Socket.IO: Usuario escribiendo:', data);
      this.userTypingSubject.next(data);
    });
  }

  private disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
  }

  // Función de test para verificar conectividad
  testConnection(): void {
    if (this.socket && this.connected) {
      console.log('Socket.IO: Enviando test de conexión...');
      this.socket.emit('test_connection', { 
        message: 'Test desde frontend', 
        timestamp: new Date().toISOString() 
      });
    }
  }

  // Métodos para chat
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

  // Obtener información del socket (simplificado para evitar errores TypeScript)
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

  // Getters para los observables
  get newActivity$(): Observable<any> {
    return this.newActivitySubject.asObservable();
  }

  get newFollowRequest$(): Observable<any> {
    return this.newFollowRequestSubject.asObservable();
  }

  get newMessage$(): Observable<any> {
    return this.newMessageSubject.asObservable();
  }

  get userTyping$(): Observable<any> {
    return this.userTypingSubject.asObservable();
  }

  isConnected(): boolean {
    return this.connected;
  }
}