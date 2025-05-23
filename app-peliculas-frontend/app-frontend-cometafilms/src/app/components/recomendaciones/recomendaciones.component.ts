import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RecommendationService } from '../../services/recomendation.service';
import { PeliculaCardComponent } from '../pelicula-card/pelicula-card.component';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-recomendaciones',
  standalone: true,
  imports: [CommonModule, RouterModule, PeliculaCardComponent],
  templateUrl: './recomendaciones.component.html',
  styleUrls: ['./recomendaciones.component.css']
})
export class RecomendacionesComponent implements OnInit {
  recommendations: any[] = [];
  loading: boolean = false;
  error: string | null = null;
  isPremium: boolean = false; // Por defecto, asumimos que no es premium

  constructor(
    private recommendationService: RecommendationService,
    private authService: AuthService
  ) { }

  ngOnInit(): void {
    // Verificar estado premium primero, antes de cargar recomendaciones
    this.authService.currentUser.subscribe(user => {
      this.isPremium = user?.isPremium || false;

      // Solo cargamos recomendaciones si es usuario premium
      if (this.isPremium) {
        this.loadRecommendations();
      }
    });
  }

  loadRecommendations(): void {
    // Solo cargar si es premium
    if (!this.isPremium) return;

    this.loading = true;
    this.recommendationService.getPersonalizedRecommendations().subscribe({
      next: (data: any) => {
        this.recommendations = data || [];
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error al cargar recomendaciones';
        this.loading = false;
        console.error('Error cargando recomendaciones:', error);
      }
    });
  }

  refreshRecommendations(): void {
    // Solo refrescar si es premium
    if (!this.isPremium) return;

    this.loading = true;
    this.error = null;

    this.recommendationService.getPersonalizedRecommendations(15, true).subscribe({
      next: (data) => {
        this.recommendations = data;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Error al actualizar recomendaciones';
        this.loading = false;
        console.error('Error al actualizar recomendaciones:', error);
      }
    });
  }

  scrollSection(direction: 'left' | 'right'): void {
    const container = document.getElementById('recomendaciones');
    if (!container) return;

    const scrollAmount = direction === 'right' ? 300 : -300;
    container.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  }
}