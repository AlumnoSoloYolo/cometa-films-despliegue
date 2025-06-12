import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
import { ReportModalComponent, ReportModalData } from '../report/report.component';

// INTERFACES
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
    PeliculaCardComponent,
    ReactiveFormsModule,
    FormsModule,
    ReportModalComponent
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

  showDeleteAccountModal: boolean = false;
  deleteAccountForm: FormGroup;
  passwordVerificationError: string = '';
  failedAttempts: number = 0;
  readonly MAX_FAILED_ATTEMPTS = 3;
  isVerifyingPassword: boolean = false;
  showSuccessModal: boolean = false;
  successMessage: string = '';
  countdownSeconds: number = 5;
  private countdownInterval: any;

  // Variables para prevenir cargas múltiples
  private isLoading = false;

  // Control de carga de películas optimizado
  private readonly MAX_INITIAL_MOVIES = 20;
  private loadedPendientesCount = 0;
  private loadedVistasCount = 0;
  private isLoadingMoreMovies = false;

  // Estados de carga optimizados
  private loadingStates = {
    profile: false,
    movies: false,
    social: false,
    lists: false
  };

  showReportModal = false;
  reportModalData: ReportModalData | null = null;
  currentUser: any;

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
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
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

     this.deleteAccountForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmText: ['', [Validators.required]]
    });

    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnInit() {
    // Prevenir múltiples cargas simultáneas
    if (this.isLoading) return;
    this.isLoading = true;

    this.routeParamsSubscription = this.route.params.subscribe(params => {
      const userIdFromRoute = params['id'];
      const currentAuthUser = this.authService.currentUserSubject.value;

      this.resetComponentState();

      if (userIdFromRoute) {
        this.isOwnProfile = currentAuthUser?.id === userIdFromRoute;
        if (this.isOwnProfile) {
          this.loadOwnProfileOptimized();
        } else {
          this.loadOtherUserProfileOptimized(userIdFromRoute);
        }
      } else {
        this.isOwnProfile = true;
        this.loadOwnProfileOptimized();
      }
    });
  }

  ngOnDestroy() {

    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    if (this.currentUserSubscription) {
      this.currentUserSubscription.unsubscribe();
    }
    if (this.routeParamsSubscription) {
      this.routeParamsSubscription.unsubscribe();
    }
  }

  // Reset completo del estado del componente
  private resetComponentState() {
    this.userProfile = null;
    this.peliculasPendientes = [];
    this.peliculasVistas = [];
    this.reviews = [];
    this.listas = [];
    this.seguidores = [];
    this.seguidos = [];
    this.seguidoresCount = 0;
    this.seguidosCount = 0;
    this.totalListas = 0;
    this.listasOcultas = 0;
    this.socialDataLoaded = false;
    this.loadedPendientesCount = 0;
    this.loadedVistasCount = 0;
    this.followStatus = 'none';
    this.isFollowing = false;

    Object.keys(this.loadingStates).forEach(key => {
      this.loadingStates[key as keyof typeof this.loadingStates] = false;
    });
  }

  // Carga optimizada del perfil propio con forkJoin
  private loadOwnProfileOptimized() {
    this.loadingStates.profile = true;

    forkJoin({
      profile: this.userMovieService.getUserPerfil(),
      lists: this.movieListsService.getUserLists()
    }).subscribe({
      next: ({ profile, lists }) => {
        this.ngZone.run(() => {
          this.setUserProfileData(profile);
          this.setListsData(lists);

          if (profile._id) {
            this.loadSocialDataSeparately(profile._id);
          }

          this.loadEssentialMovieData();
          this.loadingStates.profile = false;
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        this.loadingStates.profile = false;
        this.isLoading = false;
      }
    });
  }

  // Carga optimizada para perfiles de otros usuarios
  private loadOtherUserProfileOptimized(userId: string) {
    this.loadingStates.profile = true;

    forkJoin({
      profileCounts: this.userSocialService.getUserProfileWithCounts(userId),
      lists: this.movieListsService.getUserPublicLists(userId),
      followStatus: this.userSocialService.getFollowStatus(userId),
      social: forkJoin({
        followers: this.userSocialService.getUserFollowers(userId),
        following: this.userSocialService.getUserFollowing(userId)
      })
    }).subscribe({
      next: ({ profileCounts, lists, followStatus, social }) => {
        this.ngZone.run(() => {
          this.setOptimizedUserProfileData(profileCounts);
          this.setListsData(lists);
          this.setFollowStatus(followStatus);
          this.setSocialData(social);

          const isPrivateProfile = this.userProfile?.perfilPrivado === true;
          const hasAccess = !isPrivateProfile || followStatus.status === 'following';

          if (hasAccess) {
            this.loadMovieDataForOtherUser(userId);
          }

          this.loadingStates.profile = false;
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        this.loadingStates.profile = false;
        this.isLoading = false;
        this.loadOtherUserProfileFallback(userId);
      }
    });
  }

  // Método de respaldo si falla la carga optimizada
  private loadOtherUserProfileFallback(userId: string) {
    forkJoin({
      profile: this.userSocialService.getUserProfile(userId),
      lists: this.movieListsService.getUserPublicLists(userId),
      followStatus: this.userSocialService.getFollowStatus(userId),
      social: forkJoin({
        followers: this.userSocialService.getUserFollowers(userId),
        following: this.userSocialService.getUserFollowing(userId)
      })
    }).subscribe({
      next: ({ profile, lists, followStatus, social }) => {
        this.ngZone.run(() => {
          this.setUserProfileData(profile);
          this.setListsData(lists);
          this.setFollowStatus(followStatus);
          this.setSocialData(social);

          const isPrivateProfile = this.userProfile?.perfilPrivado === true;
          const hasAccess = !isPrivateProfile || followStatus.status === 'following';

          if (hasAccess) {
            this.loadEssentialMovieData();
          }

          this.loadingStates.profile = false;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        this.loadingStates.profile = false;
      }
    });
  }

  // Cargar datos de películas específicos para otros usuarios
  private loadMovieDataForOtherUser(userId: string) {
    this.userSocialService.getUserMoviesBasic(userId).subscribe({
      next: (movieData) => {
        if (movieData.hasAccess && this.userProfile) {
          this.userProfile.pelisPendientes = movieData.pelisPendientes || [];
          this.userProfile.pelisVistas = movieData.pelisVistas || [];
          this.userProfile.reviews = movieData.reviews || [];
          this.loadEssentialMovieData();
        }
      },
      error: (error) => {
        this.loadEssentialMovieData();
      }
    });
  }

  // Configurar datos optimizados del backend
  private setOptimizedUserProfileData(profileData: any) {
    this.userProfile = {
      _id: profileData.user._id,
      username: profileData.user.username,
      avatar: profileData.user.avatar || 'avatar1',
      createdAt: new Date(profileData.user.createdAt),
      pelisPendientes: [],
      pelisVistas: [],
      reviews: [],
      biografia: profileData.user.biografia || '',
      perfilPrivado: profileData.user.perfilPrivado !== undefined ? profileData.user.perfilPrivado : false,
      isPremium: profileData.user.isPremium || false,
    };
    this.isPremium = profileData.user.isPremium || false;
    this.seguidoresCount = profileData.followersCount || 0;
    this.seguidosCount = profileData.followingCount || 0;
    this.totalListas = profileData.listsCount || 0;
  }

  // Cargar solo datos esenciales de películas con lazy loading
  private loadEssentialMovieData() {
    if (!this.userProfile) return;

    this.loadingStates.movies = true;

    const pendientesToLoad = (this.userProfile.pelisPendientes || []).slice(0, this.MAX_INITIAL_MOVIES);
    const vistasToLoad = (this.userProfile.pelisVistas || []).slice(0, this.MAX_INITIAL_MOVIES);
    const reviewsToLoad = (this.userProfile.reviews || []).slice(0, this.MAX_INITIAL_MOVIES);

    if (pendientesToLoad.length > 0) {
      this.loadMoviesBatch(pendientesToLoad, 'pendientes');
    }

    if (vistasToLoad.length > 0) {
      this.loadMoviesBatch(vistasToLoad, 'vistas');
    }

    if (reviewsToLoad.length > 0) {
      this.loadReviewsWithMovieData(reviewsToLoad);
    }

    this.loadingStates.movies = false;
  }

  // Cargar lotes de películas usando cache optimizado
  private loadMoviesBatch(moviesList: any[], type: 'pendientes' | 'vistas') {
    if (moviesList.length === 0) return;

    const movieIds = moviesList.map(peli => peli.movieId);

    this.movieService.getMoviesBasicInfo(movieIds).subscribe({
      next: (movies) => {
        movies.forEach(movie => {
          if (movie) {
            if (type === 'pendientes') {
              this.peliculasPendientes.push(movie);
            } else {
              this.peliculasVistas.push(movie);
            }
          }
        });

        if (type === 'pendientes') {
          this.loadedPendientesCount = movies.length;
        } else {
          this.loadedVistasCount = movies.length;
        }

        this.cdr.detectChanges();
      },
      error: (error) => console.error(`Error en lote de películas ${type}:`, error)
    });
  }

  // Cargar datos sociales por separado para evitar conflictos
  private loadSocialDataSeparately(userId: string) {
    if (this.socialDataLoaded) return;

    this.loadingStates.social = true;
    this.socialDataLoaded = true;

    forkJoin({
      followers: this.userSocialService.getUserFollowers(userId),
      following: this.userSocialService.getUserFollowing(userId)
    }).subscribe({
      next: (social) => {
        this.ngZone.run(() => {
          setTimeout(() => {
            // Solo actualiza si los contadores no se han establecido ya
            if (this.seguidoresCount === 0 && this.seguidosCount === 0) {
              this.seguidores = [...(social.followers?.followers || [])];
              this.seguidos = [...(social.following?.following || [])];
              this.seguidoresCount = this.seguidores.length;
              this.seguidosCount = this.seguidos.length;
            }

            this.loadingStates.social = false;
            this.cdr.detectChanges(); // ¡FORZAR ACTUALIZACIÓN!
          }, 0);
        });
      },
      error: (error) => {
        this.loadingStates.social = false;
      }
    });
  }

  // Métodos helper para organizar datos
  private setUserProfileData(userData: any) {
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
      perfilPrivado: userData.perfilPrivado !== undefined ? userData.perfilPrivado : false,
      isPremium: userData.isPremium || false,
    };
    this.isPremium = userData.isPremium || false;
  }

  private setListsData(lists: any) {
    const allLists = lists.lists || [];
    this.isPremium = lists.isPremium || false;

    if (!this.isPremium) {
      this.listas = allLists.slice(0, this.LISTS_LIMIT_FREE_USER);
      this.totalListas = Math.min(lists.totalLists || allLists.length, this.LISTS_LIMIT_FREE_USER);
      this.listasOcultas = (lists.totalLists || allLists.length) - this.totalListas;
    } else {
      this.listas = allLists;
      this.totalListas = lists.totalListas || allLists.length;
      this.listasOcultas = lists.hiddenLists || 0;
    }
  }

  private setSocialData(social: any) {
    if (this.seguidoresCount === 0 && this.seguidosCount === 0) {
      this.seguidores = [...(social.followers?.followers || [])];
      this.seguidos = [...(social.following?.following || [])];
      this.seguidoresCount = this.seguidores.length;
      this.seguidosCount = this.seguidos.length;
    }
  }

  private setFollowStatus(followStatus: any) {
    this.followStatus = followStatus.status;
    this.requestId = followStatus.requestId || null;
    this.isFollowing = followStatus.status === 'following';
  }

  // Cargar reseñas con datos de películas optimizado
  private loadReviewsWithMovieData(reviewsToLoad: any[]) {
    if (reviewsToLoad.length === 0) {
      this.reviews = [];
      return;
    }

    this.reviews = reviewsToLoad.map(review => ({ ...review }));
    const movieIds = [...new Set(reviewsToLoad.map(review => review.movieId))];

    this.movieService.getMoviesBasicInfo(movieIds).subscribe({
      next: (movies) => {
        const movieMap = new Map();
        movies.forEach(movie => {
          if (movie) {
            movieMap.set(movie.id.toString(), movie);
          }
        });

        this.reviews.forEach(review => {
          const movie = movieMap.get(review.movieId);
          if (movie) {
            review.movieTitle = movie.title;
            review.moviePosterPath = movie.poster_path
              ? `https://image.tmdb.org/t/p/w200${movie.poster_path}`
              : undefined;
          } else {
            review.movieTitle = 'Película no encontrada';
          }
        });

        this.cdr.detectChanges();
      },
      error: (error) => console.error('Error al cargar datos de películas para reseñas:', error)
    });
  }

  // Actualizar contadores de películas en tiempo real
  private updateMovieCounts(): void {
    if (!this.userProfile) return;
    // Los contadores se toman directamente de las propiedades del perfil que ya están actualizadas
    this.cdr.detectChanges();
  }

  // Evento: Película agregada a vistas con sincronización completa
  onPeliculaVistaAgregada(movieId: string) {
    if (!this.userProfile) return;

    this.ngZone.run(() => {
      if (!this.userProfile!.pelisVistas.some(p => p.movieId === movieId)) {
        this.userProfile!.pelisVistas.push({ movieId, watchedAt: new Date() });
      }

      this.userProfile!.pelisPendientes = this.userProfile!.pelisPendientes.filter(peli => peli.movieId !== movieId);

      const movieIndex = this.peliculasPendientes.findIndex(peli => peli.id?.toString() === movieId);
      if (movieIndex !== -1) {
        const movie = this.peliculasPendientes[movieIndex];
        this.peliculasPendientes.splice(movieIndex, 1);

        if (!this.peliculasVistas.some(peli => peli.id?.toString() === movieId)) {
          this.peliculasVistas.unshift(movie);
        }
      }

      this.updateMovieCounts();
      this.cdr.detectChanges();
    });
  }

  // Evento: Película agregada a pendientes con sincronización completa
  onPeliculaPendienteAgregada(movieId: string) {
    if (!this.userProfile) return;

    this.ngZone.run(() => {
      if (!this.userProfile!.pelisPendientes.some(p => p.movieId === movieId)) {
        this.userProfile!.pelisPendientes.push({ movieId, addedAt: new Date() });
      }

      this.userProfile!.pelisVistas = this.userProfile!.pelisVistas.filter(peli => peli.movieId !== movieId);

      const movieIndex = this.peliculasVistas.findIndex(peli => peli.id?.toString() === movieId);
      if (movieIndex !== -1) {
        const movie = this.peliculasVistas[movieIndex];
        this.peliculasVistas.splice(movieIndex, 1);

        if (!this.peliculasPendientes.some(peli => peli.id?.toString() === movieId)) {
          this.peliculasPendientes.unshift(movie);
        }
      } else {
        this.movieService.getDetallesPelicula(movieId).subscribe({
          next: (movie) => {
            if (movie && !this.peliculasPendientes.some(peli => peli.id?.toString() === movieId)) {
              this.peliculasPendientes.unshift(movie);
              this.cdr.detectChanges();
            }
          },
          error: (error) => console.error('Error al cargar película para pendientes:', error)
        });
      }

      this.updateMovieCounts();
      this.cdr.detectChanges();
    });
  }

  // Evento: Película eliminada de vistas
  onPeliculaVistaEliminada(movieId: string) {
    if (!this.userProfile) return;

    this.ngZone.run(() => {
      this.userProfile!.pelisVistas = this.userProfile!.pelisVistas.filter(peli => peli.movieId !== movieId);
      this.peliculasVistas = this.peliculasVistas.filter(peli => peli.id?.toString() !== movieId);
      this.updateMovieCounts();
      this.cdr.detectChanges();
    });
  }

  // Evento: Película eliminada de pendientes
  onPeliculaPendienteEliminada(movieId: string) {
    if (!this.userProfile) return;

    this.ngZone.run(() => {
      this.userProfile!.pelisPendientes = this.userProfile!.pelisPendientes.filter(peli => peli.movieId !== movieId);
      this.peliculasPendientes = this.peliculasPendientes.filter(peli => peli.id?.toString() !== movieId);
      this.updateMovieCounts();
      this.cdr.detectChanges();
    });
  }

  onScrollNearEnd(section: 'pendientes' | 'vistas') {
    if (this.isLoadingMoreMovies || this.loadingStates.movies) return;

    const currentCount = section === 'pendientes'
      ? this.peliculasPendientes.length
      : this.peliculasVistas.length;

    const totalCount = section === 'pendientes'
      ? (this.userProfile?.pelisPendientes?.length || 0)
      : (this.userProfile?.pelisVistas?.length || 0);

    if (currentCount < totalCount) {
      this.loadMoreMovies(section, currentCount);
    }
  }

  // Cargar más películas con lazy loading
  private loadMoreMovies(section: 'pendientes' | 'vistas', currentCount: number) {
    this.isLoadingMoreMovies = true;
    const batchSize = 10;
    const moviesList = section === 'pendientes'
      ? this.userProfile?.pelisPendientes
      : this.userProfile?.pelisVistas;

    if (!moviesList) {
      this.isLoadingMoreMovies = false;
      return;
    }

    const nextBatch = moviesList.slice(currentCount, currentCount + batchSize);

    const requests = nextBatch.map(peli =>
      this.movieService.getDetallesPelicula(peli.movieId).pipe(
        catchError(() => of(null))
      )
    );

    forkJoin(requests).subscribe({
      next: (movies) => {
        movies.forEach(movie => {
          if (movie) {
            if (section === 'pendientes') {
              this.peliculasPendientes.push(movie);
            } else {
              this.peliculasVistas.push(movie);
            }
          }
        });
        this.isLoadingMoreMovies = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoadingMoreMovies = false;
      }
    });
  }

  // Verificar estados de carga
  // isLoading(section?: string): boolean {
  //   if (section) {
  //     return this.loadingStates[section as keyof typeof this.loadingStates];
  //   }
  //   return Object.values(this.loadingStates).some(loading => loading);
  // }

  // Iniciar chat con usuario
  iniciarChatConUsuario(): void {
    if (!this.userProfile || !this.userProfile._id) {
      alert('No se pudo obtener la información del usuario para iniciar el chat.');
      return;
    }
    const recipientId = this.userProfile._id;
    const currentAuthUser = this.authService.currentUserSubject.value;

    if (!currentAuthUser || !currentAuthUser.id) {
      alert('Debes iniciar sesión para enviar mensajes.');
      this.router.navigate(['/login']);
      return;
    }

    if (currentAuthUser.id === recipientId) {
      return;
    }

    this.chatService.getOrCreateChat(recipientId).subscribe({
      next: (chat) => {
        if (chat && chat._id) {
          this.router.navigate(['/chat', chat._id]);
        } else {
          alert('No se pudo iniciar la conversación. Inténtalo de nuevo más tarde.');
        }
      },
      error: (error) => {
        alert('Error al iniciar la conversación: ' + (error.error?.message || 'Problema de conexión o del servidor.'));
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

  // Gestión de seguimiento con actualización de contadores
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

  // Verificar estado de seguimiento
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

  // Inicializar formulario de configuración
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

  // Guardar cambios del perfil
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
        alert('Error al actualizar perfil: ' + (error.error?.message || 'Error desconocido'));
      }
    });
  }

  // Eliminar cuenta de usuario
  eliminarCuenta(): void {

    this.showDeleteAccountModal = true;
    this.resetDeleteAccountForm();
  }


  selectAvatar(avatar: string): void { this.configForm.get('avatar')?.setValue(avatar); }

  // Obtener mensaje de error de formulario
  getErrorMessage(field: string): string {
    const control = this.configForm.get(field);
    if (control?.errors) {
      if (control.errors['required']) return 'Este campo es obligatorio.';
      if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
      if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    }
    return '';
  }

  // Cargar listas propias del usuario
  cargarListasPropias(): void {
    this.movieListsService.getUserLists().subscribe({
      next: (response) => {
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
      },
      error: (error) => {
        this.listas = [];
        this.listasOcultas = 0;
      }
    });
  }

  // Cargar listas públicas de otro usuario
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

  // Crear nueva lista con imagen de portada
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
        alert('Error al procesar la imagen. Inténtalo con otra.');
        return;
      }
    }
    const listaData = { ...formData, coverImage: coverImageBase64 };

    this.movieListsService.createList(listaData).subscribe({
      next: (response) => {
        if (response && response.list) {
          if (this.isOwnProfile) {
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
        if (error.error && error.error.error === 'PREMIUM_REQUIRED') {
          alert(error.error.message);
        } else {
          alert('Error al crear la lista: ' + (error.error?.message || 'Por favor, inténtalo de nuevo.'));
        }
      }
    });
  }

  // Manejar selección de archivo de imagen
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

  // Previsualizar imagen seleccionada
  previewImage(file: File): void {
    const reader = new FileReader();
    reader.onload = () => this.coverImagePreview = reader.result as string;
    reader.readAsDataURL(file);
  }

  // Convertir archivo a base64
  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  verDetalleLista(listaId: string): void { this.router.navigate(['/listas', listaId]); }

  // Verificar si formulario tiene errores
  hasFormError(field: string, form: FormGroup): boolean {
    const control = form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  // Obtener mensaje de error específico del formulario
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

  // Cargar seguidores con protección contra sobrescritura
  cargarSeguidores(userId: string): void {
    if (!userId) return;

    this.userSocialService.getUserFollowers(userId).subscribe({
      next: (data) => {
        setTimeout(() => {
          this.ngZone.run(() => {
            if (data && data.followers) {
              this.seguidores = [...data.followers];
              this.seguidoresCount = this.seguidores.length;
              this.cdr.markForCheck();
              this.cdr.detectChanges();
              setTimeout(() => {
                this.cdr.detectChanges();
              }, 0);
            }
          });
        }, 10);
      },
      error: (error) => {
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

  // Cargar seguidos con protección contra sobrescritura
  cargarSeguidos(userId: string): void {
    if (!userId) return;

    this.userSocialService.getUserFollowing(userId).subscribe({
      next: (data) => {
        setTimeout(() => {
          this.ngZone.run(() => {
            if (data && data.following) {
              this.seguidos = [...data.following];
              this.seguidosCount = this.seguidos.length;
              this.cdr.markForCheck();
              this.cdr.detectChanges();
              setTimeout(() => {
                this.cdr.detectChanges();
              }, 0);
            }
          });
        }, 10);
      },
      error: (error) => {
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

  // Filtrar usuarios en modales
  filtrarUsuarios(event: Event): void {
    const valor = (event.target as HTMLInputElement).value.toLowerCase();
    this.filtroUsuarios = valor;
    if (this.mostrarModalSeguidores) {
      this.usuariosFiltrados = this.seguidores.filter(u => u.username.toLowerCase().includes(valor));
    } else if (this.mostrarModalSeguidos) {
      this.usuariosFiltrados = this.seguidos.filter(u => u.username.toLowerCase().includes(valor));
    }
  }

  // Dejar de seguir desde modal con actualización de contadores
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

  // Eliminar seguidor con actualización de contadores
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
        alert(`Error al eliminar seguidor: ${error.error?.message || 'Ocurrió un problema.'}`);
      }
    });
  }

   // Resetear formulario de eliminación
  private resetDeleteAccountForm(): void {
    this.deleteAccountForm.reset({
      password: '',
      confirmText: ''
    });
    this.passwordVerificationError = '';
    this.failedAttempts = 0;
    this.isVerifyingPassword = false; 
  }

  // Verificar contraseña y eliminar cuenta
  confirmarEliminacionCuenta(): void {
    // Prevenir múltiples envíos
    if (this.isVerifyingPassword) {
      return;
    }

    if (this.deleteAccountForm.invalid) {
      Object.values(this.deleteAccountForm.controls).forEach(control => {
        control.markAsTouched();
      });
      return;
    }

    const formData = this.deleteAccountForm.value;
    
    // Verificar que el texto de confirmación sea correcto
    if (formData.confirmText !== 'ELIMINAR MI CUENTA') {
      this.passwordVerificationError = 'Debes escribir exactamente "ELIMINAR MI CUENTA" para continuar.';
      return;
    }

    this.isVerifyingPassword = true;
    this.passwordVerificationError = '';

    // Verificar contraseña antes de eliminar la cuenta
    this.authService.verifyPassword(formData.password).subscribe({
      next: (isValid) => {
        if (isValid) {
          // Contraseña correcta, proceder con eliminación
          this.proceedWithAccountDeletion();
        } else {
          this.handlePasswordVerificationFailure();
        }
      },
      error: (error) => {
        this.handlePasswordVerificationFailure();
      }
    });
  }

  // Manejar fallo en verificación de contraseña
  private handlePasswordVerificationFailure(): void {
    this.failedAttempts++;
    this.isVerifyingPassword = false; // Re-habilitar el botón
    
    if (this.failedAttempts >= this.MAX_FAILED_ATTEMPTS) {
      this.passwordVerificationError = `Demasiados intentos fallidos. Por seguridad, cerraremos tu sesión.`;
      
      // Hacer logout después de 3 segundos
      setTimeout(() => {
        this.authService.logout();
        this.router.navigate(['/login']);
      }, 3000);
    } else {
      const remainingAttempts = this.MAX_FAILED_ATTEMPTS - this.failedAttempts;
      this.passwordVerificationError = `Contraseña incorrecta. Te quedan ${remainingAttempts} intento${remainingAttempts !== 1 ? 's' : ''}.`;
    }
  }

  // Proceder con la eliminación de la cuenta
  private proceedWithAccountDeletion(): void {
    // Deshabilitar el botón inmediatamente para evitar múltiples clicks
    this.isVerifyingPassword = true;
    
    this.userMovieService.deleteAccount().subscribe({
      next: () => {
        // Cerrar el modal de confirmación
        this.showDeleteAccountModal = false;
        
        // Mostrar modal de éxito en lugar de alert
        this.showSuccessMessage('Tu cuenta ha sido eliminada correctamente. Lamentamos verte partir.');
        
        // Hacer logout después del countdown
        this.startLogoutCountdown();
      },
      error: (error) => {
        this.passwordVerificationError = 'Error al eliminar la cuenta: ' + (error.error?.message || 'Error del servidor');
        this.isVerifyingPassword = false; // Re-habilitar el botón en caso de error
      }
    });
  }

    // Mostrar mensaje de éxito con modal personalizado
  private showSuccessMessage(message: string): void {
    this.successMessage = message;
    this.showSuccessModal = true;
    this.countdownSeconds = 5;
  }

  // Iniciar countdown para logout
  private startLogoutCountdown(): void {
    this.countdownInterval = setInterval(() => {
      this.countdownSeconds--;
      
      if (this.countdownSeconds <= 0) {
        this.performLogout();
      }
    }, 1000);
  }

    // Realizar logout y redirección
  private performLogout(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    
    this.showSuccessModal = false;
    
    // Hacer logout primero
    this.authService.logout();
    
    // Redireccionar a la página principal
    this.router.navigate(['/'])
      .then(() => {
        // Opcional: Forzar recarga para limpiar completamente el estado
        window.location.reload();
      });
  }

    // Cerrar modal de éxito manualmente
  closeSuccessModal(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.performLogout();
  }

  // Cancelar eliminación de cuenta
  cancelarEliminacionCuenta(): void {
      this.showDeleteAccountModal = false;
      this.resetDeleteAccountForm();
    }

  // Cerrar modal haciendo click en overlay
  closeDeleteAccountModal(event: Event): void {
    event.stopPropagation();
    this.cancelarEliminacionCuenta();
  }

  // Verificar errores del formulario de eliminación
  hasDeleteAccountFormError(field: string): boolean {
    const control = this.deleteAccountForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  // Obtener mensaje de error del formulario de eliminación
  getDeleteAccountFormErrorMessage(field: string): string {
    const control = this.deleteAccountForm.get(field);
    if (!control) return '';

    if (control.errors) {
      if (control.errors['required']) {
        if (field === 'password') return 'La contraseña es obligatoria';
        if (field === 'confirmText') return 'Debes escribir el texto de confirmación';
      }
      if (control.errors['minlength']) {
        return `La contraseña debe tener al menos ${control.errors['minlength'].requiredLength} caracteres`;
      }
    }
    return '';
  }


  /**
 * Reportar usuario del perfil
 */
  reportUser(): void {
    if (!this.currentUser || !this.userProfile) {
      alert('Debes iniciar sesión para reportar contenido');
      return;
    }

    // No permitir auto-reportes
    if (this.currentUser.id === this.userProfile._id) {
      return;
    }

    this.reportModalData = {
      targetUser: {
        _id: this.userProfile._id!,
        username: this.userProfile.username,
        avatar: this.userProfile.avatar
      },
      contentType: 'user'
      // No se pasa contentId para reportes de usuario
    };

    this.showReportModal = true;
  }

  /**
   * Verificar si se puede reportar el usuario
   */
  canReportUser(): boolean {
    return this.currentUser &&
      this.userProfile &&
      this.currentUser.id !== this.userProfile._id;
  }

  /**
   * Cerrar modal de reporte
   */
  onReportModalClosed(): void {
    this.showReportModal = false;
    this.reportModalData = null;
  }

  /**
   * Manejar cuando se envía un reporte exitosamente
   */
  onReportSubmitted(): void {
    console.log('Reporte de usuario enviado exitosamente');
  }
}