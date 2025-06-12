import { Component, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { VotoColorPipe } from '../../shared/pipes/voto-color.pipe';
import { PeliculasService } from '../../services/peliculas.service';
import { UserMovieService } from '../../services/user.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PeliculaCardComponent } from '../pelicula-card/pelicula-card.component';
import { AuthService } from '../../services/auth.service';
import { MovieListsService } from '../../services/movie-lists.service';
import { MovieList } from '../../models/movie-list.model';
import { LikeButtonComponent } from '../like-button/like-button.component';
import { ShareButtonComponent } from '../share-button/share-button.component';

@Component({
  selector: 'app-pelicula-detalles',
  standalone: true,
  imports: [
    RouterModule,
    VotoColorPipe,
    CommonModule,
    ReactiveFormsModule,
    PeliculaCardComponent,
    LikeButtonComponent,
    ShareButtonComponent
  ],
  templateUrl: './pelicula-detalles.component.html',
  styleUrl: './pelicula-detalles.component.css'
})
export class PeliculaDetallesComponent implements OnInit {
  pelicula: any;
  trailerUrl: SafeResourceUrl | null = null;
  reviews: any[] = [];
  mostrarFormularioReview = false;
  reviewUsuarioActual: any = null;
  cargandoReviews = false;
  reviewForm: FormGroup;
  currentUser: any;
  isPendiente: boolean = false;
  isVista: boolean = false;

  // Variables para optimización de perfil
  userProfile: any = null;
  isAuthenticated = false;

  mostrarModalListas = false;
  misListas: MovieList[] = [];
  cargandoListas = false;
  mostrarCrearLista = false;
  nuevaListaForm: FormGroup;
  selectedFile: File | null = null;
  coverImagePreview: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private pelisService: PeliculasService,
    private userMovieService: UserMovieService,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder,
    private authService: AuthService,
    private movieListsService: MovieListsService
  ) {

    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
      this.isAuthenticated = !!user;

      // Cargar perfil una sola vez si está autenticado
      if (this.isAuthenticated && !this.userProfile) {
        this.loadUserProfile();
      }
    });

    this.reviewForm = this.fb.group({
      rating: [0, [Validators.required, Validators.min(1), Validators.max(10)]],
      comment: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]]
    });

    this.nuevaListaForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      isPublic: [true],
      coverImage: [null]
    });

    window.scrollTo({
      top: -100,
      left: 0,
      behavior: 'smooth'
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      console.log('Parámetros de la ruta:', params);
      console.log('ID extraído:', id);
      this.verificarEstadoPelicula(id)
      this.cargarDetallesPelicula(id);
      this.cargarReviews(id);
      window.scrollTo({
        top: -100,
        left: 0,
        behavior: 'smooth'
      });
    });
  }

  verificarEstadoPelicula(movieId: string): void {
    // Si ya tenemos el perfil cargado, lo usamos directamente
    if (this.userProfile) {
      this.isPendiente = this.userProfile.pelisPendientes.some((peli: any) => peli.movieId === movieId);
      this.isVista = this.userProfile.pelisVistas.some((peli: any) => peli.movieId === movieId);
      return;
    }

    // Si no, cargamos el perfil (fallback)
    this.userMovieService.getUserPerfil().subscribe({
      next: (perfil) => {
        this.userProfile = perfil;
        this.isPendiente = perfil.pelisPendientes.some((peli: any) => peli.movieId === movieId);
        this.isVista = perfil.pelisVistas.some((peli: any) => peli.movieId === movieId);
      },
      error: (error) => console.error('Error al obtener perfil:', error)
    });
  }

  // Nuevo método para cargar el perfil una sola vez
  private loadUserProfile(): void {
    console.log('📡 Cargando perfil de usuario en PeliculaDetalles...');
    this.userMovieService.getUserPerfil().subscribe({
      next: (perfil) => {
        this.userProfile = perfil;
        console.log('✅ Perfil cargado, será reutilizado por las películas similares');
      },
      error: (error) => {
        console.error('Error al cargar perfil:', error);
        this.userProfile = null;
      }
    });
  }

  togglePendiente(event: Event): void {
    event.stopPropagation();
    if (this.isPendiente) {
      this.userMovieService.removePelisPendientes(this.pelicula.id).subscribe({
        next: () => {
          this.isPendiente = false;
        },
        error: (error) => console.error('Error al quitar de pendientes:', error)
      });
    } else {
      this.userMovieService.addPelisPendientes(this.pelicula.id).subscribe({
        next: () => {
          this.isPendiente = true;
          this.isVista = false; // Si se añade a pendientes, no puede estar en vistas
        },
        error: (error) => console.error('Error al añadir a pendientes:', error)
      });
    }
  }

  toggleVista(event: Event): void {
    event.stopPropagation();
    if (this.isVista) {
      this.userMovieService.removePelisVistas(this.pelicula.id).subscribe({
        next: () => {
          this.isVista = false;
        },
        error: (error) => console.error('Error al quitar de vistas:', error)
      });
    } else {
      this.userMovieService.addPelisVistas(this.pelicula.id).subscribe({
        next: () => {
          this.isVista = true;
          this.isPendiente = false; // Si se marca como vista, no puede estar pendiente
        },
        error: (error) => console.error('Error al añadir a vistas:', error)
      });
    }
  }

  isCurrentUserReview(review: any): boolean {
    return this.currentUser?.id === review.userId;
  }

  cargarDetallesPelicula(id: string): void {
    console.log('ID recibido:', id);
    console.log('Llamando a la API con ID:', id);

    // CAMBIADO: Usamos el nuevo método de detalles completos
    this.pelisService.getDetallesCompletaPelicula(id).subscribe({
      next: (data) => {
        console.log('Datos COMPLETOS recibidos de la API:', data);
        console.log('¿Tiene credits?:', !!data.credits);
        console.log('¿Tiene similar?:', !!data.similar);
        console.log('¿Tiene videos?:', !!data.videos);

        this.pelicula = data;

        // Verificar que existan videos antes de buscar el trailer
        if (this.pelicula.videos && this.pelicula.videos.results) {
          const trailerKey = this.getTrailerClave(this.pelicula.videos.results);
          if (trailerKey) {
            this.trailerUrl = this.getVideoUrl(trailerKey);
          }
        }

        this.cargarReviews(id);
      },
      error: (error) => {
        console.error("Error al cargar los detalles de la película", error)
      }
    });
  }

  getTrailerClave(videos: any[]): string | null {
    if (!videos || videos.length === 0) return null;
    const trailer = videos.find(video => video.type === 'Trailer' && video.site === 'YouTube');
    return trailer ? trailer.key : null;
  }

  getVideoUrl(key: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${key}`
    );
  }

  getDirector(): any {
    // Verificar que existan los datos antes de buscar
    if (!this.pelicula?.credits?.crew) {
      return { name: 'Información no disponible' };
    }

    const director = this.pelicula.credits.crew.find((person: any) => person.job === 'Director');
    return director || { name: 'Director no encontrado' };
  }

  getAvatarPath(avatarName: string): string {
    return `/avatares/${avatarName}.gif`;
  }

  scrollSection(sectionId: string, direction: 'left' | 'right'): void {
    const container = document.getElementById(sectionId);
    if (!container) return;

    const scrollContenido = container.querySelector('.movie-scroll__content');
    if (!scrollContenido) return;

    const itemAncho = scrollContenido.querySelector('.movie-scroll__item')?.clientWidth || 300;
    const scrollCantidad = itemAncho * 2;
    const scrollActual = scrollContenido.scrollLeft;

    let newScroll = direction === 'right'
      ? Math.min(scrollActual + scrollCantidad)
      : Math.max(scrollActual - scrollCantidad);

    scrollContenido.scrollTo({
      left: newScroll,
      behavior: 'smooth'
    });
  }

  cargarReviews(movieId: string): void {
    this.cargandoReviews = true;

    // Solo cargar reseñas de nuestra base de datos (no TMDB)
    this.userMovieService.getReviewsPelicula(movieId).subscribe({
      next: (data) => {
        const userReviews = data.reviews.map((review: any) => ({
          ...review,
          avatar: this.getAvatarPath(review.avatar || 'avatar5')
        }));

        this.reviews = userReviews;

        // Verificar si el usuario actual tiene una reseña
        this.userMovieService.getReviewsUsuario().subscribe({
          next: (userReviews) => {
            this.reviewUsuarioActual = userReviews.find(r => r.movieId === movieId);
            this.cargandoReviews = false;
          },
          error: (error) => {
            console.error('Error al cargar review del usuario:', error);
            this.cargandoReviews = false;
          }
        });
      },
      error: (error) => {
        console.error('Error al cargar reviews:', error);
        this.cargandoReviews = false;
      }
    });
  }

  submitReview(): void {
    if (this.reviewForm.invalid) {
      Object.keys(this.reviewForm.controls).forEach(key => {
        const control = this.reviewForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      return;
    }

    const reviewData = this.reviewForm.value;

    if (this.reviewUsuarioActual) {
      this.userMovieService.updateReview(this.pelicula.id, reviewData).subscribe({
        next: (updatedReviewResponse) => {
          console.log('Respuesta de actualización:', updatedReviewResponse);
          const updatedReview = updatedReviewResponse.review;
          const index = this.reviews.findIndex(review => review._id === updatedReview._id);
          if (index !== -1) {
            this.reviews[index] = updatedReview;
          } else {
            this.reviews.unshift(updatedReview);
          }
          this.cargarReviews(this.pelicula.id);
          window.location.reload()
          this.mostrarFormularioReview = false;
          this.reviewForm.reset({ rating: 0, comment: '' });
          this.reviewUsuarioActual = updatedReview;
        },
        error: (error) => console.error('Error al actualizar review:', error)
      });
    } else {
      this.userMovieService.addReview(this.pelicula.id, reviewData).subscribe({
        next: (newReview) => {
          this.cargarReviews(this.pelicula.id);
          window.location.reload()
          this.mostrarFormularioReview = false;
          this.reviewForm.reset({ rating: 0, comment: '' });
          this.reviewUsuarioActual = newReview;
        },
        error: (error) => console.error('Error al añadir review:', error)
      });
    }
  }

  editarReview(): void {
    console.log('Reseña del usuario actual:', this.reviewUsuarioActual);
    if (!this.reviewUsuarioActual) {
      console.error('No hay una reseña para editar.');
      return;
    }

    this.reviewForm.patchValue({
      rating: this.reviewUsuarioActual.rating,
      comment: this.reviewUsuarioActual.comment
    });

    this.mostrarFormularioReview = true;
  }

  eliminarReview(): void {
    
    if (!this.reviewUsuarioActual || !this.reviewUsuarioActual._id) {
      console.error('Error: No se encontró el ID de la reseña para eliminar.');
      return;
    } 
    const idDeLaResena = this.reviewUsuarioActual._id;
    if (confirm('¿Estás seguro de que quieres eliminar tu review?')) {
      
  
      this.userMovieService.deleteReview(idDeLaResena).subscribe({
        next: () => {
          console.log('Reseña eliminada con éxito desde el frontend.');
          this.reviewUsuarioActual = null; 
          // Vuelve a cargar las demás reseñas para que la UI se actualice.
          this.cargarReviews(this.pelicula.id); 
        },
        error: (error) => console.error('Error al eliminar review:', error)
      });
    }
  }
  setRating(rating: number): void {
    this.reviewForm.patchValue({ rating });
  }

  navigateReview(review: any): void {
    if (review && review.reviewId) {
      this.router.navigate(['/resenia', review.reviewId]);
    } else {
      console.error('No se encontró el ID de la reseña.');
    }
  }

  trackReview(index: number, review: any): any {
    return review.reviewId;
  }

  // Métodos para manejar eventos de películas similares
  onPeliculaVistaAgregada(movieId: string) {
    if (!this.userProfile) return;
    if (!this.userProfile.pelisVistas.some((p: any) => p.movieId === movieId)) {
      this.userProfile.pelisVistas.push({ movieId, watchedAt: new Date() });
    }
    this.userProfile.pelisPendientes = this.userProfile.pelisPendientes.filter((peli: any) => peli.movieId !== movieId);
  }

  onPeliculaPendienteAgregada(movieId: string) {
    if (!this.userProfile) return;
    if (!this.userProfile.pelisPendientes.some((p: any) => p.movieId === movieId)) {
      this.userProfile.pelisPendientes.push({ movieId, addedAt: new Date() });
    }
    this.userProfile.pelisVistas = this.userProfile.pelisVistas.filter((peli: any) => peli.movieId !== movieId);
  }

  onPeliculaVistaEliminada(movieId: string) {
    if (!this.userProfile) return;
    this.userProfile.pelisVistas = this.userProfile.pelisVistas.filter((peli: any) => peli.movieId !== movieId);
  }

  onPeliculaPendienteEliminada(movieId: string) {
    if (!this.userProfile) return;
    this.userProfile.pelisPendientes = this.userProfile.pelisPendientes.filter((peli: any) => peli.movieId !== movieId);
  }

  // Métodos para manejo de listas
  abrirModalListas(event: Event): void {
    event.stopPropagation();
    this.mostrarModalListas = true;
    this.mostrarCrearLista = false;
    this.cargarMisListas();
  }

  cerrarModalListas(): void {
    this.mostrarModalListas = false;
    this.mostrarCrearLista = false;
    this.nuevaListaForm.reset({ isPublic: true });
    this.selectedFile = null;
    this.coverImagePreview = null;
  }

  cargarMisListas(): void {
    if (this.authService.isAuthenticated()) {
      this.movieListsService.getUserLists().subscribe({
        next: (response) => {
          this.misListas = response.lists;
        },
        error: (error) => {
          console.error('Error al cargar listas:', error);
        }
      });
    }
  }

  peliculaEnLista(lista: MovieList, movieId: string): boolean {
    return lista.movies.some(movie => movie.movieId === movieId.toString());
  }

  togglePeliculaEnLista(lista: MovieList, movieId: string): void {
    const estaEnLista = this.peliculaEnLista(lista, movieId);

    if (estaEnLista) {
      // Eliminar de la lista
      this.movieListsService.removeMovieFromList(lista._id, movieId.toString()).subscribe({
        next: () => {
          // Actualizar la lista local
          const index = this.misListas.findIndex(l => l._id === lista._id);
          if (index !== -1) {
            this.misListas[index].movies = this.misListas[index].movies.filter(
              movie => movie.movieId !== movieId.toString()
            );
          }
        },
        error: (error) => {
          console.error('Error al quitar película de la lista:', error);
          alert('Error al quitar película de la lista');
        }
      });
    } else {
      // Añadir a la lista
      this.movieListsService.addMovieToList(lista._id, movieId.toString()).subscribe({
        next: (response) => {
          // Actualizar la lista local
          const index = this.misListas.findIndex(l => l._id === lista._id);
          if (index !== -1) {
            this.misListas[index] = response.list;
          }
        },
        error: (error) => {
          console.error('Error al añadir película a la lista:', error);
          alert('Error al añadir película a la lista');
        }
      });
    }
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

  async crearListaDesdeModal(): Promise<void> {
    if (this.nuevaListaForm.invalid) {
      return;
    }

    const formData = this.nuevaListaForm.value;
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

    // Crear nueva lista
    this.movieListsService.createList(listaData).subscribe({
      next: (response) => {
        // Añadir la película a la nueva lista
        this.movieListsService.addMovieToList(response.list._id, this.pelicula.id.toString()).subscribe({
          next: () => {
            alert('Lista creada y película añadida correctamente');
            // Recargar listas y volver a la vista principal
            this.mostrarCrearLista = false;
            this.cargarMisListas();
            this.nuevaListaForm.reset({ isPublic: true });
            this.selectedFile = null;
            this.coverImagePreview = null;
          },
          error: (error) => {
            console.error('Error al añadir película a la nueva lista:', error);
            alert('La lista se creó correctamente, pero hubo un error al añadir la película.');
          }
        });
      },
      error: (error) => {
        console.error('Error al crear lista:', error);
        alert('Error al crear la lista. Por favor, inténtalo de nuevo.');
      }
    });
  }

  fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

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
      if (control.errors['minlength']) {
        const minLength = control.errors['minlength'].requiredLength;
        return `Mínimo ${minLength} caracteres`;
      }
    }
    return '';
  }
}