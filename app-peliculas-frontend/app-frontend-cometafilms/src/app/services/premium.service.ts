import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, shareReplay, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class PremiumService {
  private apiUrl = `${environment.apiUrl}/api/premium`;
  private premiumStatusSubject = new BehaviorSubject<any>(null);
  public premiumStatus$ = this.premiumStatusSubject.pipe(
    // Solo emitir cuando realmente cambia el valor
    distinctUntilChanged((prev, curr) => 
      JSON.stringify(prev) === JSON.stringify(curr)
    )
  );
  
  // Cache para evitar demasiadas consultas
  private statusCache: {data: any, timestamp: number} | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
  
  // Flag para evitar múltiples solicitudes simultáneas
  private isRefreshing = false;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Inicializar el estado premium cuando se crea el servicio
    this.refreshPremiumStatus();
  }

  private getToken(): string | null {
    return localStorage.getItem('token');
  }

  private getHeaders(): { headers: HttpHeaders } {
    const token = this.getToken();
    return {
      headers: new HttpHeaders()
        .set('Content-Type', 'application/json')
        .set('Authorization', `Bearer ${token || ''}`)
    };
  }

  getPremiumStatus(forceRefresh = false): Observable<any> {
    // Si hay una solicitud en curso, retornar el observable actual
    if (this.isRefreshing) {
      return this.premiumStatus$;
    }
    
    // Si tenemos caché válida y no se pide refresh, usarla
    if (!forceRefresh && this.statusCache && 
        (Date.now() - this.statusCache.timestamp < this.CACHE_DURATION)) {
      
      // Si el valor de caché es diferente al actual, emitirlo
      const currentValue = this.premiumStatusSubject.getValue();
      if (JSON.stringify(currentValue) !== JSON.stringify(this.statusCache.data)) {
        this.premiumStatusSubject.next(this.statusCache.data);
      }
      
      return this.premiumStatus$;
    }

    // Si se necesita actualizar desde el servidor
    this.isRefreshing = true;
    
    // Realizar la petición HTTP
    return new Observable(observer => {
      this.http.get(`${this.apiUrl}/status`, this.getHeaders())
        .subscribe({
          next: (status: any) => {
            // Comparar con el valor actual
            const currentValue = this.premiumStatusSubject.getValue();
            const statusHasChanged = JSON.stringify(currentValue) !== JSON.stringify(status);
            
            // Actualizar caché
            this.statusCache = {
              data: status,
              timestamp: Date.now()
            };
            
            // Solo emitir y actualizar AuthService si realmente cambió
            if (statusHasChanged) {
              console.log('Estado premium ha cambiado, actualizando...');
              this.premiumStatusSubject.next(status);
              this.authService.updatePremiumStatus(status.isPremium, status.premiumExpiry);
            }
            
            this.isRefreshing = false;
            observer.next(status);
            observer.complete();
          },
          error: (error) => {
            this.isRefreshing = false;
            observer.error(error);
          }
        });
    });
  }

  refreshPremiumStatus(): void {
    if (this.authService.isAuthenticated() && !this.isRefreshing) {
      this.getPremiumStatus(true).subscribe({
        // Observable ya maneja los errores internamente
        error: error => console.error('Error refrescando estado premium:', error)
      });
    }
  }

  createSubscription(): Observable<any> {
    return this.http.post(`${this.apiUrl}/subscribe`, {}, this.getHeaders())
      .pipe(
        tap(() => {
          // No actualizamos aquí porque el usuario será redirigido a PayPal
        })
      );
  }

  capturePayment(orderId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/capture`, { orderId }, this.getHeaders())
      .pipe(
        tap((response: any) => {
          if (response.success) {
            // Actualizar estado premium y emitir cambio
            this.statusCache = null; // Invalidar caché para forzar nueva consulta
            this.refreshPremiumStatus();
          }
        })
      );
  }

  cancelSubscription(): Observable<any> {
    return this.http.post(`${this.apiUrl}/cancel`, {}, this.getHeaders())
      .pipe(
        tap((response: any) => {
          // Actualizar estado después de cancelar
          this.statusCache = null; // Invalidar caché
          this.refreshPremiumStatus();
        })
      );
  }
}