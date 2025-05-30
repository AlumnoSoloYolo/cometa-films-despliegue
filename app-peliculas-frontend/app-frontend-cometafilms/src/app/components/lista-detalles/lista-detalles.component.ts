import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MovieListsService } from '../../services/movie-lists.service';
import { PeliculasService } from '../../services/peliculas.service';
import { AuthService } from '../../services/auth.service';
import { UserSocialService } from '../../services/social.service';
import { MovieList } from '../../models/movie-list.model';
import { PeliculaCardComponent } from '../pelicula-card/pelicula-card.component';
import { LikeButtonComponent } from '../like-button/like-button.component';

export interface ListResponse {
  list: MovieList;
  isOwner: boolean;
}

@Component({
  selector: 'app-lista-detalles',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, PeliculaCardComponent, LikeButtonComponent, FormsModule],
  templateUrl: './lista-detalles.component.html',
  styleUrls: ['./lista-detalles.component.css']
})
export class ListaDetallesComponent implements OnInit {
  lista: MovieList | null = null;
  isLoading: boolean = true;
  isOwnList: boolean = false;
  creadorLista: string = '';
  peliculasLista: any[] = [];
  resultadosBusqueda: any[] = [];
  searchForm: FormGroup;
  listaForm: FormGroup;
  mostrarFormularioEdicion: boolean = false;
  selectedFile: File | null = null;
  coverImagePreview: string | null = null;
  currentUser: any;
  mostrarModalBusqueda: boolean = false;
  busquedaQuery: string = '';
  peliculasBusqueda: any[] = [];
  cargandoBusqueda: boolean = false;
  paginaActual: number = 1;
  hayMasPaginas: boolean = true;
  busquedaRealizada: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private movieListsService: MovieListsService,
    private peliculasService: PeliculasService,
    private authService: AuthService,
    private userSocialService: UserSocialService,
    private fb: FormBuilder
  ) {
    this.searchForm = this.fb.group({
      query: ['', [Validators.required, Validators.minLength(2)]]
    });

    this.listaForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      isPublic: [true]
    });

    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const listId = params['id'];
      if (listId) {
        this.cargarLista(listId);
      } else {
        this.isLoading = false;
      }
    });
  }

cargarLista(listId: string): void {
  this.isLoading = true;
  this.movieListsService.getListById(listId).subscribe({
    next: (response: any) => {
      if (response.list) {
        this.lista = response.list;
        this.isOwnList = response.isOwner;
      } else {
        this.lista = response;
        if (this.currentUser && this.lista) {
          const userId = this.lista.userId as any;
          const listaUserId = typeof userId === 'object' && userId._id 
            ? userId._id 
            : String(userId);
          this.isOwnList = listaUserId === String(this.currentUser.id);
        } else {
          this.isOwnList = false;
        }
      }
      
      this.cargarPeliculasDeLista();
      this.obtenerNombreCreador();
      this.initEditForm();
      this.isLoading = false;
    },
    error: (error) => {
      console.error('Error al cargar la lista:', error);
      this.isLoading = false;
    }
  });
}

cargarPeliculasDeLista(): void {
  if (!this.lista || !this.lista.movies || this.lista.movies.length === 0) {
    this.peliculasLista = [];
    return;
  }

  this.peliculasLista = [];
  this.lista.movies.forEach(movie => {
    this.peliculasService.getDetallesPelicula(movie.movieId).subscribe({
      next: (pelicula) => {
        this.peliculasLista.push(pelicula);
      },
      error: (error) => {
        console.error(`Error al cargar película ${movie.movieId}:`, error);
      }
    });
  });
}

obtenerNombreCreador(): void {
  if (!this.lista?.userId) {
    this.creadorLista = 'Usuario desconocido';
    return;
  }

  const userIdString = this.userIdString;

  this.userSocialService.getUserProfile(userIdString).subscribe({
    next: (user) => {
      this.creadorLista = user.username  || 'Sin nombre';
    },
    error: (error) => {
      console.error('Error al obtener información del creador:', error);
      this.creadorLista = 'Usuario desconocido';
    }
  });
}

get userIdString(): string {
  if (!this.lista?.userId) return '';
  
  const userId = this.lista.userId as any;
  
  if (typeof userId === 'object' && userId._id) {
    return userId._id;
  } else if (typeof userId === 'object' && userId.$oid) {
    return userId.$oid;
  } else {
    return String(userId);
  }
}



  buscarPeliculas(): void {
    if (this.searchForm.invalid) return;

    const query = this.searchForm.get('query')?.value;

    this.peliculasService.busquedaAvanzadaPeliculas({ query }).subscribe({
      next: (data) => {
        this.resultadosBusqueda = data.results.slice(0, 10); // Limitamos a 10 resultados
      },
      error: (error) => {
        console.error('Error en la búsqueda:', error);
      }
    });
  }

  estaEnLista(movieId: string): boolean {
    if (!this.lista) return false;
    return this.lista.movies.some(movie => movie.movieId === movieId.toString());
  }

  agregarPelicula(movieId: string): void {
    if (!this.lista || this.estaEnLista(movieId)) return;

    this.movieListsService.addMovieToList(this.lista._id, movieId.toString()).subscribe({
      next: (response) => {
        // Actualizar la lista local
        this.lista = response.list;

        // Añadir la película a las películas mostradas
        this.peliculasService.getDetallesPelicula(movieId.toString()).subscribe({
          next: (pelicula) => {
            this.peliculasLista.push(pelicula);
          }
        });
      },
      error: (error) => {
        console.error('Error al añadir película a la lista:', error);
      }
    });
  }

  quitarPelicula(movieId: string): void {
    if (!this.lista) return;

    if (confirm('¿Estás seguro de querer eliminar esta película de la lista?')) {
      this.movieListsService.removeMovieFromList(this.lista._id, movieId.toString()).subscribe({
        next: () => {
          // Actualizar la lista local
          if (this.lista) {
            this.lista.movies = this.lista.movies.filter(movie => movie.movieId !== movieId.toString());
          }

          // Quitar la película de las películas mostradas
          this.peliculasLista = this.peliculasLista.filter(pelicula => pelicula.id.toString() !== movieId.toString());
        },
        error: (error) => {
          console.error('Error al quitar película de la lista:', error);
        }
      });
    }
  }

  initEditForm(): void {
    if (!this.lista) return;

    this.listaForm.patchValue({
      title: this.lista.title,
      description: this.lista.description,
      isPublic: this.lista.isPublic
    });

    if (this.lista.coverImage) {
      this.coverImagePreview = this.lista.coverImage;
    }
  }

  editarLista(): void {
    this.mostrarFormularioEdicion = true;
  }

  cancelarEdicion(): void {
    this.mostrarFormularioEdicion = false;
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

  async guardarCambiosLista(): Promise<void> {
    if (this.listaForm.invalid || !this.lista) return;

    const formData = this.listaForm.value;
    let coverImageBase64 = this.lista.coverImage;

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

    // Actualizar la lista
    this.movieListsService.updateList(this.lista._id, listaData).subscribe({
      next: (response) => {
        this.lista = response.list;
        this.mostrarFormularioEdicion = false;
        alert('Lista actualizada correctamente');
      },
      error: (error) => {
        console.error('Error al actualizar lista:', error);
        alert('Error al actualizar la lista. Por favor, inténtalo de nuevo.');
      }
    });
  }


  // Método para abrir el modal
  abrirModalBusqueda(): void {
    this.mostrarModalBusqueda = true;
    this.busquedaQuery = '';
    this.peliculasBusqueda = [];
    this.paginaActual = 1;
    this.hayMasPaginas = true;
    this.busquedaRealizada = false;
  }

  // Método para cerrar el modal
  cerrarModalBusqueda(): void {
    this.mostrarModalBusqueda = false;
    this.peliculasBusqueda = [];
    this.busquedaQuery = '';
    this.busquedaRealizada = false;
  }

  // Método para buscar películas
  buscarPeliculasModal(): void {
    if (!this.busquedaQuery.trim() || this.busquedaQuery.length < 2) return;
    
    this.cargandoBusqueda = true;
    this.paginaActual = 1;
    this.peliculasBusqueda = [];
    this.busquedaRealizada = true;
    
    this.peliculasService.busquedaAvanzadaPeliculas({ 
      query: this.busquedaQuery,
      page: this.paginaActual 
    }).subscribe({
      next: (data) => {
        this.peliculasBusqueda = data.results;
        this.hayMasPaginas = this.paginaActual < data.total_pages;
        this.cargandoBusqueda = false;
      },
      error: (error) => {
        console.error('Error en la búsqueda:', error);
        this.cargandoBusqueda = false;
      }
    });
  }

  // Método para cargar más películas (scroll infinito)
  cargarMasPeliculas(): void {
    if (!this.hayMasPaginas || this.cargandoBusqueda) return;
    
    this.cargandoBusqueda = true;
    this.paginaActual++;
    
    this.peliculasService.busquedaAvanzadaPeliculas({ 
      query: this.busquedaQuery,
      page: this.paginaActual 
    }).subscribe({
      next: (data) => {
        this.peliculasBusqueda = [...this.peliculasBusqueda, ...data.results];
        this.hayMasPaginas = this.paginaActual < data.total_pages;
        this.cargandoBusqueda = false;
      },
      error: (error) => {
        console.error('Error al cargar más películas:', error);
        this.cargandoBusqueda = false;
      }
    });
  }

  // Método para detectar scroll al final
  onScroll(event: any): void {
    const element = event.target;
    if (element.scrollHeight - element.scrollTop === element.clientHeight) {
      this.cargarMasPeliculas();
    }
  }

  // Método para añadir película desde el modal
  agregarPeliculaModal(pelicula: any): void {
    if (this.estaEnLista(pelicula.id)) return;
    
    this.agregarPelicula(pelicula.id);
  }


  eliminarLista(): void {
    if (!this.lista) return;

    if (confirm('¿Estás seguro de que quieres eliminar esta lista? Esta acción no se puede deshacer.')) {
      // Note: For this to work, you would need to implement a deleteList method in the MovieListsService
      // This endpoint doesn't exist in your current service, so it would need to be added
      this.movieListsService.deleteList(this.lista._id).subscribe({
        next: () => {
          alert('Lista eliminada correctamente');
          this.router.navigate(['/perfil']);
        },
        error: (error) => {
          console.error('Error al eliminar lista:', error);
          alert('Error al eliminar la lista. Por favor, inténtalo de nuevo.');
        }
      });
    }
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

  volver(): void {
    this.router.navigate(['/perfil']);
  }
}