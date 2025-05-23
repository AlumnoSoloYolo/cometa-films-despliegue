import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environments';

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

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    public currentUserSubject = new BehaviorSubject<any>(null);
    public currentUser = this.currentUserSubject.asObservable();

    private apiUrl = environment.apiUrl + '/auth';

    constructor(private http: HttpClient) {
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
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }

    isAuthenticated(): boolean {
        return this.getToken() !== null;
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
}