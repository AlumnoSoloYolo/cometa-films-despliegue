import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { PeliculasService } from '../../services/peliculas.service';
import { UserMovieService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { VotoColorPipe } from '../../shared/pipes/voto-color.pipe';
import { PeliculaCardComponent } from '../pelicula-card/pelicula-card.component';
import { RouterModule } from '@angular/router';
import { RecomendacionesComponent } from '../recomendaciones/recomendaciones.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, VotoColorPipe, PeliculaCardComponent, RouterModule, RecomendacionesComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit, OnDestroy {

  pelisPopulares: any[] = [];
  pelisEnCines: any[] = [];
  pelisProximosEstenos: any[] = [];
  pelisTendenciasSemanales: any[] = [];
  pelisMasValoradas: any[] = [];
  listaGeneros: any[] = [];
  pelisProximosEstrenos: any[] = [];
  isPremium: boolean = false;
  isLoadingCarousel = true;
  userProfile: any = null;
  isAuthenticated = false;
  private authSubscription?: Subscription;

  constructor(
    private pelisService: PeliculasService,
    private authService: AuthService,
    private userService: UserMovieService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    window.scrollTo({
      top: -100,
      left: 0,
      behavior: 'smooth'
    });
  }

  ngOnInit(): void {
    this.initializeUserData();
    this.loadMovieData();
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
      this.isPremium = user?.isPremium || false;

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
          this.isPremium = perfil.isPremium || false;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        console.error('Error al cargar perfil:', error);
        this.userProfile = null;
      }
    });
  }

  // Cargar todos los datos de películas
  private loadMovieData() {
    this.populares();
    this.ahoraEncines();
    this.masValoradas();
    this.proximosEstrenos();
    this.tendenciasSemanales();
    this.generos();
  }

  // Métodos para manejar eventos de películas y actualizar el perfil local
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


  populares(): void {
    this.isLoadingCarousel = true; // Opcional: reiniciar si se recarga
    this.pelisService.getPelisPopulares().subscribe({
      next: (response) => {
        this.pelisPopulares = response.results.slice(0, 10);
        this.isLoadingCarousel = false; // Datos cargados, ocultar esqueleto
      },
      error: (error) => {
        console.error("Error al consultar la lista de pelis populares", error);
        this.isLoadingCarousel = false; // Error, ocultar esqueleto igualmente
      }
    });
  }

  ahoraEncines(): void {
    this.pelisService.getAhoraEnCines().subscribe({
      next: (response) => {
        this.pelisEnCines = response.results;
      },
      error: (error) => {
        console.error("Error al consultar la lista de películas en cine", error);
      }
    });
  }

  masValoradas() {
    this.pelisService.getPeliculasMasValoradas()
      .subscribe({
        next: (response) => {
          this.pelisMasValoradas = response.results.slice(0, 10);
        },
        error: (error) => {
          console.error('Error al consultar las peliculas más valoradas:', error);
        }
      });
  }

  proximosEstrenos() {
    this.pelisService.getProximosEstrenos()
      .subscribe({
        next: (response) => {
          this.pelisProximosEstrenos = response.results.filter((pelicula: any) => {
            const releaseYear = new Date(pelicula.release_date).getFullYear();
            return releaseYear >= 2025;
          });
        },
        error: (error) => {
          console.error('Error al cargar los próximos estrenos', error);
        }
      });
  }

  tendenciasSemanales() {
    this.pelisService.getTendenciasSemanales()
      .subscribe({
        next: (response) => {
          this.pelisTendenciasSemanales = response.results;
        },
        error: (error) => {
          console.error('Error al cargar las tendencias semanales', error);
        }
      });
  }

  generos(): void {
    this.pelisService.getGeneros().subscribe({
      next: (response) => {
        this.listaGeneros = response.genres;
      },
      error: (error) => {
        console.error("Error al consultar la lista de géneros", error)
      }
    });
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

  onWheel(event: WheelEvent, sectionId: string): void {
    // Método comentado mantenido como en el original
    // const container = document.getElementById(sectionId);
    // if (!container) return;

    // const scrollContent = container.querySelector('.movie-scroll-content') as HTMLElement;
    // if (!scrollContent) return;

    // // Evitar el desplazamiento vertical predeterminado
    // event.preventDefault();

    // // Desplazar horizontalmente según la dirección de la rueda
    // const scrollSpeed = 500; // Ajusta la velocidad del desplazamiento
    // scrollContent.scrollBy({
    //   left: event.deltaY > 0 ? scrollSpeed : -scrollSpeed, // Desplazamiento más rápido
    //   behavior: 'smooth'
    // }
    // );
  }
}