import { Component, OnInit } from '@angular/core';
import { PeliculasService } from '../../services/peliculas.service';
import { CommonModule } from '@angular/common';
import { VotoColorPipe } from '../../shared/pipes/voto-color.pipe';
import { PeliculaCardComponent } from '../pelicula-card/pelicula-card.component';
import { RouterModule } from '@angular/router';
import { RecomendacionesComponent } from '../recomendaciones/recomendaciones.component';
import { AuthService } from '../../services/auth.service';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, VotoColorPipe, PeliculaCardComponent, RouterModule, RecomendacionesComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {

  pelisPopulares: any[] = [];
  pelisEnCines: any[] = [];
  pelisProximosEstenos: any[] = [];
  pelisTendenciasSemanales: any[] = [];
  pelisMasValoradas: any[] = [];
  listaGeneros: any[] = [];
  pelisProximosEstrenos: any[] = [];
  isPremium: boolean = true; // Temporalmente true para probar, luego se obtendrá del usuario


  constructor(
    private pelisService: PeliculasService,
    private authService: AuthService) {
    window.scrollTo({
      top: -100,
      left: 0,
      behavior: 'smooth'
    });

    // En el futuro, verificar si es premium
    //  this.isPremium = this.authService.getCurrentUser()?.isPremium || false;
  }

  ngOnInit(): void {
    this.populares();
    this.ahoraEncines();
    this.masValoradas();
    this.proximosEstrenos();
    this.tendenciasSemanales();
    this.generos();
  };


  populares(): void {
    this.pelisService.getPelisPopulares().subscribe({
      next: (response) => {
        this.pelisPopulares = response.results.slice(0, 10);
        // console.log(this.pelisPopulares);
      },
      error: (error) => {
        console.error("Error al consultar la lista de pelis populares", error);
      }
    });
  };

  ahoraEncines(): void {
    this.pelisService.getAhoraEnCines().subscribe({
      next: (response) => {
        this.pelisEnCines = response.results;
        // console.log(this.pelisEnCines)
      },
      error: (error) => {
        console.error("Error al consultar la lista de películas en cine", error);
      }
    });
  };

  masValoradas() {
    this.pelisService.getPeliculasMasValoradas()
      .subscribe({
        next: (response) => {
          this.pelisMasValoradas = response.results.slice(0, 10);
          // console.log(this.pelisMasValoradas);
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
          // console.log(this.pelisProximosEstrenos);
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
          // console.log(this.pelisTendenciasSemanales);
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
        // console.log("generos", this.listaGeneros);
      },
      error: (error) => {
        console.error("Error al consultar la lista de géneros", error)
      }
    });
  };


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