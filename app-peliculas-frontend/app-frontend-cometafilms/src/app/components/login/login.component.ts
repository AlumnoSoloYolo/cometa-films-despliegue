import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { AuthService, BanError } from '../../services/auth.service';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild('successAlert') successAlert?: ElementRef;
  @ViewChild('errorAlert') errorAlert?: ElementRef;
  @ViewChild('banAlert') banAlert?: ElementRef;

  // Estados de UI
  successMessage: string | null = null;
  showMessage = false;

  // Errores específicos por campo
  emailError: string | null = null;
  passwordError: string | null = null;
  generalError: string | null = null;

  // Estado para usuarios baneados
  banInfo: BanError | null = null;
  showBanModal = false;

  private banSubscription?: Subscription;

  // Formulario
  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required])
  });

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('🚀 LoginComponent inicializado');
    
    // Limpiar estado previo
    this.authService.clearBanState();
    
    // Suscribirse a notificaciones de ban
    this.banSubscription = this.authService.userBanned$.subscribe(banInfo => {
      if (banInfo) {
        console.log('📧 Notificación de ban recibida:', banInfo);
        this.banInfo = banInfo;
        this.showBanModal = true;
        
        setTimeout(() => {
          this.banAlert?.nativeElement?.focus();
        }, 100);
      }
    });
  }

  ngOnDestroy() {
    if (this.banSubscription) {
      this.banSubscription.unsubscribe();
    }
  }

  get formulario() {
    return this.loginForm.controls;
  }

  getErrorMessage(field: string): string {
    const control = this.loginForm.get(field);

    // Errores de validación del formulario
    if (control?.errors && control.touched) {
      if (control.errors['required']) {
        return 'Este campo es obligatorio';
      }
    }

    // Errores específicos del servidor
    if (field === 'email' && this.emailError) {
      return this.emailError;
    }

    if (field === 'password' && this.passwordError) {
      return this.passwordError;
    }

    return '';
  }

  onLogin() {
    console.log('🔐 Iniciando proceso de login...');
    
    // Reset de TODOS los errores
    this.emailError = null;
    this.passwordError = null;
    this.generalError = null;
    this.successMessage = null;
    this.showMessage = false;
    this.showBanModal = false;
    this.banInfo = null;

    // Validar formulario
    if (this.loginForm.invalid) {
      console.log('❌ Formulario inválido');
      Object.keys(this.loginForm.controls).forEach(key => {
        const control = this.loginForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    const { email, password } = this.loginForm.value;
    console.log('📤 Enviando credenciales para:', email);

    // Deshabilitar formulario
    this.loginForm.disable();

    this.authService.login(email!, password!).subscribe({
      next: (response) => {
        console.log('✅ Login exitoso:', response);
        
        this.successMessage = '¡Bienvenid@!';
        this.showMessage = true;

        setTimeout(() => {
          this.successAlert?.nativeElement?.focus();
        }, 100);

        // Redirigir al perfil
        setTimeout(() => {
          console.log('🏠 Redirigiendo a perfil...');
          this.router.navigate(['/perfil']);
        }, 1500);
      },
      
      error: (error) => {
        console.log('❌ Error recibido:', error);
        
        // Re-habilitar formulario
        this.loginForm.enable();

        // Si es un error de ban (objeto BanError)
        if (error && typeof error === 'object' && error.code) {
          console.log('🚫 Error de ban detectado:', error);
          this.banInfo = error;
          this.showBanModal = true;
          
          setTimeout(() => {
            this.banAlert?.nativeElement?.focus();
          }, 100);
          return;
        }

        // Si es un HttpErrorResponse (error del servidor)
        if (error.status) {
          console.log('🌐 Error HTTP:', error.status, error.error);
          this.handleHttpError(error);
        } 
        // Si es un Error object (errores que convertimos en AuthService)
        else if (error instanceof Error) {
          console.log('⚠️ Error convertido:', error.message);
          this.handleConvertedError(error.message);
        } 
        else {
          // Error genérico
          this.generalError = 'Error de conexión. Verifica tu conexión a internet';
          this.showMessage = true;
        }

        // Mostrar modal de error general si hay
        if (this.generalError) {
          setTimeout(() => {
            this.errorAlert?.nativeElement?.focus();
          }, 100);

          setTimeout(() => {
            this.showMessage = false;
          }, 3000);
        }

        // Marcar campos como touched
        Object.keys(this.loginForm.controls).forEach(key => {
          const control = this.loginForm.get(key);
          control?.markAsTouched();
        });
      }
    });
  }

  /**
   * Maneja errores HTTP directos del servidor
   */
  private handleHttpError(error: any): void {
    switch (error.status) {
      case 401:
        // Credenciales incorrectas - puede ser email o password
        if (error.error?.message?.toLowerCase().includes('email')) {
          this.emailError = 'Este email no está registrado';
        } else {
          this.passwordError = 'Contraseña incorrecta';
        }
        break;
      case 404:
        this.emailError = 'Este email no está registrado';
        break;
      case 500:
        this.generalError = 'Error del servidor. Inténtalo más tarde';
        this.showMessage = true;
        break;
      default:
        this.generalError = 'Error desconocido. Inténtalo más tarde';
        this.showMessage = true;
    }
  }

  /**
   * Maneja errores que fueron convertidos en AuthService
   */
  private handleConvertedError(errorMessage: string): void {
    switch (errorMessage) {
      case 'INVALID_CREDENTIALS':
        this.passwordError = 'Contraseña incorrecta';
        break;
      case 'USER_NOT_FOUND':
        this.emailError = 'Este email no está registrado';
        break;
      case 'SERVER_ERROR':
        this.generalError = 'Error del servidor. Inténtalo más tarde';
        this.showMessage = true;
        break;
      default:
        this.generalError = 'Error desconocido. Inténtalo más tarde';
        this.showMessage = true;
    }
  }

  // === MÉTODOS PARA MODAL DE BAN ===

  getBanMessage(): string {
    if (!this.banInfo) return '';

    let message = `Tu cuenta ha sido suspendida`;

    if (this.banInfo.banExpiresAt && !this.banInfo.isPermanent) {
      if (this.banInfo.hoursRemaining && this.banInfo.hoursRemaining > 0) {
        const days = Math.floor(this.banInfo.hoursRemaining / 24);
        const hours = this.banInfo.hoursRemaining % 24;

        if (days > 0) {
          message += ` por ${days} día${days !== 1 ? 's' : ''}`;
          if (hours > 0) {
            message += ` y ${hours} hora${hours !== 1 ? 's' : ''}`;
          }
        } else {
          message += ` por ${hours} hora${hours !== 1 ? 's' : ''}`;
        }
      }
    } else {
      message += ` permanentemente`;
    }

    if (this.banInfo.banReason && this.banInfo.banReason !== 'No especificado') {
      message += `\n\nMotivo: ${this.banInfo.banReason}`;
    }

    return message;
  }

  formatBanDate(date: Date): string {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getRemainingTimeText(): string {
    if (!this.banInfo?.hoursRemaining) return '';
    
    const hours = this.banInfo.hoursRemaining;
    
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      
      if (remainingHours === 0) {
        return `${days} día${days !== 1 ? 's' : ''}`;
      } else {
        return `${days} día${days !== 1 ? 's' : ''} y ${remainingHours} hora${remainingHours !== 1 ? 's' : ''}`;
      }
    } else {
      return `${hours} hora${hours !== 1 ? 's' : ''}`;
    }
  }

  closeBanModal(): void {
    console.log('❌ Cerrando modal de ban');
    this.showBanModal = false;
    this.banInfo = null;
    this.authService.clearBanState();
  }
}