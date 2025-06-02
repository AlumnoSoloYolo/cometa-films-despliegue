import { Component, Input, OnInit, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { LikeService } from '../../services/like.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-like-button',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './like-button.component.html',
  styleUrls: ['./like-button.component.css']
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
    private router: Router,
    private el: ElementRef,
    private renderer: Renderer2
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

    const newLikeStatus = !this.isLiked;
this.animateHeartEffect(newLikeStatus);  // Se ejecuta con el valor correcto

// Luego aplicás el cambio optimista
this.isLiked = newLikeStatus;
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

  
  animateHeartEffect(isLiking: boolean): void {
    // Crear elemento del corazón
    const heart = this.renderer.createElement('div');
    
    // Generar color aleatorio para el corazón
    const color = this.getRandomHeartColor();
    
    // Aplicar clases según si es like o unlike
    if (isLiking) {
      this.renderer.addClass(heart, 'heart-animation');
    } else {
      this.renderer.addClass(heart, 'broken-heart-animation');
    }
    
    // Establecer estilo del corazón
    this.renderer.setStyle(heart, 'color', color);
    
    // Añadir el corazón al contenedor del botón
    const container = this.el.nativeElement.querySelector('.like-container');
    this.renderer.appendChild(container, heart);
    
    // Contenido del elemento (corazón entero o roto)
    const icon = this.renderer.createElement('i');
    if (isLiking) {
      this.renderer.addClass(icon, 'bi');
      this.renderer.addClass(icon, 'bi-heart-fill');
    } else {
      this.renderer.addClass(icon, 'fa-solid');
      this.renderer.addClass(icon, 'fa-heart-crack');
    }
    this.renderer.appendChild(heart, icon);
    
    // Eliminar el corazón después de la animación
    setTimeout(() => {
      if (container.contains(heart)) {
        this.renderer.removeChild(container, heart);
      }
    }, 1000);
  }

  /** Genera un color aleatorio vibrante para el corazón animado*/
  getRandomHeartColor(): string {
    // Colores vibrantes para el corazón (rosa, rojo, morado)
    const colors = [
      '#FF1493', 
      '#FF0066', 
      '#FF3366', 
      '#FF0080', 
      '#FF007F', 
      '#FF0033', 
      '#FF34B3', 
      '#E6007E', 
      '#CC00CC', 
      '#FF66B2', 
      '#FF0099', 
      '#9900FF'  
    ];
    
    // Seleccionar un color aleatorio del array
    return colors[Math.floor(Math.random() * colors.length)];
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