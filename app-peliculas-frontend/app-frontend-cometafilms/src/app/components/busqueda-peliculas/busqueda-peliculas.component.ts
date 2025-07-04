import { Component, HostListener, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RouterModule } from '@angular/router';
import { PeliculasService } from '../../services/peliculas.service';
import { UserMovieService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { PeliculaCardComponent } from '../pelicula-card/pelicula-card.component';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AbstractControl, ValidationErrors } from '@angular/forms';
import { Subscription } from 'rxjs';

interface MovieResponse {
  results: any[];
  total_results: number;
  total_pages: number;
}

@Component({
  selector: 'app-busqueda-peliculas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, PeliculaCardComponent],
  templateUrl: './busqueda-peliculas.component.html',
  styleUrl: './busqueda-peliculas.component.css'
})
export class BusquedaPeliculasComponent implements OnInit, OnDestroy {

  searchForm: FormGroup;
  peliculas: any[] = [];
  generos: any[] = [];
  cargando = false;
  paginaActual = 1;
  hayMasPaginas = true;
  resultadosTotales = 0;
  mostrarBotonSubir = false;

  // Variables para optimización de perfil
  userProfile: any = null;
  isAuthenticated = false;
  private authSubscription?: Subscription;

  sortOptions = [
    { value: 'popularity.desc', label: 'Popularidad (Mayor a menor)' },
    { value: 'popularity.asc', label: 'Popularidad (Menor a mayor)' },
    { value: 'vote_average.desc', label: 'Valoración (Mayor a menor)' },
    { value: 'vote_average.asc', label: 'Valoración (Menor a mayor)' },
    { value: 'release_date.desc', label: 'Fecha (Más recientes)' },
    { value: 'release_date.asc', label: 'Fecha (Más antiguas)' },
    { value: 'title.asc', label: 'Título (A-Z)' },
    { value: 'title.desc', label: 'Título (Z-A)' }
  ];

  constructor(
    private fb: FormBuilder,
    private pelisService: PeliculasService,
    private userService: UserMovieService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.searchForm = this.fb.group({
      query: ['', [
        Validators.minLength(2),
        Validators.maxLength(50)
      ]],
      year: ['', [
        Validators.pattern(/^\d{4}$/),
        Validators.min(1900),
        Validators.max(new Date().getFullYear())
      ]],
      genres: [[]],
      sortBy: ['popularity.desc'],
      minRating: ['', [
        Validators.min(0),
        Validators.max(10),
        this.validarMinMax
      ]],
      maxRating: ['', [
        Validators.min(0),
        Validators.max(10),
        this.validarMinMax
      ]]
    }, {
      validators: this.validarRatingRange
    });
  }

  ngOnInit() {
    this.initializeUserData();
    this.cargarDatosIniciales();
    this.configurarBusquedaAutomatica();
    this.cargarPeliculas();
  }

  ngOnDestroy() {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  // Cargar datos del usuario UNA SOLA VEZ
  private initializeUserData() {
    this.authSubscription = this.authService.currentUser.subscribe(user => {
      this.isAuthenticated = !!user;

      if (this.isAuthenticated) {
        this.loadUserProfileOnce();
      } else {
        this.userProfile = null;
      }
    });
  }

  // Cargar perfil de usuario optimizado
  private loadUserProfileOnce() {
    if (this.userProfile) return; // Ya está cargado

    this.userService.getUserPerfil().subscribe({
      next: (perfil) => {
        this.ngZone.run(() => {
          this.userProfile = perfil;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error al cargar perfil:', error);
        this.userProfile = null;
      }
    });
  }

  // Método para manejar eventos de películas y actualizar el perfil local
  onPeliculaVistaAgregada(movieId: string) {
    if (!this.userProfile) return;

    this.ngZone.run(() => {
      if (!this.userProfile.pelisVistas.some((p: any) => p.movieId === movieId)) {
        this.userProfile.pelisVistas.push({ movieId, watchedAt: new Date() });
      }
      this.userProfile.pelisPendientes = this.userProfile.pelisPendientes.filter((peli: any) => peli.movieId !== movieId);
      this.cdr.detectChanges();
    });
  }

  onPeliculaPendienteAgregada(movieId: string) {
    if (!this.userProfile) return;

    this.ngZone.run(() => {
      if (!this.userProfile.pelisPendientes.some((p: any) => p.movieId === movieId)) {
        this.userProfile.pelisPendientes.push({ movieId, addedAt: new Date() });
      }
      this.userProfile.pelisVistas = this.userProfile.pelisVistas.filter((peli: any) => peli.movieId !== movieId);
      this.cdr.detectChanges();
    });
  }

  onPeliculaVistaEliminada(movieId: string) {
    if (!this.userProfile) return;

    this.ngZone.run(() => {
      this.userProfile.pelisVistas = this.userProfile.pelisVistas.filter((peli: any) => peli.movieId !== movieId);
      this.cdr.detectChanges();
    });
  }

  onPeliculaPendienteEliminada(movieId: string) {
    if (!this.userProfile) return;

    this.ngZone.run(() => {
      this.userProfile.pelisPendientes = this.userProfile.pelisPendientes.filter((peli: any) => peli.movieId !== movieId);
      this.cdr.detectChanges();
    });
  }

  private validarMinMax(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const valor = control.value;
    if (isNaN(valor)) return { 'numeroInvalido': true };

    const numero = Number(valor);
    if (numero < 0 || numero > 10) return { 'rangoInvalido': true };

    return null;
  }

  private validarRatingRange(group: FormGroup) {
    const min = group.get('minRating')?.value;
    const max = group.get('maxRating')?.value;
    return (min && max && Number(min) > Number(max)) ?
      { ratingRange: true } : null;
  }

  private cargarDatosIniciales() {
    this.pelisService.getGeneros().subscribe({
      next: (response) => this.generos = response.genres,
      error: (error) => console.error('Error cargando géneros:', error)
    });

    this.route.queryParams.subscribe(params => {
      if (params['query']) {
        this.searchForm.patchValue({ query: params['query'] });
        this.buscar();
      }
    });
  }

  private configurarBusquedaAutomatica() {
    this.searchForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(() => {
      if (this.searchForm.valid) {
        this.buscar();
      }
    });
  }

  buscar() {
    if (this.searchForm.invalid) return;

    this.cargando = true;
    this.paginaActual = 1;
    this.peliculas = [];

    this.realizarBusqueda();
  }

  @HostListener('window:scroll')
  manejarScroll() {
    const estaEnElFondo = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300;

    if (!this.cargando && this.hayMasPaginas && estaEnElFondo) {
      this.paginaActual++;
      this.realizarBusqueda(true);
    }

    this.mostrarBotonSubir = window.pageYOffset > 300;
  }

  private realizarBusqueda(esScrollInfinito: boolean = false) {
    const params = this.prepararParametros();

    this.pelisService.busquedaAvanzadaPeliculas(params).subscribe({
      next: (response: MovieResponse) => {
        if (esScrollInfinito) {
          this.peliculas = [...this.peliculas, ...response.results];
        } else {
          this.peliculas = response.results;
        }

        this.resultadosTotales = response.total_results;
        this.hayMasPaginas = response.results.length > 0;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error en la búsqueda:', error);
        this.cargando = false;
      }
    });
  }

  private prepararParametros() {
    const formValue = this.searchForm.value;
    const params: any = {
      page: this.paginaActual,
      sortBy: formValue.sortBy || 'popularity.desc'
    };

    if (formValue.query?.trim()) params.query = formValue.query.trim();
    if (formValue.year) params.year = formValue.year;
    if (formValue.genres?.length) params.genreIds = formValue.genres.filter(Boolean);
    if (formValue.minRating) params.minRating = formValue.minRating;
    if (formValue.maxRating) params.maxRating = formValue.maxRating;

    return params;
  }

  getErrorMessage(controlName: string): string {
    const control = this.searchForm.get(controlName);
    if (!control?.errors) return '';

    if (control.errors['required']) {
      return 'Este campo es obligatorio';
    }
    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }
    if (control.errors['maxlength']) {
      return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    }
    if (control.errors['pattern']) {
      return 'Formato de año inválido';
    }
    if (control.errors['min']) {
      return `Valor mínimo: ${control.errors['min'].min}`;
    }
    if (control.errors['max']) {
      return `Valor máximo: ${control.errors['max'].max}`;
    }
    if (control.errors['rangoInvalido']) {
      return 'La valoración debe estar entre 0 y 10';
    }

    return '';
  }

  private cargarPeliculas() {
    this.cargando = true;
    this.paginaActual++;

    const searchParams = this.prepararParametros();

    this.pelisService.busquedaAvanzadaPeliculas(searchParams).subscribe({
      next: (response: MovieResponse) => {
        if (response.results.length === 0) {
          this.hayMasPaginas = false;
        } else {
          this.peliculas = [...this.peliculas, ...response.results];
          this.resultadosTotales = response.total_results;
        }
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error cargando más películas:', error);
        this.cargando = false;
      }
    });
  }

  hasError(controlName: string): boolean {
    const control = this.searchForm.get(controlName);
    return !!(control && control.errors && (control.dirty || control.touched));
  }

  limpiarFiltros() {
    this.searchForm.reset({ sortBy: 'popularity.desc' });
    this.buscar();
  }

  volverArriba() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}