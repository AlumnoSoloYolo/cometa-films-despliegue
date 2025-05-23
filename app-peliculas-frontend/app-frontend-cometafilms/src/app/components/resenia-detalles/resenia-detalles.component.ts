import { Component, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { UserMovieService } from '../../services/user.service';
import { PeliculasService } from '../../services/peliculas.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserSocialService } from '../../services/social.service';
import { User, UserResponse } from '../../models/user.model';
import { LikeButtonComponent } from '../like-button/like-button.component';

interface Comment {
  _id?: string;
  text: string;
  userId: string;
  username: string;
  avatar: string;
  parentId?: string | null;
  createdAt: Date;
  isEdited?: boolean;
  editedAt?: Date;
  replies?: Comment[];
}

@Component({
  selector: 'app-resenia-detalles',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, LikeButtonComponent],
  templateUrl: './resenia-detalles.component.html',
  styleUrl: './resenia-detalles.component.css'
})
export class ReseniaDetallesComponent implements OnInit {
  review: any = null;
  movieDetails: any = null;
  isLoading = true;

  comments: Comment[] = [];
  organizedComments: Comment[] = [];
  commentForm: FormGroup;
  reviewForm: FormGroup;
  replyingTo: Comment | null = null;
  editingComment: Comment | null = null;
  isFollowing: boolean = false;
  isHovering: boolean = false;
  mostrarFormularioEdicion: boolean = false;

  // Nuevas propiedades para seguimiento
  followStatus: 'none' | 'requested' | 'following' = 'none';
  requestId: string | null = null;

  currentUser: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userMovieService: UserMovieService,
    private peliculasService: PeliculasService,
    private authService: AuthService,
    private fb: FormBuilder,
    private userSocialService: UserSocialService
  ) {
    this.reviewForm = this.fb.group({
      rating: [0, [Validators.required, Validators.min(0), Validators.max(10)]],
      text: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]]
    });

    this.commentForm = this.fb.group({
      text: ['', [Validators.required, Validators.maxLength(500)]]
    });

    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const reviewId = params['reviewId'];

      if (reviewId) {
        this.loadReview(reviewId);
      } else {
        this.router.navigate(['/']);
      }
    });
  }

  loadReview(reviewId: string): void {
    this.userMovieService.getReviewById(reviewId).subscribe({
      next: (review) => {
        this.review = review;

        if (this.currentUser) {
          this.checkFollowingStatus();
          // También verificar el estado con el nuevo método
          this.checkFollowStatus();
        }

        if (review._id) {
          this.loadComments(review._id);
        }

        // Una vez tenemos la reseña, cargamos los detalles de la película
        this.peliculasService.getDetallesPelicula(review.movieId).subscribe({
          next: (movie) => {
            this.movieDetails = movie;
            this.isLoading = false;
          },
          error: (error) => {
            console.error('Error al cargar detalles de película:', error);
            this.isLoading = false;
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar reseña:', error);
        this.isLoading = false;
      }
    });
  }

  loadComments(reviewId: string): void {
    this.userMovieService.getReviewComments(reviewId).subscribe({
      next: (comments) => {
        this.comments = comments;
        this.organizedComments = this.organizeCommentsHierarchy(comments);
      },
      error: (error) => {
        console.error('Error al cargar comentarios:', error);
      }
    });
  }

  // Método original de comprobación de seguimiento (mantener para compatibilidad)
  checkFollowingStatus(): void {
    if (!this.review || !this.review.userId || !this.currentUser) {
      console.log('No se puede verificar estado: datos incompletos');
      return;
    }

    // Si la reseña es del usuario actual, no se puede seguir a uno mismo
    if (this.currentUser.id === this.review.userId) {
      console.log('No se muestra botón de seguir para reseña propia');
      return;
    }

    console.log(`Verificando estado de seguimiento para usuario: ${this.review.userId}`);

    // Consultar si el usuario actual sigue al autor de la reseña
    this.userSocialService.getUserProfile(this.review.userId).subscribe({
      next: (userData: any) => {
        console.log('Datos de perfil completos recibidos:', JSON.stringify(userData, null, 2));

        // Verificar específicamente la propiedad isFollowing
        if (userData.hasOwnProperty('isFollowing')) {
          this.isFollowing = !!userData.isFollowing;
          console.log(`Estado de seguimiento establecido a: ${this.isFollowing}`);
        } else {
          console.error('La respuesta no contiene la propiedad isFollowing');
          // Verificar manualmente si el usuario actual está en la lista de seguidores
          if (userData.followers && Array.isArray(userData.followers)) {
            this.isFollowing = userData.followers.some((id: string) => id === this.currentUser.id);
            console.log(`Estado de seguimiento calculado manualmente: ${this.isFollowing}`);
          }
        }
      },
      error: (error) => {
        console.error('Error al verificar estado de seguimiento:', error);
      }
    });
  }

  // Nuevo método para verificar el estado de seguimiento con soporte para solicitudes
  checkFollowStatus(): void {
    if (!this.review || !this.review.userId || !this.currentUser) {
      return;
    }

    // Si la reseña es del usuario actual, no se puede seguir a uno mismo
    if (this.currentUser.id === this.review.userId) {
      return;
    }

    this.userSocialService.getFollowStatus(this.review.userId).subscribe({
      next: (response: any) => {
        this.followStatus = response.status;
        this.requestId = response.requestId || null;
        // Sincronizar con el estado anterior para compatibilidad
        this.isFollowing = response.status === 'following';
      },
      error: (error) => {
        console.error('Error al verificar estado de seguimiento:', error);
      }
    });
  }

  // Método actualizado de toggleFollow
  toggleFollow(event: Event): void {
    event.stopPropagation();

    if (!this.review || !this.review.userId) return;

    const userId = this.review.userId;
    console.log(`Cambiando estado de seguimiento para userId: ${userId}`);

    // Si ya está siguiendo, dejar de seguir
    if (this.followStatus === 'following') {
      this.userSocialService.unfollowUser(userId).subscribe({
        next: () => {
          this.followStatus = 'none';
          this.isFollowing = false;
          this.isHovering = false;
          console.log('Dejaste de seguir al usuario correctamente');
        },
        error: (error) => {
          console.error('Error al dejar de seguir:', error);
          alert(`Error: ${error.error?.message || 'No se pudo completar la acción'}`);
        }
      });
      return;
    }

    // Si hay una solicitud pendiente, cancelarla
    if (this.followStatus === 'requested' && this.requestId) {
      this.userSocialService.cancelFollowRequest(this.requestId).subscribe({
        next: () => {
          this.followStatus = 'none';
          this.requestId = null;
          this.isFollowing = false;
          console.log('Solicitud cancelada correctamente');
        },
        error: (error) => {
          console.error('Error al cancelar solicitud:', error);
          alert(`Error: ${error.error?.message || 'No se pudo completar la acción'}`);
        }
      });
      return;
    }

    // En cualquier otro caso, intentar seguir o enviar solicitud
    this.userSocialService.followUser(userId).subscribe({
      next: (response: any) => {
        this.followStatus = response.status;
        this.requestId = response.requestId || null;
        this.isFollowing = response.status === 'following';
        console.log(`Estado actualizado a: ${this.followStatus}`);
      },
      error: (error) => {
        console.error('Error al seguir usuario:', error);
        alert(`Error: ${error.error?.message || 'No se pudo completar la acción'}`);
      }
    });
  }

  // Método para mostrar condicionalmente el botón de seguir
  shouldShowFollowButton(): boolean {
    return this.currentUser && this.review && this.currentUser.id !== this.review.userId;
  }

  // Organiza los comentarios en estructura jerárquica para mostrarlos anidados
  organizeCommentsHierarchy(comments: Comment[]): Comment[] {
    const rootComments: Comment[] = [];
    const commentMap = new Map<string, Comment>();

    // Primero, crear un mapa con todos los comentarios
    comments.forEach(comment => {
      const commentCopy = { ...comment, replies: [] };
      commentMap.set(comment._id!, commentCopy);
    });

    // Organizar en estructura jerárquica
    comments.forEach(comment => {
      const commentWithReplies = commentMap.get(comment._id!);

      if (comment.parentId) {
        // Es una respuesta, agregar al padre
        const parentComment = commentMap.get(comment.parentId);
        if (parentComment) {
          if (!parentComment.replies) {
            parentComment.replies = [];
          }
          parentComment.replies.push(commentWithReplies!);
        } else {
          // Si no se encuentra el padre, agregar a comentarios raíz
          rootComments.push(commentWithReplies!);
        }
      } else {
        // Es un comentario raíz
        rootComments.push(commentWithReplies!);
      }
    });

    // Ordenar por fecha (más recientes primero)
    return rootComments.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  submitComment(): void {
    if (this.commentForm.invalid) return;

    const text = this.commentForm.get('text')!.value;

    if (this.editingComment) {
      // Editar comentario existente
      this.userMovieService.editComment(
        this.review._id,
        this.editingComment._id!,
        text
      ).subscribe({
        next: (updatedComment) => {
          // Actualizar comentario en el array local
          const index = this.comments.findIndex(c => c._id === updatedComment._id);
          if (index !== -1) {
            this.comments[index] = updatedComment;
          }

          // Reorganizar comentarios
          this.organizedComments = this.organizeCommentsHierarchy(this.comments);

          // Resetear estado de edición
          this.editingComment = null;
          this.commentForm.reset();
        },
        error: (error) => {
          console.error('Error al editar comentario:', error);
        }
      });
    } else {
      // Añadir nuevo comentario o respuesta
      const parentId = this.replyingTo ? this.replyingTo._id : null;

      this.userMovieService.addComment(this.review._id, text, parentId).subscribe({
        next: (newComment) => {
          // Añadir comentario al array local
          this.comments.push(newComment);

          // Reorganizar comentarios
          this.organizedComments = this.organizeCommentsHierarchy(this.comments);

          // Resetear estado
          this.replyingTo = null;
          this.commentForm.reset();
        },
        error: (error) => {
          console.error('Error al añadir comentario:', error);
        }
      });
    }
  }

  replyToComment(comment: Comment): void {
    this.replyingTo = comment;
    this.editingComment = null;
    this.commentForm.reset();

    // Hacer scroll al formulario
    setTimeout(() => {
      document.getElementById('commentForm')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  editComment(comment: Comment): void {
    this.editingComment = comment;
    this.replyingTo = null;
    this.commentForm.patchValue({ text: comment.text });

    // Hacer scroll al formulario
    setTimeout(() => {
      document.getElementById('commentForm')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  cancelAction(): void {
    this.replyingTo = null;
    this.editingComment = null;
    this.commentForm.reset();
  }

  deleteComment(commentId: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
      this.userMovieService.deleteComment(this.review._id, commentId).subscribe({
        next: () => {
          // Eliminar comentario del array local
          this.comments = this.comments.filter(c => c._id !== commentId);

          // Reorganizar comentarios
          this.organizedComments = this.organizeCommentsHierarchy(this.comments);
        },
        error: (error) => {
          console.error('Error al eliminar comentario:', error);
        }
      });
    }
  }

  canEditComment(comment: Comment): boolean {
    return this.currentUser && this.currentUser.id === comment.userId;
  }

  canDeleteComment(comment: Comment): boolean {
    return this.currentUser &&
      (this.currentUser.id === comment.userId ||
        this.currentUser.id === this.review.userId);
  }

  getAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }

  volverAPelicula(): void {
    if (this.review && this.review.movieId) {
      this.router.navigate(['/pelicula', this.review.movieId]);
    } else {
      this.router.navigate(['/']);
    }
  }

  // Método para verificar si la reseña pertenece al usuario actual
  isCurrentUserReview(): boolean {
    return this.currentUser && this.review && this.currentUser.id === this.review.userId;
  }

  // Método para abrir el modal de edición
  editarReview(): void {
    if (!this.review) return;

    // Cargar datos de la reseña en el formulario
    this.reviewForm.patchValue({
      rating: this.review.rating,
      comment: this.review.comment
    });

    // Mostrar el modal
    this.mostrarFormularioEdicion = true;
  }

  // Método para cerrar el modal
  cancelarEdicion(): void {
    this.mostrarFormularioEdicion = false;
  }

  // Método para establecer la calificación
  setRating(rating: number): void {
    this.reviewForm.patchValue({ rating });
  }

  // Método para guardar los cambios
  guardarEdicionReview(): void {
    if (this.reviewForm.invalid || !this.review) return;

    const { rating, comment } = this.reviewForm.value;

    this.userMovieService.updateReview(this.review.movieId, { rating, comment }).subscribe({
      next: (response) => {
        // Actualizar la reseña en el componente
        this.review = {
          ...this.review,
          rating,
          comment,
          updatedAt: new Date()
        };

        this.mostrarFormularioEdicion = false;
      },
      error: (error) => console.error('Error al actualizar reseña:', error)
    });
  }

  // Método para eliminar la reseña
  eliminarReview(): void {
    if (!this.review || !confirm('¿Estás seguro de que quieres eliminar esta reseña?')) return;

    this.userMovieService.deleteReview(this.review.movieId).subscribe({
      next: () => {
        // Redirigir a la página de la película
        this.router.navigate(['/pelicula', this.review.movieId]);
      },
      error: (error) => console.error('Error al eliminar reseña:', error)
    });
  }
}