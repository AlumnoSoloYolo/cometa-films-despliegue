
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChatService, Chat } from '../../../services/chat.service';
import { SocketService } from '../../../services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './chat-list.component.html',
  styleUrl: './chat-list.component.css'
})
export class ChatListComponent implements OnInit, OnDestroy {
  chats: Chat[] = [];
  loading = true;
  selectedChatId: string | null = null;
  
  // Modal nueva conversación
  showNewChatModal = false;
  searchQuery = '';
  searchResults: any[] = [];
  searchingUsers = false;
  
  private subscriptions: Subscription[] = [];
  private searchTimeout: any;

  constructor(
    private chatService: ChatService,
    private socketService: SocketService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadChats();
    this.setupSocketListeners();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  loadChats(): void {
    this.loading = true;
    const sub = this.chatService.getUserChats().subscribe({
      next: (response) => {
        this.chats = response.chats;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al cargar chats:', error);
        this.loading = false;
      }
    });
    this.subscriptions.push(sub);
  }

  setupSocketListeners(): void {
    // Escuchar nuevos mensajes
    const newMessageSub = this.socketService.newMessage$.subscribe(message => {
      if (message) {
        this.handleNewMessage(message);
      }
    });
    this.subscriptions.push(newMessageSub);

    // Escuchar actualizaciones de chat
    const chatsUpdatedSub = this.chatService.chatsUpdated$.subscribe(updated => {
      if (updated) {
        this.loadChats();
      }
    });
    this.subscriptions.push(chatsUpdatedSub);
  }

  handleNewMessage(message: any): void {
    // Actualizar el chat en la lista
    const chatIndex = this.chats.findIndex(chat => chat._id === message.chatId);
    if (chatIndex !== -1) {
      this.chats[chatIndex].lastMessage = message.message;
      this.chats[chatIndex].lastActivity = new Date();
      this.chats[chatIndex].unreadCount++;
      
      // Mover al inicio de la lista
      const chat = this.chats.splice(chatIndex, 1)[0];
      this.chats.unshift(chat);
    } else {
      // Es un chat nuevo, recargar la lista
      this.loadChats();
    }
  }

  selectChat(chatId: string): void {
    this.selectedChatId = chatId;
    this.router.navigate(['/chat', chatId]);
  }

  searchUsers(): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.searchingUsers = true;
      
      // Usar el servicio de búsqueda específico para chat
      const sub = this.chatService.searchUsersForChat(this.searchQuery.trim()).subscribe({
        next: (users) => {
          this.searchResults = users;
          this.searchingUsers = false;
        },
        error: (error) => {
          console.error('Error al buscar usuarios:', error);
          this.searchResults = [];
          this.searchingUsers = false;
        }
      });
      this.subscriptions.push(sub);
    }, 300);
  }

  startChatWithUser(userId: string): void {
    const sub = this.chatService.getOrCreateChat(userId).subscribe({
      next: (chat) => {
        this.showNewChatModal = false;
        this.searchQuery = '';
        this.searchResults = [];
        this.selectChat(chat._id);
        // Recargar la lista para mostrar el nuevo chat
        this.loadChats();
      },
      error: (error) => {
        console.error('Error al crear chat:', error);
        alert('Error al crear la conversación. Inténtalo de nuevo.');
      }
    });
    this.subscriptions.push(sub);
  }

  getAvatarPath(avatar: string): string {
    return this.chatService.getAvatarPath(avatar);
  }

  formatTime(date: Date | string): string {
    return this.chatService.formatMessageTime(date);
  }

  getLastMessagePreview(message: any): string {
    if (!message.text) return '';
    return message.text.length > 30 ? message.text.substring(0, 30) + '...' : message.text;
  }

  isOwnMessage(message: any): boolean {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    return message.sender === currentUser.id || message.sender._id === currentUser.id;
  }
}