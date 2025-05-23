import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router, RouterModule } from '@angular/router';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  globalError: string | null = null;
  successMessage: string | null = null;
  showMessage = false;

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


          setTimeout(() => {
            this.showMessage = false;
            this.router.navigate(['/perfil']);
          }, 3000);
        },
        error: (error) => {

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
}