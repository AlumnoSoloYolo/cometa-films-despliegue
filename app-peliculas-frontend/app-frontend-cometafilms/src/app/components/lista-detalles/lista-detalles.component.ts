import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MovieListsService } from '../../services/movie-lists.service';
import { PeliculasService } from '../../services/peliculas.service';
import { AuthService } from '../../services/auth.service';
import { UserSocialService } from '../../services/social.service';
import { MovieList } from '../../models/movie-list.model';
import { PeliculaCardComponent } from '../pelicula-card/pelicula-card.component';
import { LikeButtonComponent } from '../like-button/like-button.component';

@Component({
  selector: 'app-lista-detalles',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, PeliculaCardComponent, LikeButtonComponent],
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
      next: (data) => {
        this.lista = data;
        this.isOwnList = this.currentUser && this.lista.userId === this.currentUser.id;
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
    if (!this.lista || this.lista.movies.length === 0) {
      return;
    }

    // Cargar los detalles de cada película
    this.peliculasLista = [];
    this.lista.movies.forEach(movie => {
      this.peliculasService.getDetallesPelicula(movie.movieId).subscribe({
        next: (pelicula) => {
          this.peliculasLista.push(pelicula);
        },
        error: (error) => {
          console.error(`Error al cargar detalles de película ${movie.movieId}:`, error);
        }
      });
    });
  }

  obtenerNombreCreador(): void {
    if (!this.lista) return;

    this.userSocialService.getUserProfile(this.lista.userId).subscribe({
      next: (user) => {
        this.creadorLista = user.username;
      },
      error: (error) => {
        console.error('Error al obtener información del creador:', error);
        this.creadorLista = 'Usuario desconocido';
      }
    });
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
    // Note: For this to work, you would need to implement an updateList method in the MovieListsService
    // This endpoint doesn't exist in your current service, so it would need to be added
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