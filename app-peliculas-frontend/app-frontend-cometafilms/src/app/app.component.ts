import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { FooterComponent } from './components/footer/footer.component';
import { FondoComponent } from './components/fondo/fondo.component';
import { Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from './services/auth.service';
import { PremiumService } from './services/premium.service';
import { Subscription } from 'rxjs';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, FondoComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'cometa-films';
  private routerSubscription?: Subscription;
  
  // Registrar última actualización para evitar verificaciones excesivas
  private lastPremiumCheck = 0;
  private readonly CHECK_INTERVAL = 60 * 1000; // 1 minuto

  constructor(
    private router: Router,
    private authService: AuthService,
    private premiumService: PremiumService
  ) {}

  ngOnInit() {
    // Solo actualizar el estado premium después de ciertas navegaciones
    // y cuando haya pasado suficiente tiempo desde la última verificación
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      if (this.authService.isAuthenticated()) {
        const now = Date.now();
        // Solo verificar si ha pasado el intervalo mínimo
        if (now - this.lastPremiumCheck > this.CHECK_INTERVAL) {
          this.lastPremiumCheck = now;
          // Usar caché cuando sea posible
          this.premiumService.getPremiumStatus().subscribe();
        }
      }
    });

    // Verificar estado premium al inicio una sola vez
    if (this.authService.isAuthenticated()) {
      this.lastPremiumCheck = Date.now();
      this.premiumService.getPremiumStatus().subscribe();
    }
  }
  
  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }
}
