import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface CinematicImage {
  url: string;
  title: string;
  opacity: number;
  isVisible: boolean;
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css']
})
export class LandingPageComponent implements OnInit, AfterViewInit, OnDestroy {

  // Estados de carga para botones
  isLoginLoading: boolean = false;
  isRegisterLoading: boolean = false;

  // Arrays de imágenes cinematográficas para cada esfera
  cinematicImages = {
    sphere1: [
      { url: 'https://m.media-amazon.com/images/S/pv-target-images/42dbfcf2215f0e3ecddbb5e46e10acdc50d79552d337ac07c93c6e9c66123a2d._SX1080_FMjpg_.jpg', title: 'Blade Runner', opacity: 0, isVisible: false },
      { url: 'https://cdn.hobbyconsolas.com/sites/navi.axelspringer.es/public/media/image/2025/04/matrix-regresara-pelicula-totalmente-nueva-mano-warner-bros-drew-goddard-4314363.jpg?tf=3840x', title: 'Matrix', opacity: 0, isVisible: false },
      { url: 'https://static.filmin.es/images/es/media/26512/1/still_0_3_790x398.webp', title: 'Citizen Kane', opacity: 0, isVisible: false }
    ],
    sphere2: [
      { url: 'https://static.nuso.org/media/cache/9d/36/9d36ab92f1de39e7e8dc389b0f908bc0.jpg', title: 'Pulp Fiction', opacity: 0, isVisible: false },
      { url: 'https://cloudfront-eu-central-1.images.arcpublishing.com/prisaradio/GZJDKLGUABH6DJQSE4JQKCCR4Q.jpeg', title: 'Interstellar', opacity: 0, isVisible: false },
      { url: 'https://sm.ign.com/ign_latam/cover/p/poor-thing/poor-things_8tke.jpg', title: 'Poor Things', opacity: 0, isVisible: false }
    ],
    sphere3: [
      { url: 'https://i0.wp.com/tomatazos.buscafs.com/2020/06/midsommar-lanzan-libro-arte-conceptual-introduccion-martin-scorsese.png?quality=75&strip=all', title: 'Midsommar', opacity: 0, isVisible: false },
      { url: 'https://imagenes.20minutos.es/files/image_1920_1080/uploads/imagenes/2022/06/08/la-naranja-mecanica.jpeg', title: 'La Naranja Mecánica', opacity: 0, isVisible: false },
      { url: 'https://fahrenheitmagazine.b-cdn.net/sites/default/files/styles/xl/public/field/image/persepolis-scaled.jpg', title: 'Persépolis', opacity: 0, isVisible: false }
    ],
    sphere4: [
      { url: 'https://imagenes.20minutos.es/files/image_990_556/uploads/imagenes/2023/07/04/kill-bill-con-uma-thurman.jpeg', title: 'Kill Bill', opacity: 0, isVisible: false },
      { url: 'https://image.europafm.com/clipping/cmsimages01/2011/10/28/BA4BFBF4-C526-463B-AF40-C7DECFFD2BB9/98.jpg?crop=1024,576,x0,y96&width=1900&height=1069&optimize=low&format=webply', title: 'Vértigo', opacity: 0, isVisible: false },
      { url: 'https://cdn.hobbyconsolas.com/sites/navi.axelspringer.es/public/media/image/2019/08/viaje-luna.jpg?tf=3840x', title: 'Viaje a la Luna', opacity: 0, isVisible: false }
    ],
    sphere5: [
      { url: 'https://cinelibrista.com/wp-content/uploads/2020/09/castillo-ambulante.jpg?w=1088', title: 'El Castillo Ambulante', opacity: 0, isVisible: false },
      { url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQx1svbRXptn1KpEJOXgK3rI_1w5JU366AqKw&s', title: 'Seven', opacity: 0, isVisible: false },
      { url: 'https://e00-expansion.uecdn.es/assets/multimedia/imagenes/2024/05/15/17157596265978.jpg', title: 'Zodiac', opacity: 0, isVisible: false }
    ],
    sphere6: [
      { url: 'https://hips.hearstapps.com/hmg-prod/images/miedo-y-asco-en-las-vegas-pelicula-johnny-depp-1635510486.jpg?crop=0.646xw:0.945xh;0.354xw,0.00952xh&resize=1200:*', title: 'Miedo y Asco en Las Vegas', opacity: 0, isVisible: false },
      { url: 'https://cdn.aarp.net/content/dam/aarp/entertainment/movies/2017/07/1140-swinton-fiennes-grand-budapest-hotel-esp.jpg', title: 'Grand Budapest Hotel', opacity: 0, isVisible: false },
      { url: 'https://media.gq.com.mx/photos/5eebbea885180fb067834464/4:3/w_1972,h_1479,c_limit/GettyImages-50334844-odisea%20en%20el%20espacio.jpg', title: '2001: Odisea del Espacio', opacity: 0, isVisible: false }
    ]
  };

  private cometIlluminationInterval: any[] = [];
  private cinematicIntervals: any[] = [];
  private sphereCurrentImageIndex: { [key: string]: number } = {
    sphere1: 0,
    sphere2: 0,
    sphere3: 0,
    sphere4: 0,
    sphere5: 0,
    sphere6: 0
  };

  constructor(private router: Router, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    // Ya no generamos estrellas en el landing - se generan en el componente fondo
  }

  ngAfterViewInit(): void {
    this.setupCometIllumination();
    this.showInitialImages();

    // Iniciar rotación mejorada con mejor gestión
    setTimeout(() => {
      this.setupImprovedCinematicRotation();
    }, 2000);
  }

  ngOnDestroy(): void {
    [...this.cometIlluminationInterval, ...this.cinematicIntervals].forEach(interval => {
      clearInterval(interval);
    });
  }

  trackByCinematicImage(index: number, image: CinematicImage): string {
    return image.url;
  }

  /**
   * Muestra las primeras imágenes inmediatamente al cargar
   */
  private showInitialImages(): void {
    Object.keys(this.cinematicImages).forEach((sphereKey, index) => {
      const images = this.cinematicImages[sphereKey as keyof typeof this.cinematicImages];

      setTimeout(() => {
        if (images.length > 0) {
          images[0].isVisible = true;
          images[0].opacity = 0.85;
          this.cdr.detectChanges();
        }
      }, index * 400); // Delay escalonado
    });
  }

  /**
   * Sistema mejorado de rotación de imágenes cinematográficas
   */
  private setupImprovedCinematicRotation(): void {
    const sphereConfigs = [
      { key: 'sphere1', interval: 6000, displayTime: 4000, fadeTime: 800 },
      { key: 'sphere2', interval: 8000, displayTime: 5000, fadeTime: 600 },
      { key: 'sphere3', interval: 7500, displayTime: 4500, fadeTime: 700 },
      { key: 'sphere4', interval: 9000, displayTime: 5500, fadeTime: 650 },
      { key: 'sphere5', interval: 6500, displayTime: 4200, fadeTime: 750 },
      { key: 'sphere6', interval: 8500, displayTime: 5200, fadeTime: 680 }
    ];

    sphereConfigs.forEach((config, sphereIndex) => {
      setTimeout(() => {
        const intervalId = setInterval(() => {
          this.rotateImageSmoothly(config.key as keyof typeof this.cinematicImages, config.displayTime, config.fadeTime);
        }, config.interval);
        this.cinematicIntervals.push(intervalId);
      }, sphereIndex * 1500);
    });
  }

  /**
   * Rotación suave y controlada de imágenes - SIN TIEMPOS VACÍOS
   */
  private rotateImageSmoothly(sphereKey: keyof typeof this.cinematicImages, displayTime: number, fadeTime: number): void {
    const images = this.cinematicImages[sphereKey];
    if (images.length === 0) return;

    const currentIndex = this.sphereCurrentImageIndex[sphereKey];
    const nextIndex = (currentIndex + 1) % images.length;

    // MOSTRAR LA NUEVA IMAGEN PRIMERO (solapamiento)
    images[nextIndex].isVisible = true;
    images[nextIndex].opacity = 0;
    this.cdr.detectChanges();

    // Fade in de la nueva imagen
    setTimeout(() => {
      images[nextIndex].opacity = 0.85;
      this.cdr.detectChanges();

      // Actualizar índice inmediatamente
      this.sphereCurrentImageIndex[sphereKey] = nextIndex;

      // DESPUÉS hacer fade out de la anterior (si existe)
      setTimeout(() => {
        if (images[currentIndex].isVisible && currentIndex !== nextIndex) {
          images[currentIndex].opacity = 0;

          setTimeout(() => {
            images[currentIndex].isVisible = false;
            this.cdr.detectChanges();
          }, fadeTime);
        }
      }, 200); // Pequeño delay para solapamiento

    }, 100);
  }

  /**
   * Sistema de iluminación de cometas mejorado
   */
  private setupCometIllumination(): void {
    // Intervalos más coordinados y suaves
    const interval1 = setInterval(() => {
      this.createCometBlurEffect(['.sphere-1', '.sphere-6'], 2500);
    }, 18000);
    this.cometIlluminationInterval.push(interval1);

    setTimeout(() => {
      const interval2 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-2', '.sphere-4'], 2000);
      }, 14000);
      this.cometIlluminationInterval.push(interval2);
    }, 3000);

    setTimeout(() => {
      const interval3 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-3', '.sphere-5'], 2200);
      }, 16000);
      this.cometIlluminationInterval.push(interval3);
    }, 6000);

    setTimeout(() => {
      const interval4 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-1', '.sphere-3'], 1800);
      }, 12000);
      this.cometIlluminationInterval.push(interval4);
    }, 9000);

    setTimeout(() => {
      const interval5 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-2', '.sphere-6'], 2100);
      }, 20000);
      this.cometIlluminationInterval.push(interval5);
    }, 12000);
  }

  /**
   * Efecto de iluminación de cometas más sutil
   */
  private createCometBlurEffect(sphereSelectors: string[], duration: number): void {
    sphereSelectors.forEach((selector, index) => {
      const sphere = document.querySelector(selector) as HTMLElement;
      if (sphere) {
        setTimeout(() => {
          // Efecto de iluminación más sutil sin fondo
          sphere.style.backdropFilter = 'blur(35px) saturate(250%) brightness(180%)';
          (sphere.style as any).webkitBackdropFilter = 'blur(35px) saturate(250%) brightness(180%)';

          sphere.style.boxShadow = `
            0 0 80px 25px rgba(var(--sphere-shadow-color-rgb), 0.4),
            0 0 140px 40px rgba(var(--sphere-shadow-color-rgb), 0.2),
            inset 0 0 60px -8px rgba(var(--sphere-shadow-color-rgb), 0.3)
          `;

          // Transición de vuelta más gradual
          setTimeout(() => {
            sphere.style.transition = 'backdrop-filter 1.5s ease-out, box-shadow 1.5s ease-out';
            sphere.style.backdropFilter = '';
            (sphere.style as any).webkitBackdropFilter = '';
            sphere.style.boxShadow = '';

            // Limpiar la transición después
            setTimeout(() => {
              sphere.style.transition = '';
            }, 1500);
          }, duration);
        }, index * 150);
      }
    });
  }

  /**
   * Navegación con efecto de carga para el botón de login
   */
  navigateToLogin(): void {
    if (this.isLoginLoading) return;

    this.isLoginLoading = true;
    this.cdr.detectChanges();

    // Simular tiempo de carga realista
    setTimeout(() => {
      this.router.navigate(['/login']).then(() => {
        this.isLoginLoading = false;
        this.cdr.detectChanges();
      }).catch(() => {
        this.isLoginLoading = false;
        this.cdr.detectChanges();
      });
    }, 1200);
  }

  /**
   * Navegación con efecto de carga para el botón de registro
   */
  navigateToRegister(): void {
    if (this.isRegisterLoading) return;

    this.isRegisterLoading = true;
    this.cdr.detectChanges();

    // Simular tiempo de carga realista
    setTimeout(() => {
      this.router.navigate(['/registro']).then(() => {
        this.isRegisterLoading = false;
        this.cdr.detectChanges();
      }).catch(() => {
        this.isRegisterLoading = false;
        this.cdr.detectChanges();
      });
    }, 1000);
  }


@HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent) {
    const spheres = document.querySelectorAll('.blur-sphere');
    spheres.forEach(sphereElement => {
      const sphere = sphereElement as HTMLElement;
      const rect = sphere.getBoundingClientRect();
      
      // Vector desde el centro de la esfera al ratón
      const vecX = e.clientX - (rect.left + rect.width / 2);
      const vecY = e.clientY - (rect.top + rect.height / 2);
      const distance = Math.sqrt(vecX * vecX + vecY * vecY);

      if (distance < 200 && distance > 0.1) { // Radio de atracción y evitar división por cero si distance es muy pequeño
        // Factor de fuerza: 1 cuando la distancia es mínima, 0 cuando la distancia es 200
        // Esto hace que la atracción sea más fuerte cuanto más cerca esté el ratón.
        const strengthFactor = (200 - distance) / 200;

        // Desplazamiento máximo que quieres permitir (ej., cuando el ratón está casi encima)
        const maxDisplacement = 25; // en píxeles, ajústalo a tu gusto

        // El desplazamiento real es el factor de fuerza por el desplazamiento máximo
        const currentDisplacementMagnitude = strengthFactor * maxDisplacement;

        // Calcula el desplazamiento en X e Y normalizando el vector dirección y multiplicando por la magnitud del desplazamiento
        const moveX = (vecX / distance) * currentDisplacementMagnitude;
        const moveY = (vecY / distance) * currentDisplacementMagnitude;

        sphere.style.transform = `translate(${moveX}px, ${moveY}px)`;
      } else {
        // Resetea el desplazamiento local cuando el ratón está fuera del radio de atracción
        sphere.style.transform = `translate(0px, 0px)`;
      }
    });
  }
}
