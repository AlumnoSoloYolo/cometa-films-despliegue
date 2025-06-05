import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  selector: 'app-fondo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fondo.component.html',
  styleUrl: './fondo.component.css'
})
export class FondoComponent implements OnInit {

  starsArray: Star[] = [];
  numberOfStars: number = 100; // Misma cantidad que el landing

  constructor(private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.generateEnhancedStars();
  }

  /**
   * Genera estrellas
   */
  generateEnhancedStars(): void {
    const newStars: Star[] = [];

  
    for (let i = 0; i < this.numberOfStars; i++) {
      const brightness = Math.random();
      let starClass = 'star-dim';
      let size = Math.random() * 0.4 + 0.2; // Tamaños idénticos

      // Distribución idéntica al landing
      if (brightness > 0.97) { // 5% super brillantes  
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
      } else { // 50% dim
        starClass = 'star-dim';
        size = Math.random() * 0.4 + 0.2; // 0.2px - 0.6px
      }

      newStars.push({
        id: i,
        top: Math.random() * 100 + '%',
        left: Math.random() * 100 + '%',
        animationDelay: Math.random() * 60 + 's', // Delays de 0-60 segundos
        animationDurationTwinkle: (Math.random() * 15 + 8) + 's', // Duraciones de 8-23 segundos
        size: size + 'px',
        starClass: starClass,
        brightness: brightness
      });
    }

    // GENERAR 8 CÚMULOS - Idéntica lógica al landing
    const numberOfClusters = 8;
    for (let cluster = 0; cluster < numberOfClusters; cluster++) {
      const clusterX = Math.random() * 100;
      const clusterY = Math.random() * 100;
      const clusterStars = Math.random() * 80 + 40; // 40-120 estrellas por cúmulo

      for (let j = 0; j < clusterStars; j++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 8; // Radio idéntico del cúmulo

        const x = Math.max(0, Math.min(100, clusterX + Math.cos(angle) * distance));
        const y = Math.max(0, Math.min(100, clusterY + Math.sin(angle) * distance));

        const brightness = Math.random();
        let starClass = 'star-dim';
        let size = Math.random() * 0.4 + 0.2;

        // Distribución idéntica de cúmulos
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
          animationDelay: Math.random() * 80 + 's', // Delays más largos para cúmulos
          animationDurationTwinkle: (Math.random() * 20 + 10) + 's', // Duraciones de 10-30 segundos
          size: size + 'px',
          starClass: starClass,
          brightness: brightness
        });
      }
    }

    this.starsArray = newStars;
    this.cdr.detectChanges();
  }

  trackByStar(index: number, star: Star): number {
    return star.id;
  }
}