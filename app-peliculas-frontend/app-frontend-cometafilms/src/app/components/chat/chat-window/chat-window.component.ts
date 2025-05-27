import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatService, Chat, ChatMessage } from '../../../services/chat.service';
import { SocketService } from '../../../services/socket.service';
import { PeliculasService } from '../../../services/peliculas.service';
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
  currentChatId: string = '';
  
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
    private peliculasService: PeliculasService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const chatId = params['id'];
      if (chatId) {
        this.currentChatId = chatId;
        console.log('Iniciando carga para chat:', chatId);
        this.loadChatAndMessages(chatId);
        this.joinChatRoom(chatId);
      }
    });
    
    this.setupSocketListeners();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    
    // Salir del chat room
    if (this.currentChatId) {
      this.socketService.leaveChat(this.currentChatId);
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  loadChatAndMessages(chatId: string): void {
    this.loading = true;
    console.log('🔄 Cargando chat y mensajes para:', chatId);
    
    // Primero cargar la lista de chats para obtener info del chat
    const sub = this.chatService.getUserChats().subscribe({
      next: (response) => {
        console.log('📋 Chats obtenidos:', response.chats.length);
        const foundChat = response.chats.find(c => c._id === chatId);
        
        if (foundChat) {
          this.chat = foundChat;
          console.log('✅ Chat encontrado:', this.chat);
          
          // Ahora cargar los mensajes
          this.loadMessages(chatId);
        } else {
          console.warn('⚠️ Chat no encontrado en la lista');
          // Intentar cargar mensajes de todas formas
          this.loadMessages(chatId);
        }
        
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error al obtener chats:', error);
        // Intentar cargar mensajes de todas formas
        this.loadMessages(chatId);
        this.loading = false;
      }
    });
    this.subscriptions.push(sub);
  }

  loadMessages(chatId: string): void {
    this.loadingMessages = true;
    console.log('💬 Cargando mensajes para chat:', chatId);
    
    const sub = this.chatService.getChatMessages(chatId).subscribe({
      next: (response) => {
        console.log('✅ Mensajes obtenidos:', response.messages.length);
        console.log('📝 Mensajes:', response.messages);
        
        this.messages = response.messages || [];
        this.loadingMessages = false;
        this.shouldScrollToBottom = true;
        
        // Si tenemos mensajes pero no info del chat, crear info básica
        if (this.messages.length > 0 && !this.chat) {
          this.createBasicChatInfo(chatId);
        }
      },
      error: (error) => {
        console.error('❌ Error al cargar mensajes:', error);
        this.messages = [];
        this.loadingMessages = false;
      }
    });
    this.subscriptions.push(sub);
  }

  createBasicChatInfo(chatId: string): void {
    console.log('🔧 Creando info básica del chat...');
    
    // Encontrar el otro usuario basado en los mensajes
    const currentUserId = this.getCurrentUserId();
    const otherUserMessage = this.messages.find(m => m.sender._id !== currentUserId);
    
    if (otherUserMessage) {
      this.chat = {
        _id: chatId,
        participants: [],
        chatType: 'private',
        lastActivity: new Date(),
        otherParticipant: otherUserMessage.sender,
        unreadCount: 0
      } as Chat;
      
      console.log('✅ Info básica del chat creada:', this.chat);
    }
  }

  joinChatRoom(chatId: string): void {
    if (this.socketService.isConnected()) {
      console.log('🔌 Uniéndose al chat room:', chatId);
      this.socketService.joinChat(chatId);
    }
  }

  setupSocketListeners(): void {
    const newMessageSub = this.socketService.newMessage$.subscribe(message => {
      if (message && message.chatId === this.currentChatId) {
        console.log('📨 Nuevo mensaje recibido:', message);
        this.messages.push(message.message);
        this.shouldScrollToBottom = true;
      }
    });
    this.subscriptions.push(newMessageSub);

    const typingSub = this.socketService.userTyping$.subscribe(typing => {
      if (typing && typing.userId !== this.getCurrentUserId()) {
        this.isTyping = typing.isTyping;
        if (this.isTyping) {
          setTimeout(() => {
            this.isTyping = false;
          }, 3000);
        }
      }
    });
    this.subscriptions.push(typingSub);
  }

  sendMessage(): void {
    if (!this.messageText.trim() || !this.currentChatId) {
      console.warn('⚠️ No se puede enviar mensaje: texto vacío o sin chat');
      return;
    }

    if (this.editingMessage) {
      this.saveEditMessage();
      return;
    }

    console.log('📤 Enviando mensaje:', this.messageText);

    const sub = this.chatService.sendTextMessage(this.currentChatId, this.messageText.trim()).subscribe({
      next: (message) => {
        console.log('✅ Mensaje enviado:', message);
        this.messages.push(message);
        this.messageText = '';
        this.shouldScrollToBottom = true;
      },
      error: (error) => {
        console.error('❌ Error al enviar mensaje:', error);
        alert('Error al enviar el mensaje. Inténtalo de nuevo.');
      }
    });
    this.subscriptions.push(sub);
  }

  startEditMessage(message: ChatMessage): void {
    if (!this.chatService.canEditMessage(message)) {
      alert('No se puede editar este mensaje');
      return;
    }

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
        alert('Error al editar el mensaje.');
      }
    });
    this.subscriptions.push(sub);
  }

  cancelEdit(): void {
    this.editingMessage = null;
    this.messageText = '';
  }

  deleteMessage(messageId: string): void {
    const message = this.messages.find(m => m._id === messageId);
    if (!message || !this.chatService.canDeleteMessage(message)) {
      alert('No se puede eliminar este mensaje');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres eliminar este mensaje?')) return;

    const sub = this.chatService.deleteMessage(messageId).subscribe({
      next: () => {
        this.messages = this.messages.filter(m => m._id !== messageId);
      },
      error: (error) => {
        console.error('Error al eliminar mensaje:', error);
        alert('Error al eliminar el mensaje.');
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
    if (this.socketService.isConnected() && this.currentChatId) {
      this.socketService.sendTypingIndicator(this.currentChatId, true);
      
      if (this.typingTimeout) clearTimeout(this.typingTimeout);
      
      this.typingTimeout = setTimeout(() => {
        this.socketService.sendTypingIndicator(this.currentChatId, false);
      }, 1000);
    }
  }

  searchMovies(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    
    if (!this.movieSearchQuery.trim()) {
      this.movieSearchResults = [];
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.searchingMovies = true;
      
      const sub = this.peliculasService.busquedaAvanzadaPeliculas({
        query: this.movieSearchQuery.trim(),
        page: 1
      }).subscribe({
        next: (response) => {
          this.movieSearchResults = response.results || [];
          this.searchingMovies = false;
        },
        error: (error) => {
          console.error('Error al buscar películas:', error);
          this.movieSearchResults = [];
          this.searchingMovies = false;
        }
      });
      this.subscriptions.push(sub);
    }, 300);
  }

  shareMovie(movie: any): void {
    if (!this.currentChatId) return;

    const movieData = {
      tmdbId: movie.id.toString(),
      title: movie.title,
      posterPath: movie.poster_path,
      year: this.getMovieYear(movie.release_date)
    };

    const sub = this.chatService.sendMovieMessage(this.currentChatId, movieData).subscribe({
      next: (message) => {
        this.messages.push(message);
        this.showMovieShareModal = false;
        this.movieSearchQuery = '';
        this.movieSearchResults = [];
        this.shouldScrollToBottom = true;
      },
      error: (error) => {
        console.error('Error al compartir película:', error);
        alert('Error al compartir la película.');
      }
    });
    this.subscriptions.push(sub);
  }

  archiveChat(): void {
    if (!this.currentChatId || !confirm('¿Archivar esta conversación?')) return;

    const sub = this.chatService.archiveChat(this.currentChatId).subscribe({
      next: () => {
        this.router.navigate(['/chat']);
      },
      error: (error) => {
        console.error('Error al archivar chat:', error);
        alert('Error al archivar la conversación.');
      }
    });
    this.subscriptions.push(sub);
  }

  goToMovie(tmdbId?: string): void {
    if (tmdbId) {
      this.router.navigate(['/pelicula', tmdbId]);
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
    const currentUserId = this.getCurrentUserId();
    return message.sender._id === currentUserId;
  }

  getCurrentUserId(): string {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    return currentUser.id || '';
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
    return this.chatService.formatFullTime(date);
  }
}