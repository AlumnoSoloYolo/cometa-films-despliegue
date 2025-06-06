import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService, BanError } from '../../services/auth.service';

@Injectable()
export class BanInterceptor implements HttpInterceptor {

    constructor(private authService: AuthService) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(
            catchError(error => {
                // Si es un error 403 con código de ban, manejar automáticamente
                if (error.status === 403 && error.error?.code === 'ACCOUNT_BANNED') {
                    console.log('Usuario baneado detectado en interceptor');

                    // Crear info del ban
                    const banInfo: BanError = {
                        code: 'ACCOUNT_BANNED',
                        message: error.error.message || 'Tu cuenta ha sido suspendida',
                        banReason: error.error.banReason || 'No especificado',
                        bannedAt: new Date(error.error.bannedAt),
                        banExpiresAt: error.error.banExpiresAt ? new Date(error.error.banExpiresAt) : undefined,
                        hoursRemaining: error.error.hoursRemaining
                    };

                    // Forzar logout del usuario
                    this.authService.forcedLogout(banInfo);
                }

                // Re-lanzar el error para que otros manejadores puedan procesarlo
                return throwError(() => error);
            })
        );
    }
}