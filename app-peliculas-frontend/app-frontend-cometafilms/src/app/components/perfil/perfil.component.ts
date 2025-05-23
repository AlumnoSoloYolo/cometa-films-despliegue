// perfil.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';

import { UserMovieService } from '../../services/user.service';
import { PeliculasService } from '../../services/peliculas.service';
import { UserSocialService } from '../../services/social.service';
import { AuthService } from '../../services/auth.service';
import { VotoColorPipe } from '../../shared/pipes/voto-color.pipe';
import { PeliculaCardComponent } from '../pelicula-card/pelicula-card.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { MovieListsService } from '../../services/movie-lists.service';
import { MovieList } from '../../models/movie-list.model';

interface UserProfile {
  username: string;
  email?: string;
  avatar: string;
  createdAt: Date;
  pelisPendientes: Array<{ movieId: string, addedAt: Date }>;
  pelisVistas: Array<{ movieId: string, watchedAt: Date }>;
  reviews: Review[];
  biografia: string;
  perfilPrivado: boolean;
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
  imports: [CommonModule, RouterModule, VotoColorPipe, PeliculaCardComponent, ReactiveFormsModule],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  userProfile: UserProfile | null = null;
  mostrarFormularioEdicion: boolean = false;
  configForm: FormGroup;
  peliculasPendientes: any[] = [];
  peliculasVistas: any[] = [];
  reviews: Review[] = [];
  isOwnProfile: boolean = true;
  isFollowing: boolean = false;
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

  constructor(
    private userMovieService: UserMovieService,
    private movieService: PeliculasService,
    private userSocialService: UserSocialService,
    private movieListsService: MovieListsService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
  ) {

    // formulario de edicion de perfil
    this.configForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      avatar: ['avatar1'],
      biografia: ['', [Validators.maxLength(500)]],
      perfilPrivado: [false]
    })

    //  formulario de lista
    this.listaForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      isPublic: [true]
    });
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      const userId = params['id'];
      console.log('ID de usuario en la ruta:', userId);

      if (userId) {
        // Estamos en la ruta /usuarios/:id
        this.authService.currentUser.subscribe(currentUser => {
          console.log('Usuario actual:', currentUser);
          this.isOwnProfile = currentUser && currentUser.id === userId;
          console.log('¿Es perfil propio?', this.isOwnProfile);

          if (this.isOwnProfile) {
            // Es nuestro propio perfil
            console.log('Cargando perfil propio');
            this.loadUserProfile();
            this.cargarListasPropias();
          } else {
            // Es perfil de otro usuario
            console.log('Cargando perfil de otro usuario:', userId);
            this.loadOtherUserProfile(userId);
            this.cargarListasUsuario(userId);
          }
        });
      } else {
        // Estamos en la ruta /perfil
        console.log('Cargando perfil sin ID específico');
        this.isOwnProfile = true;
        this.loadUserProfile();
        this.cargarListasPropias();
      }
    });
  }


  loadUserProfile() {
    this.userMovieService.getUserPerfil().subscribe({
      next: (userData) => {
        this.userProfile = {
          username: userData.username,
          email: userData.email,
          avatar: userData.avatar || 'avatar1',
          createdAt: new Date(userData.createdAt),
          pelisPendientes: userData.pelisPendientes || [],
          pelisVistas: userData.pelisVistas || [],
          reviews: userData.reviews || [],
          biografia: userData.biografia || '',
          perfilPrivado: userData.perfilPrivado || false,
        };

        // Establecer explícitamente isFollowing
        this.isFollowing = userData.isFollowing || false;

        if (this.userProfile.pelisPendientes.length > 0) {
          this.loadPeliculasPendientes();
        }

        if (this.userProfile.pelisVistas.length > 0) {
          this.loadPeliculasVistas();
        }

        this.loadReviews();
        const userId = userData._id || this.authService.currentUserSubject.value.id;
        this.cargarSeguidores(userId);
        this.cargarSeguidos(userId);
      },
      error: (error) => {
        console.error('Error al cargar datos del servidor:', error);
      }
    });
  }

  loadOtherUserProfile(userId: string) {
    this.userSocialService.getUserProfile(userId).subscribe({
      next: (userData: any) => {
        this.userProfile = {
          username: userData.username,
          email: userData.email || '',
          avatar: userData.avatar || 'avatar1',
          createdAt: new Date(userData.createdAt),
          pelisPendientes: userData.pelisPendientes || [],
          pelisVistas: userData.pelisVistas || [],
          reviews: userData.reviews || [],
          biografia: userData.biografia || '',
          perfilPrivado: userData.perfilPrivado || false,
        };


        this.isFollowing = userData.isFollowing || false;

        if (this.userProfile.pelisPendientes.length > 0) {
          this.loadPeliculasPendientes();
        }

        if (this.userProfile.pelisVistas.length > 0) {
          this.loadPeliculasVistas();
        }

        this.loadReviews();
        this.checkFollowStatus();
        this.cargarSeguidores(userId);
        this.cargarSeguidos(userId);
      },
      error: (error: any) => {
        console.error('Error al cargar datos del usuario:', error);
      }
    });
  }

  loadPeliculasPendientes() {
    if (!this.userProfile || !this.userProfile.pelisPendientes) return;

    this.peliculasPendientes = [];

    this.userProfile.pelisPendientes.forEach(peli => {
      this.movieService.getDetallesPelicula(peli.movieId).subscribe({
        next: (movie) => {
          this.peliculasPendientes.push(movie);
        },
        error: (error) => console.error('Error al cargar detalles de película pendiente:', error)
      });
    });
  }

  loadPeliculasVistas() {
    if (!this.userProfile || !this.userProfile.pelisVistas) return;

    this.peliculasVistas = [];

    this.userProfile.pelisVistas.forEach(peli => {
      this.movieService.getDetallesPelicula(peli.movieId).subscribe({
        next: (movie) => {
          this.peliculasVistas.push(movie);
        },
        error: (error) => console.error('Error al cargar detalles de película vista:', error)
      });
    });
  }

  loadReviews() {
    if (!this.userProfile || !this.userProfile.reviews) return;

    this.reviews = this.userProfile.reviews;

    this.reviews.forEach(review => {
      if (review.movieId) {
        this.movieService.getDetallesPelicula(review.movieId).subscribe({
          next: (movie) => {
            review.movieTitle = movie.title;
            review.moviePosterPath = `https://image.tmdb.org/t/p/w200${movie.poster_path}`;
          },
          error: (error) => {
            console.error('Error al cargar los detalles de la película:', error);
          }
        });
      }
    });
  }

  getAvatarPath(): string {
    return `/avatares/${this.userProfile?.avatar}.gif`;
  }

  getAvatar(avatar: string): string {
    return `/avatares/${avatar}.gif`
  }

  getPendientesCount(): number {
    return this.userProfile?.pelisPendientes.length || 0;
  }

  getVistasCount(): number {
    return this.userProfile?.pelisVistas.length || 0;
  }

  getReviewsCount(): number {
    return this.userProfile?.reviews.length || 0;
  }

  onPeliculaVistaAgregada(movieId: string) {
    if (this.userProfile) {
      this.userProfile.pelisVistas = [...this.userProfile.pelisVistas, { movieId, watchedAt: new Date() }];
      this.userProfile.pelisPendientes = this.userProfile.pelisPendientes.filter(peli => peli.movieId !== movieId);

      this.movieService.getDetallesPelicula(movieId).subscribe({
        next: (movie) => {
          this.peliculasVistas = [...this.peliculasVistas, movie];
          this.peliculasPendientes = this.peliculasPendientes.filter(peli => peli.id.toString() !== movieId);
        },
        error: (error) => console.error('Error al cargar detalles de película vista:', error)
      });
    }
  }

  onPeliculaPendienteAgregada(movieId: string) {
    if (this.userProfile) {
      this.userProfile.pelisPendientes = [...this.userProfile.pelisPendientes, { movieId, addedAt: new Date() }];
      this.userProfile.pelisVistas = this.userProfile.pelisVistas.filter(peli => peli.movieId !== movieId);

      this.movieService.getDetallesPelicula(movieId).subscribe({
        next: (movie) => {
          this.peliculasVistas = this.peliculasVistas.filter(peli => peli.id.toString() !== movieId);

          if (!this.peliculasPendientes.some(peli => peli.id.toString() === movieId)) {
            this.peliculasPendientes = [...this.peliculasPendientes, movie];
          }
        },
        error: (error) => console.error('Error al cargar detalles de película pendiente:', error)
      });
    }
  }

  onPeliculaVistaEliminada(movieId: string) {
    if (this.userProfile) {
      this.userProfile.pelisVistas = this.userProfile.pelisVistas.filter(peli => peli.movieId !== movieId);
      this.peliculasVistas = this.peliculasVistas.filter(peli => peli.id.toString() !== movieId);
    }
  }

  onPeliculaPendienteEliminada(movieId: string) {
    if (this.userProfile) {
      this.userProfile.pelisPendientes = this.userProfile.pelisPendientes.filter(peli => peli.movieId !== movieId);
      this.peliculasPendientes = this.peliculasPendientes.filter(peli => peli.id.toString() !== movieId);
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

    let newScroll = direction === 'right'
      ? scrollActual + scrollCantidad
      : scrollActual - scrollCantidad;

    scrollContenido.scrollTo({
      left: newScroll,
      behavior: 'smooth'
    });
  }


  navigateReview(review: any): void {
    console.log('Navegando a review con ID:', review._id);
    if (review && review._id) {
      this.router.navigate(['/resenia', review._id]);
    }
  }



  toggleFollow(): void {
    const userId = this.route.snapshot.paramMap.get('id');

    if (!userId) return;

    // Si ya está siguiendo, dejar de seguir
    if (this.followStatus === 'following') {
      this.userSocialService.unfollowUser(userId).subscribe({
        next: () => {
          this.followStatus = 'none';
          this.isFollowing = false;
          this.isHovering = false;
        },
        error: (error) => {
          console.error('Error al dejar de seguir:', error);
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
        },
        error: (error) => {
          console.error('Error al cancelar solicitud:', error);
        }
      });
      return;
    }

    // En cualquier otro caso, intentar seguir o enviar solicitud
    this.userSocialService.followUser(userId).subscribe({
      next: (response) => {
        this.followStatus = response.status;
        this.requestId = response.requestId || null;
        this.isFollowing = response.status === 'following';
      },
      error: (error) => {
        console.error('Error al seguir usuario:', error);
      }
    });
  }


  checkFollowStatus(): void {
    const userId = this.route.snapshot.paramMap.get('id');
    if (!userId || this.isOwnProfile) return;

    this.userSocialService.getFollowStatus(userId).subscribe({
      next: (response: any) => {
        this.followStatus = response.status;
        this.requestId = response.requestId || null;
        this.isFollowing = response.status === 'following';
      },
      error: (error) => {
        console.error('Error al verificar estado de seguimiento:', error);
      }
    });
  }


  // Método para inicializar el formulario con los datos actuales
  initConfigForm(): void {
    if (!this.userProfile) return;

    this.configForm.patchValue({
      username: this.userProfile.username,
      avatar: this.userProfile.avatar || 'avatar1',
      biografia: this.userProfile.biografia || '',
      perfilPrivado: this.userProfile.perfilPrivado || false
    });
  }

  // Método para abrir el modal de edición
  editarPerfil(): void {
    this.initConfigForm();
    this.mostrarFormularioEdicion = true;
  }

  // Método para cerrar el modal
  cancelarEdicion(): void {
    this.mostrarFormularioEdicion = false;
  }

  // Método para guardar los cambios
  guardarCambiosPerfil(): void {
    if (this.configForm.invalid) return;

    const formData = this.configForm.value;

    this.userMovieService.updateUserProfile(formData).subscribe({
      next: (updatedUser) => {
        // Actualizar datos locales
        if (this.userProfile) {
          this.userProfile = {
            ...this.userProfile,
            username: updatedUser.username,
            avatar: updatedUser.avatar,
            biografia: updatedUser.biografia,
            perfilPrivado: updatedUser.perfilPrivado,
            email: updatedUser.email || this.userProfile.email
          };
        }

        this.cancelarEdicion();
        // Opcional: mostrar mensaje de éxito
        alert('Perfil actualizado correctamente');
      },
      error: (error) => {
        console.error('Error al actualizar perfil:', error);
        alert('Error al actualizar perfil: ' + (error.error?.message || 'Error desconocido'));
      }
    });
  }

  // Método para eliminar la cuenta
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

  // Método para seleccionar avatar
  selectAvatar(avatar: string): void {
    this.configForm.get('avatar')?.setValue(avatar);
  }

  // Método para obtener mensaje de error
  getErrorMessage(field: string): string {
    const control = this.configForm.get(field);

    if (control?.errors) {
      if (control.errors['required']) return 'Este campo es obligatorio';
      if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
      if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    }

    return '';
  }



  // Métodos para listas
  cargarListasPropias(): void {
    this.movieListsService.getUserLists().subscribe({
      next: (response) => {
        this.listas = response.lists;
        this.totalListas = response.totalLists || this.listas.length;
        this.listasOcultas = response.hiddenLists || 0;
        this.isPremium = response.isPremium || false;
      },
      error: (error) => {
        console.error('Error al cargar listas:', error);
      }
    });
  }
  
  cargarListasUsuario(userId: string): void {
    console.log(`Cargando listas para el usuario: ${userId}`);
    // Para listas públicas de otro usuario
    this.movieListsService.getUserPublicLists(userId).subscribe({
      next: (response) => {
        console.log(`Listas recibidas:`, response);
        this.listas = response.lists;
        this.totalListas = response.totalLists || this.listas.length;
        this.listasOcultas = response.hiddenLists || 0;
        this.isPremium = response.isPremium || false;
      },
      error: (error) => {
        console.error('Error al cargar listas de usuario:', error);
      }
    });
  }

  mostrarFormularioCreacionLista(): void {
    this.listaForm.reset({
      title: '',
      description: '',
      isPublic: true
    });
    this.selectedFile = null;
    this.coverImagePreview = null;
    this.mostrarFormularioLista = true;
  }

  cerrarFormularioLista(): void {
    this.mostrarFormularioLista = false;
  }




  async crearLista(): Promise<void> {
    if (this.listaForm.invalid) {
      console.log('Formulario inválido', this.listaForm.errors);
      return;
    }
  
    const formData = this.listaForm.value;
    console.log('Datos del formulario:', formData);
  
    let coverImageBase64 = null;
  
    // Si hay un archivo seleccionado, convertirlo a base64
    if (this.selectedFile) {
      try {
        coverImageBase64 = await this.fileToBase64(this.selectedFile);
      } catch (error) {
        console.error('Error al convertir imagen:', error);
        alert('Error al procesar la imagen. Por favor, inténtalo con otra imagen.');
        return;
      }
    }
  
    const listaData = {
      ...formData,
      coverImage: coverImageBase64
    };
  
    console.log('Enviando datos al servidor:', listaData);
  
    // Crear nueva lista
    this.movieListsService.createList(listaData).subscribe({
      next: (response) => {
        console.log('Respuesta del servidor:', response);
        
        // Asegurarnos de que tenemos la nueva lista
        if (response && response.list) {
          // Asegurar que listas es un array
          if (!Array.isArray(this.listas)) {
            this.listas = [];
          }
          
          // Añadir la nueva lista al principio
          this.listas.unshift(response.list);
          
          // Actualizar los contadores
          this.totalListas = (this.totalListas || 0) + 1;
          
          console.log('Lista añadida localmente, total ahora:', this.totalListas);
        } else {
          console.error('Respuesta del servidor no contiene la lista', response);
        }
        
        this.cerrarFormularioLista();
      },
      error: (error) => {
        console.error('Error al crear lista:', error);
        alert('Error al crear la lista. Por favor, inténtalo de nuevo.');
      }
    });
  }



  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 1 * 1024 * 1024; // 1MB

    if (!validTypes.includes(file.type)) {
      alert('Por favor selecciona una imagen (JPG, PNG, GIF, WEBP)');
      input.value = '';
      return;
    }

    if (file.size > maxSize) {
      alert('La imagen es demasiado grande. El tamaño máximo es 1MB.');
      input.value = '';
      return;
    }

    this.selectedFile = file;
    this.previewImage(file);
  }

  previewImage(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.coverImagePreview = reader.result as string;
    };
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

  verDetalleLista(listaId: string): void {
    this.router.navigate(['/listas', listaId]);
  }

  // Método auxiliar para validación que puedes reutilizar para ambos formularios
  hasFormError(field: string, form: FormGroup): boolean {
    const control = form.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getFormErrorMessage(field: string, form: FormGroup): string {
    const control = form.get(field);
    if (!control) return '';

    if (control.errors) {
      if (control.errors['required']) return 'Este campo es obligatorio';
      if (control.errors['maxlength']) {
        const maxLength = control.errors['maxlength'].requiredLength;
        return `Máximo ${maxLength} caracteres`;
      }
    }
    return '';
  }


  // Métodos para cargar seguidores y seguidos
  cargarSeguidores(userId: string): void {
    this.userSocialService.getUserFollowers(userId).subscribe({
      next: (data) => {
        this.seguidores = data.followers;
        this.seguidoresCount = data.followers.length;
      },
      error: (error) => {
        console.error('Error al cargar seguidores:', error);
      }
    });
  }

  cargarSeguidos(userId: string): void {
    this.userSocialService.getUserFollowing(userId).subscribe({
      next: (data) => {
        this.seguidos = data.following;
        this.seguidosCount = data.following.length;
      },
      error: (error) => {
        console.error('Error al cargar seguidos:', error);
      }
    });
  }

  // Métodos para los modales
  abrirModalSeguidores(): void {
    this.usuariosFiltrados = [...this.seguidores];
    this.mostrarModalSeguidores = true;
  }

  abrirModalSeguidos(): void {
    this.usuariosFiltrados = [...this.seguidos];
    this.mostrarModalSeguidos = true;
  }

  cerrarModales(): void {
    this.mostrarModalSeguidores = false;
    this.mostrarModalSeguidos = false;
    this.filtroUsuarios = '';
  }

  filtrarUsuarios(event: Event): void {
    const valor = (event.target as HTMLInputElement).value.toLowerCase();

    if (this.mostrarModalSeguidores) {
      this.usuariosFiltrados = this.seguidores.filter(u =>
        u.username.toLowerCase().includes(valor)
      );
    } else if (this.mostrarModalSeguidos) {
      this.usuariosFiltrados = this.seguidos.filter(u =>
        u.username.toLowerCase().includes(valor)
      );
    }
  }

  dejarDeSeguir(userId: string): void {
    this.userSocialService.unfollowUser(userId).subscribe({
      next: () => {
        // Actualizar lista de seguidos
        this.seguidos = this.seguidos.filter(u => u._id !== userId);
        this.usuariosFiltrados = this.usuariosFiltrados.filter(u => u._id !== userId);
        this.seguidosCount--;

        // Si estamos viendo el perfil de este usuario, actualizar el estado del botón
        if (this.route.snapshot.paramMap.get('id') === userId) {
          this.followStatus = 'none';
          this.isFollowing = false;
        }
      },
      error: (error) => {
        console.error('Error al dejar de seguir:', error);
      }
    });
  }

  eliminarSeguidor(userId: string): void {
    this.userSocialService.removeFollower(userId).subscribe({
      next: () => {
        // Actualizar lista de seguidores
        this.seguidores = this.seguidores.filter(u => u._id !== userId);
        this.usuariosFiltrados = this.usuariosFiltrados.filter(u => u._id !== userId);
        this.seguidoresCount--;
      },
      error: (error) => {
        console.error('Error al eliminar seguidor:', error);
        alert(`Error: ${error.error?.message || 'No se pudo eliminar el seguidor'}`);
      }
    });
  }

}