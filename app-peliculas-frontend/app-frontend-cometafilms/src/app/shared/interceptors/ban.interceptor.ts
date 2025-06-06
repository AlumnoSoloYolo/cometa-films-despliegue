import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable, throwError, EMPTY } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService, BanError } from '../../services/auth.service';

@Injectable()
export class BanInterceptor implements HttpInterceptor {

    constructor(private authService: AuthService) { }

    intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
        return next.handle(request).pipe(
            catchError(error => {
                console.log('🔍 Interceptor - Error detectado:', {
                    status: error.status,
                    code: error.error?.code,
                    url: request.url
                });

                // Verificar si es un error de ban
                if (error.status === 403 && 
                   (error.error?.code === 'USER_BANNED' || 
                    error.error?.code === 'USER_BANNED_SESSION_INVALID' ||
                    error.error?.code === 'ACCOUNT_BANNED')) {
                    
                    console.log('🚫 Usuario baneado detectado en interceptor - FORZANDO LOGOUT');
                    
                    // Crear objeto BanError
                    const banInfo: BanError = {
                        code: error.error.code,
                        message: error.error.message || 'Tu cuenta ha sido suspendida',
                        banReason: error.error.banInfo?.reason || 'No especificado',
                        bannedAt: error.error.banInfo?.bannedAt ? new Date(error.error.banInfo.bannedAt) : new Date(),
                        banExpiresAt: error.error.banInfo?.expiresAt ? new Date(error.error.banInfo.expiresAt) : undefined,
                        isPermanent: error.error.banInfo?.isPermanent || false,
                        hoursRemaining: this.calculateHoursRemaining(error.error.banInfo?.expiresAt)
                    };

                    console.log('📋 BanInfo creado:', banInfo);

                    // ⭐ FORZAR LOGOUT INMEDIATO
                    setTimeout(() => {
                        console.log('💥 Ejecutando forcedLogout...');
                        this.authService.forcedLogout(banInfo);
                        
                        // Forzar recarga de la página para limpiar todo el estado
                        setTimeout(() => {
                            console.log('🔄 Recargando página para limpiar estado...');
                            window.location.href = '/login?banned=true';
                        }, 100);
                    }, 0);

                    // Devolver un observable vacío para no propagar el error
                    return EMPTY;
                }

                // Para errores que no son de ban, pasarlos tal como vienen
                return throwError(() => error);
            })
        );
    }

    /**
     * Calcular horas restantes (método auxiliar)
     */
    private calculateHoursRemaining(expiresAt?: string): number | undefined {
        if (!expiresAt) return undefined;
        
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diffMs = expiry.getTime() - now.getTime();
        
        if (diffMs <= 0) return 0;
        
        return Math.ceil(diffMs / (1000 * 60 * 60));
    }
}