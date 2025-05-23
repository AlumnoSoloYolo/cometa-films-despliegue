import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LikeService } from '../../services/like.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-like-button',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './like-button.component.html',
  styleUrl: './like-button.component.css'
})
export class LikeButtonComponent implements OnInit {
  @Input() contentType!: 'review' | 'comment' | 'list';
  @Input() contentId!: string;
  @Input() showCount: boolean = true;

  isLiked: boolean = false;
  likeCount: number = 0;
  loading: boolean = false;
  showLikesModal: boolean = false;

  likeUsers: any[] = [];
  loadingUsers: boolean = false;
  errorLoadingUsers: string | null = null;

  constructor(
    private likeService: LikeService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.checkLikeStatus();
    this.getLikeCount();
  }

  checkLikeStatus(): void {
    if (!this.authService.isAuthenticated()) {
      return;
    }

    this.loading = true;
    this.likeService.checkLike(this.contentType, this.contentId).subscribe({
      next: (response) => {
        this.isLiked = response.liked;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al verificar estado de like:', error);
        this.loading = false;
      }
    });
  }

  getLikeCount(): void {
    this.likeService.getLikeCount(this.contentType, this.contentId).subscribe({
      next: (response) => {
        this.likeCount = response.count;
      },
      error: (error) => {
        console.error('Error al obtener conteo de likes:', error);
      }
    });
  }

  onLikeClick(event: Event): void {
    event.stopPropagation();

    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.loading) {
      return;
    }

    this.loading = true;

    // Optimistic UI update
    this.isLiked = !this.isLiked;
    this.likeCount = this.isLiked ? this.likeCount + 1 : this.likeCount - 1;

    this.likeService.toggleLike(this.contentType, this.contentId).subscribe({
      next: (response) => {
        // El estado ya ha sido actualizado de forma optimista
        this.loading = false;
      },
      error: (error) => {
        console.error('Error al dar/quitar like:', error);
        // Revertir cambios optimistas en caso de error
        this.isLiked = !this.isLiked;
        this.likeCount = this.isLiked ? this.likeCount + 1 : this.likeCount - 1;
        this.loading = false;
      }
    });
  }

  openLikesModal(event: Event): void {
    event.stopPropagation();

    // Solo abrir el modal si hay likes
    if (this.likeCount > 0) {
      this.showLikesModal = true;
      this.loadLikeUsers();
    }
  }

  closeLikesModal(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.showLikesModal = false;
  }

  loadLikeUsers(): void {
    this.loadingUsers = true;
    this.errorLoadingUsers = null;

    this.likeService.getLikeUsers(this.contentType, this.contentId).subscribe({
      next: (users) => {
        this.likeUsers = users;
        this.loadingUsers = false;
      },
      error: (err) => {
        console.error('Error loading like users:', err);
        this.errorLoadingUsers = 'Error al cargar los usuarios';
        this.loadingUsers = false;
      }
    });
  }

  navigateToProfile(userId: string, event: Event): void {
    event.stopPropagation();
    this.closeLikesModal();
    this.router.navigate(['/usuarios', userId]);
  }

  getAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }
}