import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environments';
import { Router } from '@angular/router';

interface AuthResponse {
    token: string;
    user: {
        id: string;
        username: string;
        email: string;
        avatar: string
    };
}

export interface User {
    id: string;
    username: string;
    email: string;
    avatar: string;
    isPremium?: boolean;
    premiumExpiry?: Date;
}

// Interfaz para errores de ban
export interface BanError {
  code: 'USER_BANNED' | 'USER_BANNED_SESSION_INVALID' | 'ACCOUNT_BANNED'; // Acepta los 3 códigos
  message: string;
  banReason: string;
  bannedAt: Date;
  banExpiresAt?: Date;
  isPermanent?: boolean;
  hoursRemaining?: number;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    public currentUserSubject = new BehaviorSubject<any>(null);
    public currentUser = this.currentUserSubject.asObservable();

    // Subject para notificar cuando un usuario es baneado
    private userBannedSubject = new BehaviorSubject<BanError | null>(null);
    public userBanned$ = this.userBannedSubject.asObservable();

    private apiUrl = environment.apiUrl + '/auth';

    constructor(
        private http: HttpClient,
        private router: Router
    ) {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            this.currentUserSubject.next(JSON.parse(storedUser));
        }
    }

    register(
        username: string,
        email: string,
        password: string,
        avatar: string = 'avatar1'
    ): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiUrl}/register`, {
            username,
            email,
            password,
            avatar
        }).pipe(
            tap(response => {
                this.saveAuth(response);
            }),
            catchError(error => {
                return throwError(() => error);
            })
        );
    }

    login(email: string, password: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiUrl}/login`, {
            email,
            password
        }).pipe(
            tap(response => {
                this.saveAuth(response);
            }),
            catchError(error => {
                console.error('Error en login:', error);

                // Manejo específico para usuarios baneados - AJUSTADO para el backend
                if (error.status === 403 && error.error?.code === 'USER_BANNED') {
                    const banInfo: BanError = {
                        code: 'USER_BANNED',
                        message: error.error.message || 'Tu cuenta está suspendida',
                        banReason: error.error.banInfo?.reason || 'No especificado',
                        bannedAt: error.error.banInfo?.bannedAt ? new Date(error.error.banInfo.bannedAt) : new Date(),
                        banExpiresAt: error.error.banInfo?.expiresAt ? new Date(error.error.banInfo.expiresAt) : undefined,
                        isPermanent: error.error.banInfo?.isPermanent || false,
                        hoursRemaining: this.calculateHoursRemaining(error.error.banInfo?.expiresAt)
                    };

                    // Notificar que el usuario está baneado
                    this.userBannedSubject.next(banInfo);
                    return throwError(() => banInfo);
                }

                // Otros errores
                if (error.status === 401) {
                    return throwError(() => new Error('INVALID_CREDENTIALS'));
                } else if (error.status === 404) {
                    return throwError(() => new Error('USER_NOT_FOUND'));
                } else {
                    return throwError(() => new Error('SERVER_ERROR'));
                }
            })
        );
    }

    private saveAuth(response: any) {
        if (response && response.token) {
            localStorage.setItem('token', response.token);

            const userData = response.user;

            const userToStore = {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                avatar: userData.avatar || 'default-avatar',
                // Preservar estado premium si existe en localStorage
                ...(this.getPremiumInfoFromStorage())
            };

            localStorage.setItem('user', JSON.stringify(userToStore));
            this.currentUserSubject.next(userToStore);
        } else {
            console.error('Respuesta inválida en saveAuth:', response);
        }
    }

    private getPremiumInfoFromStorage(): { isPremium?: boolean, premiumExpiry?: Date } {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                if (typeof user.isPremium !== 'undefined') {
                    return {
                        isPremium: user.isPremium,
                        premiumExpiry: user.premiumExpiry ? new Date(user.premiumExpiry) : undefined
                    };
                }
            }
        } catch (e) {
            console.error('Error al recuperar información premium del almacenamiento:', e);
        }
        return {};
    }

    logout(): void {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        this.currentUserSubject.next(null);
        this.userBannedSubject.next(null); // Limpiar estado de ban
    }

    /**
     * Fuerza el logout del usuario (usado cuando es baneado mientras está conectado)
     */
    forcedLogout(banInfo?: BanError): void {
        console.log('Usuario forzado a cerrar sesión:', banInfo);

        this.logout();

        if (banInfo) {
            this.userBannedSubject.next(banInfo);
        }

        // Redirigir al login
        this.router.navigate(['/login']);
    }

    /**
     * Método para manejar errores 403 de ban en las peticiones HTTP - ACTUALIZADO
     */
    handleBanError(error: any): void {
        if (error.status === 403 && 
           (error.error?.code === 'USER_BANNED' || error.error?.code === 'ACCOUNT_BANNED')) {
            const banInfo: BanError = {
                code: error.error.code,
                message: error.error.message || 'Tu cuenta está suspendida',
                banReason: error.error.banInfo?.reason || 'No especificado',
                bannedAt: error.error.banInfo?.bannedAt ? new Date(error.error.banInfo.bannedAt) : new Date(),
                banExpiresAt: error.error.banInfo?.expiresAt ? new Date(error.error.banInfo.expiresAt) : undefined,
                isPermanent: error.error.banInfo?.isPermanent || false,
                hoursRemaining: this.calculateHoursRemaining(error.error.banInfo?.expiresAt)
            };

            this.forcedLogout(banInfo);
        }
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }

    isAuthenticated(): boolean {
        return this.getToken() !== null;
    }

    // Getter para currentUser (para compatibilidad)
    get currentUserValue(): any {
        return this.currentUserSubject.value;
    }

    updatePremiumStatus(isPremium: boolean, expiryDate?: string): void {
        const currentUser = this.currentUserSubject.value;
        if (currentUser) {
            // Verificar si realmente hay un cambio
            const premiumChanged = currentUser.isPremium !== isPremium;
            const expiryChanged =
                (expiryDate && !currentUser.premiumExpiry) ||
                (!expiryDate && currentUser.premiumExpiry) ||
                (expiryDate && currentUser.premiumExpiry &&
                    new Date(expiryDate).getTime() !== new Date(currentUser.premiumExpiry).getTime());

            // Solo actualizar si hay cambios
            if (premiumChanged || expiryChanged) {
                const updatedUser = {
                    ...currentUser,
                    isPremium,
                    premiumExpiry: expiryDate ? new Date(expiryDate) : null
                };

                // Actualizar en localStorage
                localStorage.setItem('user', JSON.stringify(updatedUser));

                // Actualizar en el subject
                this.currentUserSubject.next(updatedUser);

                console.log('Estado premium actualizado:', { isPremium, expiryDate });
            }
        }
    }

    /* Verifica si la contraseña proporcionada es correcta para el usuario actual*/
    verifyPassword(password: string): Observable<boolean> {
        // Obtener el token de localStorage
        const token = this.getToken();

        if (!token) {
            console.error('No hay token de autenticación disponible');
            return of(false);
        }

        // Crear headers con el token de autorización
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        });

        return this.http.post<{ valid: boolean }>(
            `${this.apiUrl}/verify-password`,
            { password },
            { headers }
        ).pipe(
            map(response => {
                console.log('Verificación exitosa:', response.valid);
                return response.valid;
            }),
            catchError(error => {
                // Manejar error de ban en verificación de contraseña
                if (error.status === 403 && 
                   (error.error?.code === 'USER_BANNED' || error.error?.code === 'ACCOUNT_BANNED')) {
                    this.handleBanError(error);
                }

                // Manejo específico de errores
                if (error.status === 401) {
                    console.error('Token inválido o expirado');
                } else if (error.status === 400) {
                    console.error('Datos de solicitud inválidos');
                } else if (error.status === 500) {
                    console.error('Error del servidor');
                }

                return of(false);
            })
        );
    }

    /**
     * Limpia el estado de ban (útil para cuando se cierra el modal)
     */
    clearBanState(): void {
        this.userBannedSubject.next(null);
    }

    /**
     * Calcula las horas restantes hasta la expiración del ban
     */
    private calculateHoursRemaining(expiresAt?: string): number | undefined {
        if (!expiresAt) return undefined;
        
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diffMs = expiry.getTime() - now.getTime();
        
        if (diffMs <= 0) return 0;
        
        return Math.ceil(diffMs / (1000 * 60 * 60));
    }

    /**
     * Para compatibilidad con componentes que usan getBanInfoFromRoute
     */
    getBanInfoFromRoute(): BanError | null {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('banned') === 'true') {
            return {
                code: 'USER_BANNED',
                message: 'Tu cuenta ha sido suspendida',
                banReason: 'Revisa la información proporcionada',
                bannedAt: new Date(),
                banExpiresAt: undefined,
                isPermanent: true
            };
        }
        return null;
    }
}