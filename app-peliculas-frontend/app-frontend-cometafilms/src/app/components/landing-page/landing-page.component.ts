import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

interface CinematicImage {
  url: string;
  title: string;
  opacity: number;
  isVisible: boolean;
}

interface Star {
  id: number;
  top: string;
  left: string;
  size: string;
  animationDelay: string;
  animationDurationTwinkle: string;
  starClass: string;
  brightness: number;
}

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css']
})
export class LandingPageComponent implements OnInit, AfterViewInit, OnDestroy {

  starsArray: Star[] = [];
  numberOfStars: number = 1800; // Más estrellas para un cielo nocturno realista

  // Estados de carga para botones
  isLoginLoading: boolean = false;
  isRegisterLoading: boolean = false;

  // Arrays de imágenes cinematográficas para cada esfera
  cinematicImages = {
    sphere1: [
      { url: 'https://m.media-amazon.com/images/S/pv-target-images/42dbfcf2215f0e3ecddbb5e46e10acdc50d79552d337ac07c93c6e9c66123a2d._SX1080_FMjpg_.jpg', title: 'Blade Runner', opacity: 0, isVisible: false },
      { url: 'https://cdn.hobbyconsolas.com/sites/navi.axelspringer.es/public/media/image/2025/04/matrix-regresara-pelicula-totalmente-nueva-mano-warner-bros-drew-goddard-4314363.jpg?tf=3840x', title: 'Matrix', opacity: 0, isVisible: false },
      { url: 'https://sm.ign.com/t/ign_latam/screenshot/default/gremnlins_rvx1.1280.jpg', title: 'Citizen Kane', opacity: 0, isVisible: false }
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
    this.generateEnhancedStars();
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

  /**
   * Genera estrellas más pequeñas y elegantes - MENOS ES MÁS 😄
   */
  generateEnhancedStars(): void {
    const newStars: Star[] = [];

    // GENERAR ESTRELLAS BASE - MÁS PEQUEÑAS Y SUTILES
    for (let i = 0; i < this.numberOfStars; i++) {
      const brightness = Math.random();
      let starClass = 'star-dim';
      let size = Math.random() * 0.8 + 0.3; // Tamaños más pequeños: 0.3px - 1.1px

      // Distribución para un cielo estrellado visible
      if (brightness > 0.97) { // 3% super brillantes  
        starClass = 'star-super-bright';
        size = Math.random() * 1.2 + 0.8; // 0.8px - 2px
      } else if (brightness > 0.90) { // 7% brillantes
        starClass = 'star-bright';
        size = Math.random() * 0.8 + 0.5; // 0.5px - 1.3px
      } else if (brightness > 0.80) { // 10% cluster
        starClass = 'star-cluster';
        size = Math.random() * 0.6 + 0.4; // 0.4px - 1px
      } else if (brightness > 0.50) { // 30% medium - más visibles
        starClass = 'star-medium';
        size = Math.random() * 0.5 + 0.3; // 0.3px - 0.8px
      } else { // 50% dim - menos proporción de muy tenues
        starClass = 'star-dim';
        size = Math.random() * 0.4 + 0.2; // 0.2px - 0.6px
      }

      newStars.push({
        id: i,
        top: Math.random() * 100 + '%',
        left: Math.random() * 100 + '%',
        animationDelay: Math.random() * 15 + 's', // Más rápido para ver efectos
        animationDurationTwinkle: (Math.random() * 4 + 2) + 's', // Más rápido y visible
        size: size + 'px',
        starClass: starClass,
        brightness: brightness
      });
    }

    // GENERAR 8 CÚMULOS MÁS VISIBLES
    const numberOfClusters = 8;
    for (let cluster = 0; cluster < numberOfClusters; cluster++) {
      const clusterX = Math.random() * 100;
      const clusterY = Math.random() * 100;
      const clusterStars = Math.random() * 80 + 40; // 40-120 estrellas por cúmulo

      for (let j = 0; j < clusterStars; j++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 8; // Radio más pequeño del cúmulo

        const x = Math.max(0, Math.min(100, clusterX + Math.cos(angle) * distance));
        const y = Math.max(0, Math.min(100, clusterY + Math.sin(angle) * distance));

        const brightness = Math.random();
        let starClass = 'star-dim';
        let size = Math.random() * 0.4 + 0.2; // Cúmulos más visibles

        if (brightness > 0.95) {
          starClass = 'star-bright';
          size = Math.random() * 0.7 + 0.4;
        } else if (brightness > 0.80) {
          starClass = 'star-cluster';
          size = Math.random() * 0.5 + 0.3;
        } else if (brightness > 0.5) {
          starClass = 'star-medium';
          size = Math.random() * 0.4 + 0.25;
        }

        newStars.push({
          id: this.numberOfStars + cluster * 100 + j,
          top: y + '%',
          left: x + '%',
          animationDelay: Math.random() * 20 + 's',
          animationDurationTwinkle: (Math.random() * 5 + 2) + 's',
          size: size + 'px',
          starClass: starClass,
          brightness: brightness
        });
      }
    }

    console.log(`Generadas ${newStars.length} estrellas - Más negro que blanco 😄`);
    this.starsArray = newStars;
    this.cdr.detectChanges();
  }

  trackByStar(index: number, star: Star): number {
    return star.id;
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
   * Efecto de iluminación de cometas más suave
   */
  private createCometBlurEffect(sphereSelectors: string[], duration: number): void {
    sphereSelectors.forEach((selector, index) => {
      const sphere = document.querySelector(selector) as HTMLElement;
      if (sphere) {
        setTimeout(() => {
          // Efecto de iluminación más suave
          sphere.style.backdropFilter = 'blur(45px) saturate(350%) brightness(220%)';
          (sphere.style as any).webkitBackdropFilter = 'blur(45px) saturate(350%) brightness(220%)';

          sphere.style.boxShadow = `
            0 0 120px 40px rgba(var(--sphere-shadow-color-rgb), 0.6),
            0 0 200px 60px rgba(var(--sphere-shadow-color-rgb), 0.3),
            inset 0 0 80px -10px rgba(var(--sphere-shadow-color-rgb), 0.4)
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
}