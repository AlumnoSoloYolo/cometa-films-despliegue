// src/app/components/activity-feed/activity-feed.component.ts
import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivityService } from '../../services/activity.service';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './activity-feed.component.html',
  styleUrls: ['./activity-feed.component.css']
})
export class ActivityFeedComponent implements OnInit, OnDestroy {
  activities: any[] = [];
  cargando = false;
  error = false;
  paginaActual = 1;
  totalPaginas = 0;
  hayMasPaginas = true;
  mostrarBotonSubir = false;

  private socketSubscription?: Subscription;

  constructor(
    private activityService: ActivityService,
    private socketService: SocketService
  ) { }

  ngOnInit(): void {
    this.cargarFeed();

    // Suscribirse a nuevas actividades en tiempo real
    this.socketSubscription = this.socketService.newActivity$.subscribe(
      activity => {
        if (activity) {
          // Añadir nueva actividad al inicio del feed
          this.activities.unshift(activity);
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.socketSubscription) {
      this.socketSubscription.unsubscribe();
    }
  }

  @HostListener('window:scroll')
  manejarScroll() {
    const estaEnElFondo = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300;

    if (!this.cargando && this.hayMasPaginas && estaEnElFondo) {
      this.paginaActual++;
      this.cargarFeed(this.paginaActual);
    }

    this.mostrarBotonSubir = window.pageYOffset > 300;
  }

  cargarFeed(pagina: number = 1): void {
    if (this.cargando) return;

    this.cargando = true;
    this.error = false;

    // Usa el parámetro includeOwn=false para excluir actividades propias
    this.activityService.getFeed(pagina, 20, false).subscribe({
      next: (response) => {

        if (pagina === 1) {
          this.activities = response.activities;
        } else {
          // Añadir nuevas actividades al final de la lista
          this.activities = [...this.activities, ...response.activities];
        }

        this.totalPaginas = response.pagination.totalPages;
        this.hayMasPaginas = response.pagination.hasMore;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar feed de actividad:', error);
        this.cargando = false;
        this.error = true;
      }
    });
  }

  volverArriba(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Método para formatear el texto de la actividad según el tipo
  getActivityText(activity: any): string {
    const username = activity.userDisplay.username;

    switch (activity.actionType) {
      case 'followed_user':
        return `${username} ha comenzado a seguir a ${activity.targetUser.username}`;

      case 'created_review':
        return `${username} ha publicado una reseña de ${activity.movie.title}`;

      case 'liked_review':
        // Si tenemos información sobre el autor de la reseña
        if (activity.review && activity.review.authorUsername) {
          return `A ${username} le gusta la reseña de ${activity.review.authorUsername} sobre ${activity.movie.title}`;
        } else {
          return `A ${username} le gusta una reseña de ${activity.movie.title}`;
        }

      case 'liked_list':
        // Si tenemos información sobre el autor de la lista
        if (activity.movieList && activity.movieList.authorUsername) {
          return `A ${username} le gusta la lista "${activity.movieList.title}" de ${activity.movieList.authorUsername}`;
        } else {
          return `A ${username} le gusta la lista "${activity.movieList.title}"`;
        }

      case 'added_to_watchlist':
        return `${username} ha añadido ${activity.movie.title} a pendientes`;

      case 'added_to_watched':
        return `${username} ha visto ${activity.movie.title}`;

      case 'created_public_list':
        return `${username} ha creado la lista "${activity.movieList.title}"`;

      default:
        return `${username} ha realizado una acción`;
    }
  }

  // Método para obtener la URL de navegación según el tipo de actividad
  getActivityUrl(activity: any): string[] {
    switch (activity.actionType) {
      case 'followed_user':
        return ['/usuarios', activity.targetUser.userId];

      case 'created_review':
      case 'liked_review':
        return ['/resenia', activity.review.reviewId];

      case 'liked_list':
      case 'created_public_list':
        return ['/listas', activity.movieList.listId];

      case 'added_to_watchlist':
      case 'added_to_watched':
        return ['/pelicula', activity.movie.tmdbId];

      default:
        return ['/'];
    }
  }

  // Método para obtener la URL de la imagen según el tipo de actividad
  getActivityImageUrl(activity: any): string {
    switch (activity.actionType) {
      case 'followed_user':
        return `/avatares/${activity.targetUser.avatar}.gif`;

      case 'created_review':
      case 'added_to_watchlist':
      case 'added_to_watched':
      case 'liked_review':
        return activity.movie.posterPath ?
          `https://image.tmdb.org/t/p/w200${activity.movie.posterPath}` :
          '/assets/images/placeholder-poster.png';

      case 'liked_list':
      case 'created_public_list':
        return activity.movieList.coverImage || '/assets/images/placeholder-list.png';

      default:
        return '/assets/images/placeholder.png';
    }
  }


  getAltText(activity: any): string {
    switch (activity.actionType) {
      case 'followed_user':
        return `Avatar de ${activity.targetUser.username}`;
      case 'created_review':
      case 'added_to_watchlist':
      case 'added_to_watched':
      case 'liked_review':
        return `Portada de ${activity.movie.title}`;
      case 'liked_list':
      case 'created_public_list':
        return `Portada de la lista ${activity.movieList.title}`;
      default:
        return 'Imagen de actividad';
    }
  }

  // Obtener la URL del avatar del usuario
  getAvatarUrl(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }

  formatDate(date: string): string {
    const now = new Date();
    const activityDate = new Date(date);
    const diffMs = now.getTime() - activityDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return 'ahora mismo';
    } else if (diffMins < 60) {
      return `hace ${diffMins} ${diffMins === 1 ? 'minuto' : 'minutos'}`;
    } else if (diffHours < 24) {
      return `hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
    } else if (diffDays < 7) {
      return `hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
    } else {
      return activityDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }
  }
}