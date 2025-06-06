import { Component, ViewChild, ElementRef, AfterViewInit, OnInit, OnDestroy } from '@angular/core';
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
export class LoginComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('successAlert') successAlert?: ElementRef;
  @ViewChild('errorAlert') errorAlert?: ElementRef;
  @ViewChild('banAlert') banAlert?: ElementRef;

  globalError: string | null = null;
  successMessage: string | null = null;
  showMessage = false;

  // Estado para manejar usuarios baneados
  banInfo: BanError | null = null;
  showBanModal = false;

  private banSubscription?: Subscription;

  loginForm = new FormGroup({
    email: new FormControl('', [
      Validators.required,
    ]),
    password: new FormControl('', [
      Validators.required,
    ])
  });

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    // Suscribirse a notificaciones de usuarios baneados
    this.banSubscription = this.authService.userBanned$.subscribe(banInfo => {
      if (banInfo) {
        this.banInfo = banInfo;
        this.showBanModal = true;

        // Focus en el modal de ban
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

  ngAfterViewInit() {

  }

  getErrorMessage(field: string): string {
    const control = this.loginForm.get(field);

    if (control?.errors) {
      if (control.errors['required']) {
        return 'Este campo es obligatorio';
      }
    }

    if (field === 'email' && this.globalError) {
      return this.globalError;
    }

    return '';
  }

  get formulario() {
    return this.loginForm.controls;
  }

  onLogin() {
    this.globalError = null;
    this.successMessage = null;
    this.showMessage = false;
    this.showBanModal = false;
    this.banInfo = null;
    this.authService.clearBanState();
    this.loginForm.enable();

    if (this.loginForm.invalid) {
      Object.keys(this.loginForm.controls).forEach(key => {
        const control = this.loginForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    const { email, password } = this.loginForm.value;

    this.loginForm.disable();

    this.authService.login(email!, password!)
      .subscribe({
        next: () => {
          this.successMessage = '¡Bienvenid@!';
          this.showMessage = true;

          // Focus en el mensaje después de un pequeño delay
          setTimeout(() => {
            this.successAlert?.nativeElement?.focus();
          }, 100);

          setTimeout(() => {
            this.showMessage = false;
            this.router.navigate(['/perfil']);
          }, 3000);
        },
        error: (error) => {
          // Manejar error de usuario baneado
          if (error && typeof error === 'object' && error.code === 'ACCOUNT_BANNED') {
            this.banInfo = error;
            this.showBanModal = true;

            setTimeout(() => {
              this.banAlert?.nativeElement?.focus();
            }, 100);

            this.loginForm.enable();
            return;
          }

          // Otros errores
          if (error instanceof Error) {
            switch (error.message) {
              case 'INVALID_CREDENTIALS':
                this.globalError = 'contraseña incorrecta';
                break;
              case 'USER_NOT_FOUND':
                this.globalError = 'No se encontró un usuario con este email.';
                break;
              default:
                this.globalError = 'Hubo un problema en el servidor. Inténtalo de nuevo más tarde.';
            }
          } else {
            this.globalError = 'Error desconocido. Inténtalo de nuevo más tarde.';
          }

          this.showMessage = true;

          // Focus en el mensaje de error
          setTimeout(() => {
            this.errorAlert?.nativeElement?.focus();
          }, 100);

          setTimeout(() => {
            this.showMessage = false;
            this.loginForm.enable();
          }, 1000);

          Object.keys(this.loginForm.controls).forEach(key => {
            const control = this.loginForm.get(key);
            control?.markAsTouched();
          });
        }
      });
  }

  /* Formatea la información del ban para mostrarla al usuario*/
  getBanMessage(): string {
    if (!this.banInfo) return '';

    let message = `Tu cuenta ha sido suspendida`;

    if (this.banInfo.banExpiresAt) {
      // Ban temporal
      if (this.banInfo.hoursRemaining && this.banInfo.hoursRemaining > 0) {
        const days = Math.floor(this.banInfo.hoursRemaining / 24);
        const hours = this.banInfo.hoursRemaining % 24;

        if (days > 0) {
          message += ` hasta el ${this.formatDate(this.banInfo.banExpiresAt)}`;
        } else {
          message += ` por ${hours} hora${hours !== 1 ? 's' : ''} más`;
        }
      } else {
        message += ` hasta el ${this.formatDate(this.banInfo.banExpiresAt)}`;
      }
    } else {
      // Ban permanente
      message += ` permanentemente`;
    }

    if (this.banInfo.banReason) {
      message += `\n\nMotivo: ${this.banInfo.banReason}`;
    }

    return message;
  }

  /* Formatea una fecha para mostrarla al usuario*/
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  /** Cierra el modal de ban*/
  closeBanModal(): void {
    this.showBanModal = false;
    this.banInfo = null;
    this.authService.clearBanState();
  }
}