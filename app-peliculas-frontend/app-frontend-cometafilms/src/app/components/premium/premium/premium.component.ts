import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PremiumService } from '../../../services/premium.service';
import { AuthService } from '../../../services/auth.service';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-premium',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './premium.component.html',
  styleUrl: './premium.component.css'
})
export class PremiumComponent implements OnInit {
  isLoading = false;
  error: string | null = null;
  premiumStatus: any = null;
  processingPayment = false;
  subscriptionHistory: any[] = [];

  constructor(
    private premiumService: PremiumService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    this.loadPremiumStatus();
  }

  loadPremiumStatus() {
    this.isLoading = true;
    this.premiumService.getPremiumStatus().subscribe({
      next: (status) => {
        this.premiumStatus = status;
        this.subscriptionHistory = status.subscriptionHistory || [];
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Error al cargar estado premium';
        this.isLoading = false;
      }
    });
}

  startSubscription() {
    this.processingPayment = true;
    this.premiumService.createSubscription().subscribe({
      next: (response) => {
        // Redirigir a la página de PayPal para completar el pago
        window.location.href = response.approveUrl;
      },
      error: (err) => {
        this.error = 'Error al iniciar proceso de pago';
        this.processingPayment = false;
      }
    });
  }

  cancelSubscription() {
    if (confirm('¿Estás seguro de que deseas cancelar tu suscripción Premium? Mantendrás el acceso hasta la fecha de expiración.')) {
      this.isLoading = true;
      this.premiumService.cancelSubscription().subscribe({
        next: (response) => {
          alert('Suscripción cancelada correctamente');
          this.loadPremiumStatus();
        },
        error: (err) => {
          this.error = 'Error al cancelar suscripción';
          this.isLoading = false;
        }
      });
    }
  }
}
