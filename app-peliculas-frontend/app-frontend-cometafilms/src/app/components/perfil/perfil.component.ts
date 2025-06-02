import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { UserMovieService } from '../../services/user.service';
import { PeliculasService } from '../../services/peliculas.service';
import { UserSocialService } from '../../services/social.service';
import { AuthService, User as AuthUser } from '../../services/auth.service';
import { VotoColorPipe } from '../../shared/pipes/voto-color.pipe';
import { PeliculaCardComponent } from '../pelicula-card/pelicula-card.component';
import { FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { MovieListsService } from '../../services/movie-lists.service';
import { MovieList } from '../../models/movie-list.model';
import { ChatService } from '../../services/chat.service';

interface UserProfile { 
  _id?: string;
  username: string;
  email?: string;
  avatar: string;
  createdAt: Date;
  pelisPendientes: Array<{ movieId: string, addedAt: Date }>;
  pelisVistas: Array<{ movieId: string, watchedAt: Date }>;
  reviews: Review[];
  biografia: string;
  perfilPrivado: boolean;
  isPremium?: boolean;
}

interface Review {
  reviewId?: string;
  movieId: string;
  rating: number;
  comment: string;
  createdAt: Date;
  username?: string;
  avatar?: string;
  userId?: string;
  _id?: string;
  movieTitle?: string;
  moviePosterPath?: string;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    VotoColorPipe,
    PeliculaCardComponent,
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit, OnDestroy {
  userProfile: UserProfile | null = null;
  mostrarFormularioEdicion: boolean = false;
  configForm: FormGroup;
  peliculasPendientes: any[] = [];
  peliculasVistas: any[] = [];
  reviews: Review[] = [];
  isOwnProfile: boolean = true;
  isHovering: boolean = false;
  avatars = [
    'avatar1', 'avatar2', 'avatar3', 'avatar4',
    'avatar5', 'avatar6', 'avatar7', 'avatar8'
  ];
  listas: MovieList[] = [];
  mostrarFormularioLista = false;
  listaForm: FormGroup;
  selectedFile: File | null = null;
  coverImagePreview: string | null = null;
  followStatus: 'none' | 'requested' | 'following' = 'none';
  requestId: string | null = null;
  isFollowing: boolean = false;
  private socialDataLoaded = false;
  seguidores: any[] = [];
  seguidos: any[] = [];
  seguidoresCount: number = 0;
  seguidosCount: number = 0;
  mostrarModalSeguidores: boolean = false;
  mostrarModalSeguidos: boolean = false;
  usuariosFiltrados: any[] = [];
  filtroUsuarios: string = '';

  totalListas: number = 0;
  listasOcultas: number = 0;
  isPremium: boolean = false;

  readonly LISTS_LIMIT_FREE_USER = 5;
  private currentUserSubscription: Subscription | undefined;
  private routeParamsSubscription: Subscription | undefined;

  constructor(
    private userMovieService: UserMovieService,
    private movieService: PeliculasService,
    private userSocialService: UserSocialService,
    private movieListsService: MovieListsService,
    public authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private chatService: ChatService,
    private cdr: ChangeDetectorRef, // AGREGAR PARA FIX CHROME
    private ngZone: NgZone // AGREGAR PARA FIX CHROME
  ) {
    this.configForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      avatar: ['avatar1'],
      biografia: ['', [Validators.maxLength(500)]],
      perfilPrivado: [false]
    });

    this.listaForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      isPublic: [true]
    });
  }

  ngOnInit() {
    this.routeParamsSubscription = this.route.params.subscribe(params => {
      const userIdFromRoute = params['id'];
      const currentAuthUser = this.authService.currentUserSubject.value;

      if (userIdFromRoute) {
        this.isOwnProfile = currentAuthUser?.id === userIdFromRoute;
        if (this.isOwnProfile) {
          this.loadUserProfile();
          this.cargarListasPropias();
        } else {
          this.loadOtherUserProfile(userIdFromRoute);
          this.cargarListasDeOtroUsuario(userIdFromRoute);
        }
      } else {
        this.isOwnProfile = true;
        this.loadUserProfile();
        this.cargarListasPropias();
      }
    });
  }

  ngOnDestroy() {
    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe();
    }
    if (this.routeParamsSubscription) {
      this.routeParamsSubscription.unsubscribe();
    }
  }

  loadUserProfile() {
    this.userMovieService.getUserPerfil().subscribe({
      next: (userData) => {
        // USAR ngZone PARA FORZAR DETECCIÓN DE CAMBIOS EN CHROME
        this.ngZone.run(() => {
          this.userProfile = {
            _id: userData._id,
            username: userData.username,
            email: userData.email,
            avatar: userData.avatar || 'avatar1',
            createdAt: new Date(userData.createdAt),
            pelisPendientes: userData.pelisPendientes || [],
            pelisVistas: userData.pelisVistas || [],
            reviews: userData.reviews || [],
            biografia: userData.biografia || '',
            perfilPrivado: userData.perfilPrivado || false,
            isPremium: userData.isPremium || false,
          };
          this.isPremium = userData.isPremium || false;
          this.cdr.detectChanges();
        });

        if ((this.userProfile?.pelisPendientes ?? []).length > 0) this.loadPeliculasPendientes();
        if ((this.userProfile?.pelisVistas ?? []).length > 0) this.loadPeliculasVistas();
        if ((this.userProfile?.reviews ?? []).length > 0) this.loadReviews();

        
        if (userData._id && !this.socialDataLoaded) {
          this.socialDataLoaded = true;
          this.cargarSeguidores(userData._id);
          this.cargarSeguidos(userData._id);
          // Forzar actualización después de cargar datos sociales
          setTimeout(() => this.forceViewUpdate(), 100);
        }
      },
      error: (error) => console.error('Error al cargar datos del perfil propio:', error)
    });
  }

  loadOtherUserProfile(userId: string) {
    this.userSocialService.getUserProfile(userId).subscribe({
      next: (userData: any) => {
        // USAR ngZone PARA FORZAR DETECCIÓN DE CAMBIOS EN CHROME
        this.ngZone.run(() => {
          this.userProfile = {
            _id: userData._id,
            username: userData.username,
            avatar: userData.avatar || 'avatar1',
            createdAt: new Date(userData.createdAt),
            pelisPendientes: userData.pelisPendientes || [],
            pelisVistas: userData.pelisVistas || [],
            reviews: userData.reviews || [],
            biografia: userData.biografia || '',
            perfilPrivado: userData.perfilPrivado || false,
            isPremium: userData.isPremium || false,
          };
          this.isPremium = userData.isPremium || false;
          this.cdr.detectChanges();
        });

        if ((this.userProfile?.pelisPendientes ?? []).length > 0) this.loadPeliculasPendientes();
        if ((this.userProfile?.pelisVistas ?? []).length > 0) this.loadPeliculasVistas();
        if ((this.userProfile?.reviews ?? []).length > 0) this.loadReviews();


        this.checkFollowStatus(userId);
        this.cargarSeguidores(userId);
        this.cargarSeguidos(userId);
      },
      error: (error: any) => console.error('Error al cargar datos del usuario ajeno:', error)
    });
  }

  // MÉTODO PARA ACTUALIZAR COUNTS DE FORMA SEGURA EN CHROME
  private updateCounts(newSeguidoresCount?: number, newSeguidosCount?: number, newTotalListas?: number): void {
    this.ngZone.run(() => {
      if (newSeguidoresCount !== undefined) {
        this.seguidoresCount = newSeguidoresCount;
      }
      if (newSeguidosCount !== undefined) {
        this.seguidosCount = newSeguidosCount;
      }
      if (newTotalListas !== undefined) {
        this.totalListas = newTotalListas;
      }
      this.cdr.markForCheck();
      this.cdr.detectChanges();
    });
  }

  // MÉTODO PARA FORZAR ACTUALIZACIÓN COMPLETA EN CHROME
  private forceViewUpdate(): void {
    // Triple check para Chrome
    setTimeout(() => {
      this.ngZone.run(() => {
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        console.log('Forzando actualización - Counts actuales:', {
          seguidores: this.seguidoresCount,
          seguidos: this.seguidosCount,
          listas: this.totalListas
        });
      });
    }, 50);
  }

  iniciarChatConUsuario(): void {
    if (!this.userProfile || !this.userProfile._id) {
      console.error('ID de perfil de usuario no disponible para iniciar chat.');
      alert('No se pudo obtener la información del usuario para iniciar el chat.');
      return;
    }
    const recipientId = this.userProfile._id;
    const currentAuthUser = this.authService.currentUserSubject.value;

    if (!currentAuthUser || !currentAuthUser.id) {
      console.error('Usuario actual no autenticado.');
      alert('Debes iniciar sesión para enviar mensajes.');
      this.router.navigate(['/login']);
      return;
    }

    if (currentAuthUser.id === recipientId) {
      console.warn('Intentando iniciar un chat consigo mismo.');
      return;
    }

    this.chatService.getOrCreateChat(recipientId).subscribe({
      next: (chat) => {
        if (chat && chat._id) {
          this.router.navigate(['/chat', chat._id]);
        } else {
          console.error('Respuesta inválida del servidor al crear/obtener el chat:', chat);
          alert('No se pudo iniciar la conversación. Inténtalo de nuevo más tarde.');
        }
      },
      error: (error) => {
        console.error('Error al iniciar el chat:', error);
        alert('Error al iniciar la conversación: ' + (error.error?.message || 'Problema de conexión o del servidor.'));
      }
    });
  }

  loadPeliculasPendientes() {
    if (!this.userProfile || !this.userProfile.pelisPendientes || this.userProfile.pelisPendientes.length === 0) {
        this.peliculasPendientes = [];
        return;
    }
    this.peliculasPendientes = [];
    this.userProfile.pelisPendientes.forEach(peli => {
      this.movieService.getDetallesPelicula(peli.movieId).subscribe({
        next: (movie) => this.peliculasPendientes.push(movie),
        error: (error) => console.error('Error al cargar detalles de película pendiente:', peli.movieId, error)
      });
    });
  }

  loadPeliculasVistas() {
    if (!this.userProfile || !this.userProfile.pelisVistas || this.userProfile.pelisVistas.length === 0) {
        this.peliculasVistas = [];
        return;
    }
    this.peliculasVistas = [];
    this.userProfile.pelisVistas.forEach(peli => {
      this.movieService.getDetallesPelicula(peli.movieId).subscribe({
        next: (movie) => this.peliculasVistas.push(movie),
        error: (error) => console.error('Error al cargar detalles de película vista:', peli.movieId, error)
      });
    });
  }

  loadReviews() {
    if (!this.userProfile || !this.userProfile.reviews || this.userProfile.reviews.length === 0) {
        this.reviews = [];
        return;
    }
    this.reviews = this.userProfile.reviews.map(review => ({...review}));

    this.reviews.forEach(review => {
      if (review.movieId) {
        this.movieService.getDetallesPelicula(review.movieId).subscribe({
          next: (movie) => {
            review.movieTitle = movie.title;
            review.moviePosterPath = movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : undefined;
          },
          error: (error) => {
            console.error('Error al cargar los detalles de la película para la reseña:', review.movieId, error);
            review.movieTitle = 'Película no encontrada';
          }
        });
      }
    });
  }

  getAvatarPath(): string {
    return this.userProfile?.avatar ? `/avatares/${this.userProfile.avatar}.gif` : '/avatares/avatar1.gif';
  }

  getAvatar(avatar: string | undefined): string {
    return avatar ? `/avatares/${avatar}.gif` : '/avatares/avatar1.gif';
  }

  getPendientesCount(): number { return this.userProfile?.pelisPendientes?.length || 0; }
  getVistasCount(): number { return this.userProfile?.pelisVistas?.length || 0; }
  getReviewsCount(): number { return this.userProfile?.reviews?.length || 0; }

  onPeliculaVistaAgregada(movieId: string) {
    if (this.userProfile) {
      if (!this.userProfile.pelisVistas.some(p => p.movieId === movieId)) {
        this.userProfile.pelisVistas.push({ movieId, watchedAt: new Date() });
      }
      this.userProfile.pelisPendientes = this.userProfile.pelisPendientes.filter(peli => peli.movieId !== movieId);
      this.loadPeliculasVistas();
      this.loadPeliculasPendientes();
    }
  }

  onPeliculaPendienteAgregada(movieId: string) {
    if (this.userProfile) {
       if (!this.userProfile.pelisPendientes.some(p => p.movieId === movieId)) {
        this.userProfile.pelisPendientes.push({ movieId, addedAt: new Date() });
      }
      this.userProfile.pelisVistas = this.userProfile.pelisVistas.filter(peli => peli.movieId !== movieId);
      this.loadPeliculasVistas();
      this.loadPeliculasPendientes();
    }
  }

  onPeliculaVistaEliminada(movieId: string) {
    if (this.userProfile) {
      this.userProfile.pelisVistas = this.userProfile.pelisVistas.filter(peli => peli.movieId !== movieId);
      this.peliculasVistas = this.peliculasVistas.filter(peli => peli.id?.toString() !== movieId);
    }
  }

  onPeliculaPendienteEliminada(movieId: string) {
    if (this.userProfile) {
      this.userProfile.pelisPendientes = this.userProfile.pelisPendientes.filter(peli => peli.movieId !== movieId);
      this.peliculasPendientes = this.peliculasPendientes.filter(peli => peli.id?.toString() !== movieId);
    }
  }

  scrollSection(sectionId: string, direction: 'left' | 'right'): void {
    const container = document.getElementById(sectionId);
    if (!container) return;
    const scrollContenido = container.querySelector('.movie-scroll-content');
    if (!scrollContenido) return;
    const itemAncho = scrollContenido.querySelector('.movie-scroll-item')?.clientWidth || 300;
    const scrollCantidad = itemAncho * 2;
    const scrollActual = scrollContenido.scrollLeft;
    let newScroll = direction === 'right' ? scrollActual + scrollCantidad : scrollActual - scrollCantidad;
    scrollContenido.scrollTo({ left: newScroll, behavior: 'smooth' });
  }

  navigateReview(review: Review): void {
    if (review && review._id) {
      this.router.navigate(['/resenia', review._id]);
    }
  }

  toggleFollow(): void {
    const userIdToFollowOrUnfollow = this.userProfile?._id;
    if (!userIdToFollowOrUnfollow || this.isOwnProfile) return;

    if (this.followStatus === 'following') {
      this.userSocialService.unfollowUser(userIdToFollowOrUnfollow).subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.followStatus = 'none';
            this.isFollowing = false;
            this.isHovering = false;
            this.seguidoresCount = Math.max(0, (this.seguidoresCount || 0) - 1);
            this.cdr.detectChanges();
          });
        },
        error: (error) => console.error('Error al dejar de seguir:', error)
      });
    } else if (this.followStatus === 'requested' && this.requestId) {
      this.userSocialService.cancelFollowRequest(this.requestId).subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.followStatus = 'none';
            this.requestId = null;
            this.cdr.detectChanges();
          });
        },
        error: (error) => console.error('Error al cancelar solicitud:', error)
      });
    } else {
      this.userSocialService.followUser(userIdToFollowOrUnfollow).subscribe({
        next: (response) => {
          this.ngZone.run(() => {
            this.followStatus = response.status;
            this.requestId = response.requestId || null;
            this.isFollowing = response.status === 'following';
            if (response.status === 'following') {
              this.seguidoresCount = (this.seguidoresCount || 0) + 1;
            }
            this.cdr.detectChanges();
          });
        },
        error: (error) => console.error('Error al seguir usuario:', error)
      });
    }
  }

  checkFollowStatus(userId: string): void {
    if (!userId || this.isOwnProfile) return;
    this.userSocialService.getFollowStatus(userId).subscribe({
      next: (response: any) => {
        this.ngZone.run(() => {
          this.followStatus = response.status;
          this.requestId = response.requestId || null;
          this.isFollowing = response.status === 'following';
          this.cdr.detectChanges();
        });
      },
      error: (error) => console.error('Error al verificar estado de seguimiento:', error)
    });
  }

  initConfigForm(): void {
    if (!this.userProfile) return;
    this.configForm.patchValue({
      username: this.userProfile.username,
      avatar: this.userProfile.avatar || 'avatar1',
      biografia: this.userProfile.biografia || '',
      perfilPrivado: this.userProfile.perfilPrivado || false
    });
  }

  editarPerfil(): void { this.initConfigForm(); this.mostrarFormularioEdicion = true; }
  cancelarEdicion(): void { this.mostrarFormularioEdicion = false; }

  guardarCambiosPerfil(): void {
    if (this.configForm.invalid || !this.userProfile?._id) return;

    const formData = this.configForm.value;
    this.userMovieService.updateUserProfile(formData).subscribe({
      next: (updatedUserResponse) => {
        if (this.userProfile) {
          this.userProfile.username = updatedUserResponse.username;
          this.userProfile.avatar = updatedUserResponse.avatar;
          this.userProfile.biografia = updatedUserResponse.biografia;
          this.userProfile.perfilPrivado = updatedUserResponse.perfilPrivado;
        }

        const currentAuthUser = this.authService.currentUserSubject.value;
        if (currentAuthUser && currentAuthUser.id === updatedUserResponse._id) {
          const userToStore: AuthUser = {
            ...currentAuthUser,
            username: updatedUserResponse.username,
            avatar: updatedUserResponse.avatar,
            isPremium: currentAuthUser.isPremium,
            premiumExpiry: currentAuthUser.premiumExpiry,
          };
          localStorage.setItem('user', JSON.stringify(userToStore));
          this.authService.currentUserSubject.next(userToStore);
        }
        this.cancelarEdicion();
        alert('Perfil actualizado correctamente');
      },
      error: (error) => {
        console.error('Error al actualizar perfil:', error);
        alert('Error al actualizar perfil: ' + (error.error?.message || 'Error desconocido'));
      }
    });
  }

  eliminarCuenta(): void {
    if (!confirm('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.')) return;
    this.userMovieService.deleteAccount().subscribe({
      next: () => {
        this.authService.logout();
        this.router.navigate(['/login']);
        alert('Cuenta eliminada correctamente');
      },
      error: (error) => {
        console.error('Error al eliminar cuenta:', error);
        alert('Error al eliminar cuenta: ' + (error.error?.message || 'Error desconocido'));
      }
    });
  }

  selectAvatar(avatar: string): void { this.configForm.get('avatar')?.setValue(avatar); }

  getErrorMessage(field: string): string {
    const control = this.configForm.get(field);
    if (control?.errors) {
      if (control.errors['required']) return 'Este campo es obligatorio.';
      if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
      if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    }
    return '';
  }

  cargarListasPropias(): void {
    this.movieListsService.getUserLists().subscribe({
      next: (response) => {
        // USAR ngZone PARA ACTUALIZACIÓN SEGURA EN CHROME
        this.ngZone.run(() => {
          const allLists = response.lists || [];
          this.isPremium = response.isPremium || false;
          
          if (!this.isPremium) {
            this.listas = allLists.slice(0, this.LISTS_LIMIT_FREE_USER);
            this.totalListas = Math.min(response.totalLists || allLists.length, this.LISTS_LIMIT_FREE_USER);
            this.listasOcultas = (response.totalLists || allLists.length) - this.totalListas;
          } else {
            this.listas = allLists;
            this.totalListas = response.totalLists || allLists.length;
            this.listasOcultas = response.hiddenLists || 0;
          }
          
          this.cdr.detectChanges();
        });
        
        console.log('Estado de listas:', {
          isPremium: this.isPremium,
          totalListasContadas: this.totalListas,
          listasVisibles: this.listas.length,
          listasOcultas: this.listasOcultas
        });
      },
      error: (error) => {
        console.error('Error al cargar listas propias:', error);
        this.updateCounts(undefined, undefined, 0);
        this.listas = [];
        this.listasOcultas = 0;
      }
    });
  }

  cargarListasDeOtroUsuario(userId: string): void {
    this.movieListsService.getUserPublicLists(userId).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          this.listas = response.lists || [];
          this.totalListas = response.totalLists || 0;
          this.isPremium = response.isPremium || false;
          this.listasOcultas = 0;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error al cargar listas de usuario:', error);
        this.listas = [];
        this.totalListas = 0;
      }
    });
  }

  mostrarFormularioCreacionLista(): void {
    this.listaForm.reset({ title: '', description: '', isPublic: true });
    this.selectedFile = null;
    this.coverImagePreview = null;
    this.mostrarFormularioLista = true;
  }

  cerrarFormularioLista(): void { this.mostrarFormularioLista = false; }

  async crearLista(): Promise<void> {
    if (this.listaForm.invalid) {
        Object.values(this.listaForm.controls).forEach(control => {
            control.markAsTouched();
        });
        return;
    }
    const formData = this.listaForm.value;
    let coverImageBase64 = null;
    if (this.selectedFile) {
      try {
        coverImageBase64 = await this.fileToBase64(this.selectedFile);
      } catch (error) {
        console.error('Error al convertir imagen:', error);
        alert('Error al procesar la imagen. Inténtalo con otra.');
        return;
      }
    }
    const listaData = { ...formData, coverImage: coverImageBase64 };

    this.movieListsService.createList(listaData).subscribe({
      next: (response) => {
        if (response && response.list) {
          if (this.isOwnProfile) {
            // ACTUALIZACIÓN SEGURA PARA CHROME
            this.ngZone.run(() => {
              const newListas = [response.list, ...this.listas];
              this.totalListas = (this.totalListas || 0) + 1;

              if (!this.isPremium && newListas.length > this.LISTS_LIMIT_FREE_USER) {
                this.listas = newListas.slice(0, this.LISTS_LIMIT_FREE_USER);
                this.listasOcultas = this.totalListas - this.LISTS_LIMIT_FREE_USER;
              } else {
                this.listas = newListas;
                if (!this.isPremium) {
                   this.listas = this.listas.slice(0, this.LISTS_LIMIT_FREE_USER);
                }
                this.listasOcultas = Math.max(0, this.totalListas - this.listas.length);
              }
              this.cdr.detectChanges();
            });
          }
        }
        this.cerrarFormularioLista();
      },
      error: (error) => {
        console.error('Error al crear lista:', error);
        if (error.error && error.error.error === 'PREMIUM_REQUIRED') {
          alert(error.error.message);
        } else {
          alert('Error al crear la lista: ' + (error.error?.message || 'Por favor, inténtalo de nuevo.'));
        }
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
        this.selectedFile = null;
        this.coverImagePreview = null;
        return;
    }
    const file = input.files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 1 * 1024 * 1024;

    if (!validTypes.includes(file.type)) {
      alert('Por favor selecciona una imagen (JPG, PNG, GIF, WEBP)');
      input.value = ''; this.selectedFile = null; this.coverImagePreview = null; return;
    }
    if (file.size > maxSize) {
      alert('La imagen es demasiado grande. El tamaño máximo es 1MB.');
      input.value = ''; this.selectedFile = null; this.coverImagePreview = null; return;
    }
    this.selectedFile = file;
    this.previewImage(file);
  }

  previewImage(file: File): void {
    const reader = new FileReader();
    reader.onload = () => this.coverImagePreview = reader.result as string;
    reader.readAsDataURL(file);
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  verDetalleLista(listaId: string): void { this.router.navigate(['/listas', listaId]); }

  hasFormError(field: string, form: FormGroup): boolean {
    const control = form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getFormErrorMessage(field: string, form: FormGroup): string {
    const control = form.get(field);
    if (!control) return '';
    if (control.errors) {
      if (control.errors['required']) return 'Este campo es obligatorio.';
      if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
      if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
    }
    return '';
  }

  cargarSeguidores(userId: string): void {
    if (!userId) return;
    
    this.userSocialService.getUserFollowers(userId).subscribe({
      next: (data) => {
        // SOLUCIÓN AGRESIVA PARA CHROME - múltiples intentos de actualización
        setTimeout(() => {
          this.ngZone.run(() => {
            if (data && data.followers) {
              this.seguidores = [...data.followers]; // Crear nueva referencia
              this.seguidoresCount = this.seguidores.length;
              console.log('Seguidores cargados:', this.seguidoresCount);
              
              // Múltiples llamadas para asegurar actualización en Chrome
              this.cdr.markForCheck();
              this.cdr.detectChanges();
              
              // Forzar repaint después de un micro-delay
              setTimeout(() => {
                this.cdr.detectChanges();
              }, 0);
            }
          });
        }, 10);
      },
      error: (error) => {
        console.error('Error al cargar seguidores:', error);
        this.ngZone.run(() => {
          if (!this.seguidores.length) {
            this.seguidores = [];
            this.seguidoresCount = 0;
          }
          this.cdr.detectChanges();
        });
      }
    });
  }

  cargarSeguidos(userId: string): void {
    if (!userId) return;
    
    this.userSocialService.getUserFollowing(userId).subscribe({
      next: (data) => {
        // SOLUCIÓN AGRESIVA PARA CHROME - múltiples intentos de actualización
        setTimeout(() => {
          this.ngZone.run(() => {
            if (data && data.following) {
              this.seguidos = [...data.following]; // Crear nueva referencia
              this.seguidosCount = this.seguidos.length;
              console.log('Seguidos cargados:', this.seguidosCount);
              
              // Múltiples llamadas para asegurar actualización en Chrome
              this.cdr.markForCheck();
              this.cdr.detectChanges();
              
              // Forzar repaint después de un micro-delay
              setTimeout(() => {
                this.cdr.detectChanges();
              }, 0);
            }
          });
        }, 10);
      },
      error: (error) => {
        console.error('Error al cargar seguidos:', error);
        this.ngZone.run(() => {
          if (!this.seguidos.length) {
            this.seguidos = [];
            this.seguidosCount = 0;
          }
          this.cdr.detectChanges();
        });
      }
    });
  }

  abrirModalSeguidores(): void { 
    this.usuariosFiltrados = [...this.seguidores]; 
    this.mostrarModalSeguidores = true; 
    this.filtroUsuarios = ''; 
  }
  
  abrirModalSeguidos(): void { 
    this.usuariosFiltrados = [...this.seguidos]; 
    this.mostrarModalSeguidos = true; 
    this.filtroUsuarios = ''; 
  }
  
  cerrarModales(): void { 
    this.mostrarModalSeguidores = false; 
    this.mostrarModalSeguidos = false; 
    this.filtroUsuarios = ''; 
  }

  filtrarUsuarios(event: Event): void {
    const valor = (event.target as HTMLInputElement).value.toLowerCase();
    this.filtroUsuarios = valor;
    if (this.mostrarModalSeguidores) {
      this.usuariosFiltrados = this.seguidores.filter(u => u.username.toLowerCase().includes(valor));
    } else if (this.mostrarModalSeguidos) {
      this.usuariosFiltrados = this.seguidos.filter(u => u.username.toLowerCase().includes(valor));
    }
  }

  dejarDeSeguir(userIdToUnfollow: string): void {
    if (!this.isOwnProfile) return;
    this.userSocialService.unfollowUser(userIdToUnfollow).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.seguidos = this.seguidos.filter(u => u._id !== userIdToUnfollow);
          this.usuariosFiltrados = this.usuariosFiltrados.filter(u => u._id !== userIdToUnfollow);
          this.seguidosCount = Math.max(0, (this.seguidosCount || 0) - 1);
          
          if (this.userProfile?._id === userIdToUnfollow && !this.isOwnProfile) {
            this.followStatus = 'none';
            this.isFollowing = false;
          }
          this.cdr.detectChanges();
        });
      },
      error: (error) => console.error('Error al dejar de seguir desde modal:', error)
    });
  }

  eliminarSeguidor(userIdToRemove: string): void {
    if (!this.isOwnProfile) return;
    this.userSocialService.removeFollower(userIdToRemove).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.seguidores = this.seguidores.filter(u => u._id !== userIdToRemove);
          this.usuariosFiltrados = this.usuariosFiltrados.filter(u => u._id !== userIdToRemove);
          this.seguidoresCount = Math.max(0, (this.seguidoresCount || 0) - 1);
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error al eliminar seguidor:', error);
        alert(`Error al eliminar seguidor: ${error.error?.message || 'Ocurrió un problema.'}`);
      }
    });
  }
}