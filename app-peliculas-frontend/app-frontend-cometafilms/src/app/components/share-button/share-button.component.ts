import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';
import { UserSocialService } from '../../services/social.service';
import { Subscription } from 'rxjs';

interface MovieToShare {
  id: string;
  title: string;
  poster_path: string;
  release_date: string;
}

@Component({
  selector: 'app-share-movie-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './share-button.component.html',
  styleUrl: './share-button.component.css'
})
export class ShareButtonComponent implements OnInit, OnDestroy {
  @Input() movie!: MovieToShare;

  showShareModal = false;
  searchQuery = '';
  searchResults: any[] = [];
  recentChats: any[] = [];
  searchingUsers = false;
  sharingToChatId: string | null = null;
  sharingToUserId: string | null = null;

  private subscriptions: Subscription[] = [];
  private searchTimeout: any;

  constructor(
    private chatService: ChatService,
    private userSocialService: UserSocialService
  ) {}

  ngOnInit(): void {
    this.loadRecentChats();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }
  }

  openShareModal(): void {
    this.showShareModal = true;
    this.loadRecentChats();
  }

  closeModal(): void {
    this.showShareModal = false;
    this.searchQuery = '';
    this.searchResults = [];
    this.sharingToChatId = null;
    this.sharingToUserId = null;
  }

  loadRecentChats(): void {
    const sub = this.chatService.getUserChats(1, 10).subscribe({
      next: (response) => {
        this.recentChats = response.chats;
      },
      error: (error) => {
        console.error('Error al cargar chats recientes:', error);
      }
    });
    this.subscriptions.push(sub);
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
      const sub = this.userSocialService.searchUsers(this.searchQuery).subscribe({
        next: (users) => {
          this.searchResults = users;
          this.searchingUsers = false;
        },
        error: (error) => {
          console.error('Error al buscar usuarios:', error);
          this.searchingUsers = false;
        }
      });
      this.subscriptions.push(sub);
    }, 300);
  }

  shareToChat(chatId: string): void {
    if (this.sharingToChatId) return;
    
    this.sharingToChatId = chatId;
    
    const movieData = {
      tmdbId: this.movie.id,
      title: this.movie.title,
      posterPath: this.movie.poster_path,
      year: this.getMovieYear(this.movie.release_date)
    };

    const sub = this.chatService.sendMovieMessage(chatId, movieData).subscribe({
      next: () => {
        this.showSuccessAnimation('chat', chatId);
        setTimeout(() => {
          this.closeModal();
        }, 1000);
      },
      error: (error) => {
        console.error('Error al compartir película:', error);
        this.sharingToChatId = null;
        alert('Error al compartir la película. Inténtalo de nuevo.');
      }
    });
    this.subscriptions.push(sub);
  }

  shareToUser(userId: string): void {
    if (this.sharingToUserId) return;
    
    this.sharingToUserId = userId;

    // Primero crear o obtener el chat con el usuario
    const sub = this.chatService.getOrCreateChat(userId).subscribe({
      next: (chat) => {
        // Luego enviar la película al chat
        this.shareToChat(chat._id);
        this.sharingToUserId = null;
      },
      error: (error) => {
        console.error('Error al crear chat:', error);
        this.sharingToUserId = null;
        alert('Error al crear la conversación. Inténtalo de nuevo.');
      }
    });
    this.subscriptions.push(sub);
  }

  showSuccessAnimation(type: 'chat' | 'user', id: string): void {
    const element = type === 'chat' 
      ? document.querySelector(`.chat-item[data-id="${id}"]`)
      : document.querySelector(`.user-item[data-id="${id}"]`);
    
    if (element) {
      element.classList.add('success');
      setTimeout(() => {
        element.classList.remove('success');
      }, 600);
    }
  }

  getAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }

  getMoviePosterUrl(posterPath: string): string {
    return posterPath 
      ? `https://image.tmdb.org/t/p/w200${posterPath}` 
      : '/images/no-poster.jpg';
  }

  getMovieYear(releaseDate: string): string {
    return releaseDate ? new Date(releaseDate).getFullYear().toString() : '';
  }
}