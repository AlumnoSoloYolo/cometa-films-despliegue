import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environments';

export interface ChatMessage {
  _id: string;
  chat: string;
  sender: {
    _id: string;
    username: string;
    avatar: string;
  };
  text?: string;
  messageType: 'text' | 'movie';
  movieData?: {
    tmdbId: string;
    title: string;
    posterPath: string;
    year: string;
  };
  readBy: Array<{
    user: string;
    readAt: Date;
  }>;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Chat {
  _id: string;
  participants: Array<{
    _id: string;
    username: string;
    avatar: string;
  }>;
  chatType: 'private';
  lastMessage?: ChatMessage;
  lastActivity: Date;
  otherParticipant: {
    _id: string;
    username: string;
    avatar: string;
  };
  unreadCount: number;
}

export interface ChatListResponse {
  chats: Chat[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface MessagesResponse {
  messages: ChatMessage[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = environment.apiUrl + '/chat';
  
  // Subject para notificar nuevos mensajes
  private newMessageSubject = new BehaviorSubject<ChatMessage | null>(null);
  public newMessage$ = this.newMessageSubject.asObservable();
  
  // Subject para notificar cambios en la lista de chats
  private chatsUpdatedSubject = new BehaviorSubject<boolean>(false);
  public chatsUpdated$ = this.chatsUpdatedSubject.asObservable();

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

  // Obtener todos los chats del usuario
  getUserChats(page: number = 1, limit: number = 20): Observable<ChatListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<ChatListResponse>(
      `${this.apiUrl}/chats`,
      { headers: this.getHeaders().headers, params }
    );
  }

  // Obtener o crear un chat con otro usuario
  getOrCreateChat(otherUserId: string): Observable<Chat> {
    return this.http.get<Chat>(
      `${this.apiUrl}/chats/${otherUserId}/get-or-create`,
      this.getHeaders()
    );
  }

  // Obtener mensajes de un chat
  getChatMessages(chatId: string, page: number = 1, limit: number = 50): Observable<MessagesResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());

    return this.http.get<MessagesResponse>(
      `${this.apiUrl}/chats/${chatId}/messages`,
      { headers: this.getHeaders().headers, params }
    );
  }

  // Enviar mensaje de texto
  sendTextMessage(chatId: string, text: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      `${this.apiUrl}/chats/${chatId}/messages`,
      { text, messageType: 'text' },
      this.getHeaders()
    );
  }

  // Enviar mensaje con película
  sendMovieMessage(chatId: string, movieData: {
    tmdbId: string;
    title: string;
    posterPath: string;
    year: string;
  }): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      `${this.apiUrl}/chats/${chatId}/messages`,
      { messageType: 'movie', movieData },
      this.getHeaders()
    );
  }

  // Editar mensaje
  editMessage(messageId: string, text: string): Observable<ChatMessage> {
    return this.http.put<ChatMessage>(
      `${this.apiUrl}/messages/${messageId}`,
      { text },
      this.getHeaders()
    );
  }

  // Eliminar mensaje
  deleteMessage(messageId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/messages/${messageId}`,
      this.getHeaders()
    );
  }

  // Archivar chat
  archiveChat(chatId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/chats/${chatId}/archive`,
      {},
      this.getHeaders()
    );
  }

  // Métodos para manejar eventos de Socket.IO desde el componente
  handleNewMessage(message: ChatMessage): void {
    this.newMessageSubject.next(message);
    this.chatsUpdatedSubject.next(true);
  }

  // Obtener avatar path
  getAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }

  // Formatear fecha para mostrar en chat
  formatMessageTime(date: Date | string): string {
    const messageDate = new Date(date);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Ahora';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}min`;
    } else if (diffInMinutes < 1440) { // 24 horas
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h`;
    } else {
      return messageDate.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short' 
      });
    }
  }

  // Formatear fecha para mostrar hora completa
  formatFullTime(date: Date | string): string {
    const messageDate = new Date(date);
    const now = new Date();
    const isToday = messageDate.toDateString() === now.toDateString();
    
    if (isToday) {
      return messageDate.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return messageDate.toLocaleDateString('es-ES', { 
        day: 'numeric', 
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  // Obtener información de un chat específico
  getChatById(chatId: string): Observable<Chat> {
    return this.http.get<Chat>(
      `${this.apiUrl}/chats/${chatId}`,
      this.getHeaders()
    );
  }

  // Buscar en mensajes
  searchMessages(chatId: string, query: string): Observable<ChatMessage[]> {
    const params = new HttpParams().set('q', query);
    
    return this.http.get<ChatMessage[]>(
      `${this.apiUrl}/chats/${chatId}/search`,
      { headers: this.getHeaders().headers, params }
    );
  }

  // Obtener estadísticas del chat
  getChatStats(chatId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/chats/${chatId}/stats`,
      this.getHeaders()
    );
  }

  // Marcar mensajes como leídos
  markMessagesAsRead(chatId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/chats/${chatId}/mark-read`,
      {},
      this.getHeaders()
    );
  }

  // Obtener chats archivados
  getArchivedChats(page: number = 1, limit: number = 20): Observable<ChatListResponse> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('archived', 'true');

    return this.http.get<ChatListResponse>(
      `${this.apiUrl}/chats/archived`,
      { headers: this.getHeaders().headers, params }
    );
  }

  // Desarchivar chat
  unarchiveChat(chatId: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/chats/${chatId}/unarchive`,
      {},
      this.getHeaders()
    );
  }

  // Limpiar historial de chat
  clearChatHistory(chatId: string): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/chats/${chatId}/clear`,
      this.getHeaders()
    );
  }

  // Exportar chat
  exportChat(chatId: string, format: 'json' | 'txt' = 'json'): Observable<Blob> {
    const params = new HttpParams().set('format', format);
    
    return this.http.get(
      `${this.apiUrl}/chats/${chatId}/export`,
      { 
        headers: this.getHeaders().headers, 
        params,
        responseType: 'blob'
      }
    );
  }

  // Verificar si el usuario puede enviar mensajes
  canSendMessage(chatId: string): Observable<{ canSend: boolean, reason?: string }> {
    return this.http.get<{ canSend: boolean, reason?: string }>(
      `${this.apiUrl}/chats/${chatId}/can-send`,
      this.getHeaders()
    );
  }

  // Reportar chat
  reportChat(chatId: string, reason: string, description?: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/chats/${chatId}/report`,
      { reason, description },
      this.getHeaders()
    );
  }

  // Obtener información de entrega de mensajes
  getMessageDeliveryInfo(messageId: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/messages/${messageId}/delivery`,
      this.getHeaders()
    );
  }

  // Helpers para UI
  isMessageFromCurrentUser(message: ChatMessage): boolean {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    return message.sender._id === currentUser.id;
  }

  getMessageStatusIcon(message: ChatMessage): string {
    if (!this.isMessageFromCurrentUser(message)) return '';
    
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isRead = message.readBy.some(read => read.user !== currentUser.id);
    
    if (isRead) return 'bi-check-all text-primary';
    return 'bi-check text-muted';
  }

  // Validaciones
  isValidMessage(text: string): boolean {
    return text && text.trim().length > 0 && text.trim().length <= 1000 ? true : false;
  }

  canEditMessage(message: ChatMessage): boolean {
    if (!this.isMessageFromCurrentUser(message)) return false;
    if (message.messageType !== 'text') return false;
    
    const messageDate = new Date(message.createdAt);
    const now = new Date();
    const diffInMinutes = (now.getTime() - messageDate.getTime()) / (1000 * 60);
    
    return diffInMinutes <= 15; // Solo se puede editar en los primeros 15 minutos
  }

  canDeleteMessage(message: ChatMessage): boolean {
    if (!this.isMessageFromCurrentUser(message)) return false;
    
    const messageDate = new Date(message.createdAt);
    const now = new Date();
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);
    
    return diffInHours <= 24; // Solo se puede eliminar en las primeras 24 horas
  }
}