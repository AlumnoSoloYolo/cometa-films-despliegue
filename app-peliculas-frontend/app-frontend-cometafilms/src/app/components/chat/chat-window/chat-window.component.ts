import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatService, Chat, ChatMessage } from '../../../services/chat.service';
import { SocketService } from '../../../services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './chat-window.component.html',
  styleUrl: './chat-window.component.css'
})
export class ChatWindowComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

  chat: Chat | null = null;
  messages: ChatMessage[] = [];
  loading = true;
  loadingMessages = false;
  messageText = '';
  isTyping = false;
  
  // Edición de mensajes
  editingMessage: ChatMessage | null = null;
  
  // Modal compartir película
  showMovieShareModal = false;
  movieSearchQuery = '';
  movieSearchResults: any[] = [];
  searchingMovies = false;
  
  private subscriptions: Subscription[] = [];
  private typingTimeout: any;
  private searchTimeout: any;
  private shouldScrollToBottom = true;

  constructor(
    private chatService: ChatService,
    private socketService: SocketService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const chatId = params['id'];
      if (chatId) {
        this.loadChat(chatId);
        this.loadMessages(chatId);
        this.joinChatRoom(chatId);
      }
    });
    
    this.setupSocketListeners();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  loadChat(chatId: string): void {
    this.loading = true;
    // Aquí necesitarías implementar un método para obtener un chat por ID
    // Por ahora, asumimos que tienes esta funcionalidad
  }

  loadMessages(chatId: string): void {
    this.loadingMessages = true;
    const sub = this.chatService.getChatMessages(chatId).subscribe({
      next: (response) => {
        this.messages = response.messages;
        this.loadingMessages = false;
        this.shouldScrollToBottom = true;
      },
      error: (error) => {
        console.error('Error al cargar mensajes:', error);
        this.loadingMessages = false;
      }
    });
    this.subscriptions.push(sub);
  }

  joinChatRoom(chatId: string): void {
    // Aquí emitirías el evento de unirse al chat via Socket.IO
    if (this.socketService.isConnected()) {
      // this.socketService.joinChat(chatId);
    }
  }

  setupSocketListeners(): void {
    const newMessageSub = this.socketService.newMessage$.subscribe(message => {
      if (message) {
        this.handleNewMessage(message);
      }
    });
    this.subscriptions.push(newMessageSub);
  }

  handleNewMessage(message: any): void {
    if (message.chatId === this.chat?._id) {
      this.messages.push(message.message);
      this.shouldScrollToBottom = true;
    }
  }

  sendMessage(): void {
    if (!this.messageText.trim() || !this.chat) return;

    if (this.editingMessage) {
      this.saveEditMessage();
      return;
    }

    const sub = this.chatService.sendTextMessage(this.chat._id, this.messageText.trim()).subscribe({
      next: (message) => {
        this.messages.push(message);
        this.messageText = '';
        this.shouldScrollToBottom = true;
      },
      error: (error) => {
        console.error('Error al enviar mensaje:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  startEditMessage(message: ChatMessage): void {
    this.editingMessage = message;
    this.messageText = message.text || '';
    setTimeout(() => {
      this.messageInput?.nativeElement.focus();
    }, 100);
  }

  saveEditMessage(): void {
    if (!this.editingMessage || !this.messageText.trim()) return;

    const sub = this.chatService.editMessage(this.editingMessage._id, this.messageText.trim()).subscribe({
      next: (updatedMessage) => {
        const index = this.messages.findIndex(m => m._id === this.editingMessage!._id);
        if (index !== -1) {
          this.messages[index] = updatedMessage;
        }
        this.cancelEdit();
      },
      error: (error) => {
        console.error('Error al editar mensaje:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  cancelEdit(): void {
    this.editingMessage = null;
    this.messageText = '';
  }

  deleteMessage(messageId: string): void {
    if (!confirm('¿Estás seguro de que quieres eliminar este mensaje?')) return;

    const sub = this.chatService.deleteMessage(messageId).subscribe({
      next: () => {
        this.messages = this.messages.filter(m => m._id !== messageId);
      },
      error: (error) => {
        console.error('Error al eliminar mensaje:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  handleTyping(): void {
    // Implementar lógica de "escribiendo..."
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    
    this.typingTimeout = setTimeout(() => {
      // Enviar evento de dejar de escribir
    }, 1000);
  }

  searchMovies(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    
    if (!this.movieSearchQuery.trim()) {
      this.movieSearchResults = [];
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.searchingMovies = true;
      // Aquí implementarías la búsqueda de películas
      // Usar el servicio de películas existente
      setTimeout(() => {
        this.movieSearchResults = [];
        this.searchingMovies = false;
      }, 500);
    }, 300);
  }

  shareMovie(movie: any): void {
    if (!this.chat) return;

    const movieData = {
      tmdbId: movie.id.toString(),
      title: movie.title,
      posterPath: movie.poster_path,
      year: this.getMovieYear(movie.release_date)
    };

    const sub = this.chatService.sendMovieMessage(this.chat._id, movieData).subscribe({
      next: (message) => {
        this.messages.push(message);
        this.showMovieShareModal = false;
        this.movieSearchQuery = '';
        this.movieSearchResults = [];
        this.shouldScrollToBottom = true;
      },
      error: (error) => {
        console.error('Error al compartir película:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  archiveChat(): void {
    if (!this.chat || !confirm('¿Archivar esta conversación?')) return;

    const sub = this.chatService.archiveChat(this.chat._id).subscribe({
      next: () => {
        // Navegar de vuelta a la lista de chats
      },
      error: (error) => {
        console.error('Error al archivar chat:', error);
      }
    });
    this.subscriptions.push(sub);
  }

  goToMovie(tmdbId?: string): void {
    if (tmdbId) {
      // Navegar a los detalles de la película
      // this.router.navigate(['/pelicula', tmdbId]);
    }
  }

  scrollToBottom(): void {
    try {
      const container = this.messagesContainer?.nativeElement;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {
      console.error('Error al hacer scroll:', err);
    }
  }

  isOwnMessage(message: ChatMessage): boolean {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    return message.sender._id === currentUser.id;
  }

  getAvatarPath(avatar: string): string {
    return this.chatService.getAvatarPath(avatar);
  }

  getMoviePosterUrl(posterPath?: string): string {
    return posterPath ? `https://image.tmdb.org/t/p/w200${posterPath}` : '/images/no-poster.jpg';
  }

  getMovieYear(releaseDate?: string): string {
    return releaseDate ? new Date(releaseDate).getFullYear().toString() : '';
  }

  formatMessageTime(date: Date | string): string {
    return this.chatService.formatMessageTime(date);
  }
}