// src/app/components/premium/premium-success/premium-success.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { PremiumService } from '../../../services/premium.service';

@Component({
  selector: 'app-premium-success',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './premium-success.component.html',
  styleUrls: ['./premium-success.component.css']
})
export class PremiumSuccessComponent implements OnInit {
  isProcessing = true;
  success = false;
  error: string | null = null;
  expiryDate: Date | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private premiumService: PremiumService
  ) { }

  ngOnInit() {
    // Obtener orderId de la URL
    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        // PayPal devuelve un token en la URL
        const orderId = params['token'];
        this.capturePayment(orderId);
      } else {
        this.error = 'No se recibió información del pago';
        this.isProcessing = false;
      }
    });
  }

  capturePayment(orderId?: string) {
    if (!orderId) {
      this.error = 'ID de orden no válido';
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    this.error = null;

    this.premiumService.capturePayment(orderId).subscribe({
      next: (response) => {
        this.success = true;
        this.isProcessing = false;
        this.expiryDate = new Date(response.premiumExpiry);
        
        // Forzar actualización del estado premium en toda la aplicación
        this.premiumService.refreshPremiumStatus();
      },
      error: (err) => {
        this.error = 'Error al procesar el pago. Por favor, contacta con soporte si el problema persiste.';
        this.isProcessing = false;
      }
    });
  }
}