// src/app/components/lista-usuarios/lista-usuarios.component.ts
import { Component, OnInit, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { UserSocialService } from '../../services/social.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { User, UserResponse } from '../../models/user.model';

@Component({
  selector: 'app-usuarios-lista',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './lista-usuarios.component.html',
  styleUrls: ['./lista-usuarios.component.css']
})
export class UsuariosListaComponent implements OnInit {
  usuarios: User[] = [];
  cargando = false;
  error = false;
  paginaActual = 1;
  totalPaginas = 0;
  totalUsuarios = 0;
  hayMasPaginas = true;
  searchForm: FormGroup;
  mostrarBotonSubir = false;

  // Propiedades para seguimiento
  followStatus: { [userId: string]: 'none' | 'requested' | 'following' } = {};
  requestIds: { [userId: string]: string } = {};
  isHovering: { [userId: string]: boolean } = {};
  processingFollow: { [userId: string]: boolean } = {};

  constructor(
    private userSocialService: UserSocialService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {
    this.searchForm = this.fb.group({
      username: [
        '',
        [
          Validators.minLength(3),
          Validators.maxLength(30),
          Validators.pattern(/^[a-zA-Z0-9_-]*$/)
        ]
      ]
    });

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'smooth'
    });
  }

  ngOnInit(): void {
    this.cargarUsuarios();

    this.searchForm.get('username')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged()
      )
      .subscribe(value => {
        if (value && value.length > 2) {
          this.buscarUsuarios(value);
        } else if (!value) {
          this.resetearBusqueda();
        }
      });
  }

  resetearBusqueda(): void {
    this.ngZone.run(() => {
      this.searchForm.get('username')?.setValue('', { emitEvent: false });
      this.paginaActual = 1;
      this.usuarios = [];
      this.followStatus = {};
      this.requestIds = {};
      this.isHovering = {};
      this.processingFollow = {};
      this.cdr.detectChanges();
    });
    this.cargarUsuarios();
  }

  checkFollowStatus(usuarios: User[]): void {
    usuarios.forEach(usuario => {
      // Inicializar estados
      if (!(usuario._id in this.followStatus)) {
        this.ngZone.run(() => {
          this.followStatus[usuario._id] = 'none';
          this.isHovering[usuario._id] = false;
          this.processingFollow[usuario._id] = false;
          this.cdr.detectChanges();
        });
      }

      this.userSocialService.getFollowStatus(usuario._id).subscribe({
        next: (response: any) => {
          this.ngZone.run(() => {
            this.followStatus[usuario._id] = response.status || 'none';
            if (response.requestId) {
              this.requestIds[usuario._id] = response.requestId;
            }
            this.cdr.detectChanges();
          });
        },
        error: (error) => {
          console.error(`Error al verificar estado de seguimiento para ${usuario.username}:`, error);
          this.ngZone.run(() => {
            this.followStatus[usuario._id] = 'none';
            this.cdr.detectChanges();
          });
        }
      });
    });
  }

  cargarUsuarios(pagina: number = 1): void {
    if (this.cargando) return;

    this.cargando = true;
    this.error = false;

    this.userSocialService.getAllUsers(pagina).subscribe({
      next: (response: UserResponse) => {
        if (pagina === 1) {
          this.usuarios = response.users;
        } else {
          this.usuarios = [...this.usuarios, ...response.users];
        }

        this.totalPaginas = response.pagination.totalPages;
        this.totalUsuarios = response.pagination.total;
        this.hayMasPaginas = response.pagination.hasMore;
        this.cargando = false;

        this.checkFollowStatus(response.users);
      },
      error: (error: any) => {
        console.error('Error al cargar usuarios:', error);
        this.cargando = false;
        this.error = true;
      }
    });
  }

  buscarUsuarios(termino: string): void {
    this.cargando = true;
    this.error = false;

    this.userSocialService.searchUsers(termino).subscribe({
      next: (usuarios: User[]) => {
        this.usuarios = usuarios;
        this.hayMasPaginas = false;
        this.cargando = false;
        
        // Limpiar estados previos
        this.ngZone.run(() => {
          this.followStatus = {};
          this.requestIds = {};
          this.isHovering = {};
          this.processingFollow = {};
          this.cdr.detectChanges();
        });
        
        this.checkFollowStatus(usuarios);
      },
      error: (error: any) => {
        console.error('Error al buscar usuarios:', error);
        this.cargando = false;
        this.error = true;
      }
    });
  }

  setHovering(userId: string, isHovering: boolean): void {
    if (!this.processingFollow[userId]) {
      this.ngZone.run(() => {
        this.isHovering[userId] = isHovering;
        this.cdr.detectChanges();
      });
    }
  }

  getButtonText(userId: string): string {
    const status = this.followStatus[userId] || 'none';
    const hovering = this.isHovering[userId] || false;
    const processing = this.processingFollow[userId] || false;

    if (processing) {
      return 'Procesando...';
    }

    switch (status) {
      case 'following':
        return hovering ? 'Dejar de seguir' : 'Siguiendo';
      case 'requested':
        return hovering ? 'Cancelar' : 'Solicitado';
      default:
        return 'Seguir';
    }
  }

  getButtonIcon(userId: string): string {
    const status = this.followStatus[userId] || 'none';
    const hovering = this.isHovering[userId] || false;
    const processing = this.processingFollow[userId] || false;

    if (processing) {
      return 'bi-hourglass-split';
    }

    switch (status) {
      case 'following':
        return hovering ? 'bi-person-dash-fill' : 'bi-check-lg';
      case 'requested':
        return hovering ? 'bi-x-circle-fill' : 'bi-hourglass-split';
      default:
        return 'bi-person-plus-fill';
    }
  }

  toggleFollow(usuario: User, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    
    const userId = usuario._id;

    if (this.processingFollow[userId]) {
      return;
    }

    // Iniciar procesamiento y limpiar hover
    this.ngZone.run(() => {
      this.processingFollow[userId] = true;
      this.isHovering[userId] = false;
      this.cdr.detectChanges();
    });

    const currentStatus = this.followStatus[userId];

    if (currentStatus === 'following') {
      this.userSocialService.unfollowUser(userId).subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.followStatus[userId] = 'none';
            this.processingFollow[userId] = false;
            this.isHovering[userId] = false;
            if (this.requestIds[userId]) {
              delete this.requestIds[userId];
            }
            this.cdr.detectChanges();
          });
        },
        error: (error) => {
          console.error('Error al dejar de seguir:', error);
          this.ngZone.run(() => {
            this.processingFollow[userId] = false;
            this.isHovering[userId] = false;
            this.cdr.detectChanges();
          });
        }
      });
    } else if (currentStatus === 'requested' && this.requestIds[userId]) {
      this.userSocialService.cancelFollowRequest(this.requestIds[userId]).subscribe({
        next: () => {
          this.ngZone.run(() => {
            this.followStatus[userId] = 'none';
            delete this.requestIds[userId];
            this.processingFollow[userId] = false;
            this.isHovering[userId] = false;
            this.cdr.detectChanges();
          });
        },
        error: (error) => {
          console.error('Error al cancelar solicitud:', error);
          this.ngZone.run(() => {
            this.processingFollow[userId] = false;
            this.isHovering[userId] = false;
            this.cdr.detectChanges();
          });
        }
      });
    } else {
      this.userSocialService.followUser(userId).subscribe({
        next: (response: any) => {
          this.ngZone.run(() => {
            this.followStatus[userId] = response.status || 'requested';
            if (response.requestId) {
              this.requestIds[userId] = response.requestId;
            }
            this.processingFollow[userId] = false;
            this.isHovering[userId] = false;
            this.cdr.detectChanges();
          });
        },
        error: (error) => {
          console.error('Error al seguir usuario:', error);
          this.ngZone.run(() => {
            this.processingFollow[userId] = false;
            this.isHovering[userId] = false;
            this.cdr.detectChanges();
          });
          const errorMessage = error.error?.message || 'No se pudo completar la acción';
          alert(`Error: ${errorMessage}`);
        }
      });
    }
  }

  @HostListener('window:scroll')
  manejarScroll() {
    const estaEnElFondo = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300;

    if (!this.cargando && this.hayMasPaginas && estaEnElFondo) {
      this.paginaActual++;
      this.cargarUsuarios(this.paginaActual);
    }

    this.mostrarBotonSubir = window.pageYOffset > 300;
  }

  volverArriba(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }
}