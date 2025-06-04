import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.css']
})
export class LandingPageComponent implements OnInit, AfterViewInit, OnDestroy {

  starsArray: any[] = [];
  numberOfStars: number = 1500; // Muchas más estrellas
  
  private cometIlluminationInterval: any[] = [];

  constructor(private router: Router, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.generateStars();
  }

  ngAfterViewInit(): void {
    this.setupCometIllumination();
  }

  ngOnDestroy(): void {
    if (this.cometIlluminationInterval.length > 0) {
      this.cometIlluminationInterval.forEach(interval => {
        clearInterval(interval);
      });
    }
  }

  generateStars(): void {
    const newStars = [];
    for (let i = 0; i < this.numberOfStars; i++) {
      const brightness = Math.random();
      let starClass = 'star-dim';
      let size = Math.random() * 2 + 0.5;
      
      if (brightness > 0.85) {
        starClass = 'star-super-bright';
        size = Math.random() * 5 + 3;
      } else if (brightness > 0.7) {
        starClass = 'star-bright';
        size = Math.random() * 3 + 2;
      } else if (brightness > 0.4) {
        starClass = 'star-medium';
        size = Math.random() * 2 + 1;
      }
      
      newStars.push({
        id: i, // ID único para trackBy
        top: Math.random() * 100 + '%',
        left: Math.random() * 100 + '%',
        animationDelay: Math.random() * 25 + 's',
        animationDurationTwinkle: (Math.random() * 10 + 2) + 's',
        size: size + 'px',
        starClass: starClass,
        brightness: brightness
      });
    }
    this.starsArray = newStars;
    this.cdr.detectChanges(); // Forzar detección de cambios
  }

  trackByStar(index: number, star: any): number {
    return star.id;
  }

  private setupCometIllumination(): void {
    // Comet-1 (grande azul)
    const interval1 = setInterval(() => {
      this.createCometBlurEffect(['.sphere-1', '.sphere-6'], 2500);
    }, 20000);
    this.cometIlluminationInterval.push(interval1);

    // Comet-2 (amarillo)
    setTimeout(() => {
      const interval2 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-2', '.sphere-4'], 2000);
      }, 15000);
      this.cometIlluminationInterval.push(interval2);
    }, 3000);

    // Comet-3 (magenta desde derecha)
    setTimeout(() => {
      const interval3 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-4', '.sphere-1', '.sphere-5'], 2200);
      }, 18000);
      this.cometIlluminationInterval.push(interval3);
    }, 6000);

    // Comet-4 (pequeño blanco)
    setTimeout(() => {
      const interval4 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-2', '.sphere-6'], 1200);
      }, 8000);
      this.cometIlluminationInterval.push(interval4);
    }, 1500);

    // Comet-5
    setTimeout(() => {
      const interval5 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-3', '.sphere-1'], 1800);
      }, 13000);
      this.cometIlluminationInterval.push(interval5);
    }, 9000);

    // Comet-6
    setTimeout(() => {
      const interval6 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-1', '.sphere-6'], 1600);
      }, 12000);
      this.cometIlluminationInterval.push(interval6);
    }, 12000);

    // Comet-7
    setTimeout(() => {
      const interval7 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-4', '.sphere-3'], 1400);
      }, 22000);
      this.cometIlluminationInterval.push(interval7);
    }, 14000);

    // Comet-8
    setTimeout(() => {
      const interval8 = setInterval(() => {
        this.createCometBlurEffect(['.sphere-2', '.sphere-5'], 2000);
      }, 10000);
      this.cometIlluminationInterval.push(interval8);
    }, 16000);
  }

  private createCometBlurEffect(sphereSelectors: string[], duration: number): void {
     sphereSelectors.forEach((selector, index) => {
    const sphere = document.querySelector(selector) as HTMLElement;
    if (sphere) {
      setTimeout(() => {
        // USAR LOS MISMOS ESTILOS QUE LOS BOTONES
        sphere.style.backdropFilter = 'blur(50px) saturate(400%) brightness(250%)';
        (sphere.style as any).webkitBackdropFilter = 'blur(50px) saturate(400%) brightness(250%)';
        
        // Sin bordes, solo el efecto blur intenso
        sphere.style.boxShadow = `
          0 0 150px 50px rgba(var(--sphere-shadow-color-rgb), 0.7),
          0 0 250px 80px rgba(var(--sphere-shadow-color-rgb), 0.4)
        `;
        
        // Quitar el efecto después del tiempo especificado
        setTimeout(() => {
          sphere.style.backdropFilter = '';
          (sphere.style as any).webkitBackdropFilter = '';
          sphere.style.boxShadow = '';
        }, duration);
      }, index * 200);
      }
    });
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/registro']);
  }
}