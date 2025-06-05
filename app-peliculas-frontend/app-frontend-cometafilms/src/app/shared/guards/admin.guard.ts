// src/app/shared/guards/admin.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { AdminService } from '../../services/admin.service';

@Injectable({
  providedIn: 'root'
})
export class AdminGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
  
    
    // Verificar primero si está autenticado
    if (!this.authService.isAuthenticated()) {
      
      this.router.navigate(['/login']);
      return of(false);
    }
    
    console.log('✅ AdminGuard: Usuario autenticado, verificando permisos...');

    // Verificar permisos de admin
    return this.adminService.getUserPermissions().pipe(
      map(response => {
   
        
        // El backend devuelve: { success: true, user: {...}, permissions: { can: {...} } }
        // Necesitamos acceder a response.permissions.can.accessAdminPanel
        const permissions = response.permissions || response;
        const hasAccess = permissions?.can?.accessAdminPanel === true;
        
       
        
        if (hasAccess) {
       
          return true;
        } else {
         
          this.router.navigate(['/']);
          return false;
        }
      }),
      catchError(error => {
      
        this.router.navigate(['/']);
        return of(false);
      })
    );
  }
}