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

  followStatus: { [userId: string]: 'none' | 'requested' | 'following' } = {};
  requestIds: { [userId: string]: string } = {};
  isHovering: { [userId: string]: boolean } = {};
  processingFollow: { [userId: string]: boolean } = {};

  private isLoadingFollowStatus = false;

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
      this.isLoadingFollowStatus = false;
      this.cdr.detectChanges();
    });
    this.cargarUsuarios();
  }
  
  checkFollowStatusBulk(usuarios: User[]): void {
    if (this.isLoadingFollowStatus || usuarios.length === 0) return;

    this.isLoadingFollowStatus = true;
    const userIds = usuarios.map(u => u._id);

    this.userSocialService.getBulkFollowStatus(userIds).subscribe({
      next: (response: any) => {
        this.ngZone.run(() => {
          setTimeout(() => {
            const statusMap = response.followStatus || {};
            Object.keys(statusMap).forEach(userId => {
              this.followStatus[userId] = statusMap[userId].status || 'none';
              if (statusMap[userId].requestId) {
                this.requestIds[userId] = statusMap[userId].requestId;
              }
            });
            this.isLoadingFollowStatus = false;
            this.cdr.detectChanges();
          }, 0);
        });
      },
      error: (error) => {
        console.error('Error al verificar estados de seguimiento masivo:', error);
        this.ngZone.run(() => {
          this.isLoadingFollowStatus = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  cargarUsuarios(pagina: number = 1): void {
    if (this.cargando) return;

    this.cargando = true;
    this.error = false;

    this.userSocialService.getAllUsersOptimized(pagina).subscribe({
      next: (response: UserResponse) => {
        const nuevosUsuarios = response.users;

        if (pagina === 1) {
          this.usuarios = nuevosUsuarios;
        } else {
          this.usuarios = [...this.usuarios, ...nuevosUsuarios];
        }

        this.totalPaginas = response.pagination.totalPages;
        this.totalUsuarios = response.pagination.total;
        this.hayMasPaginas = response.pagination.hasMore;
        this.cargando = false;
        
        this.checkFollowStatusBulk(nuevosUsuarios);
      },
      error: (error: any) => {
        console.error('Error al cargar usuarios:', error);
        this.cargando = false;
        this.error = true;
        this.cargarUsuariosFallback(pagina);
      }
    });
  }

  private cargarUsuariosFallback(pagina: number = 1): void {
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

        this.checkFollowStatusBulk(response.users);
      },
      error: (error: any) => {
        console.error('Error en fallback al cargar usuarios:', error);
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

        this.ngZone.run(() => {
          this.followStatus = {};
          this.requestIds = {};
          this.isHovering = {};
          this.processingFollow = {};
          this.isLoadingFollowStatus = false;
          this.cdr.detectChanges();
        });

        this.checkFollowStatusBulk(usuarios);
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

  /**************************************************/
  /** MÉTODOS CORREGIDOS Y ROBUSTOS            **/
  /**************************************************/

  getButtonText(userId: string): string {
    const processing = this.processingFollow[userId];
    if (processing) {
      return 'Procesando...';
    }

    // *** LA CLAVE ESTÁ AQUÍ ***
    // Si aún no hemos recibido el estado para ESTE usuario en particular,
    // mostramos los puntos suspensivos. Es una comprobación individual.
    if (this.followStatus[userId] === undefined) {
      return '...';
    }

    const status = this.followStatus[userId];
    const hovering = this.isHovering[userId] || false;

    switch (status) {
      case 'following':
        return hovering ? 'Dejar de seguir' : 'Siguiendo';
      case 'requested':
        return hovering ? 'Cancelar' : 'Solicitado';
      default: // 'none'
        return 'Seguir';
    }
  }

  getButtonIcon(userId: string): string {
    const processing = this.processingFollow[userId];
    if (processing) {
      return 'bi-hourglass-split';
    }
      
    // *** LA MISMA LÓGICA AQUÍ ***
    if (this.followStatus[userId] === undefined) {
      return 'bi-three-dots';
    }
    
    const status = this.followStatus[userId];
    const hovering = this.isHovering[userId] || false;

    switch (status) {
      case 'following':
        return hovering ? 'bi-person-dash-fill' : 'bi-check-lg';
      case 'requested':
        return hovering ? 'bi-x-circle-fill' : 'bi-hourglass-split';
      default: // 'none'
        return 'bi-person-plus-fill';
    }
  }
  
  /**************************************************/
  /**************************************************/

  toggleFollow(usuario: User, event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    const userId = usuario._id;

    if (this.processingFollow[userId]) {
      return;
    }

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
            setTimeout(() => {
              this.followStatus[userId] = 'none';
              this.processingFollow[userId] = false;
              if (this.requestIds[userId]) { delete this.requestIds[userId]; }
              this.cdr.detectChanges();
            }, 0);
          });
        },
        error: (error) => {
          console.error('Error al dejar de seguir:', error);
          this.ngZone.run(() => {
            this.processingFollow[userId] = false;
            this.cdr.detectChanges();
          });
        }
      });
    } else if (currentStatus === 'requested' && this.requestIds[userId]) {
      this.userSocialService.cancelFollowRequest(this.requestIds[userId]).subscribe({
        next: () => {
          this.ngZone.run(() => {
            setTimeout(() => {
              this.followStatus[userId] = 'none';
              delete this.requestIds[userId];
              this.processingFollow[userId] = false;
              this.cdr.detectChanges();
            }, 0);
          });
        },
        error: (error) => {
          console.error('Error al cancelar solicitud:', error);
          this.ngZone.run(() => {
            this.processingFollow[userId] = false;
            this.cdr.detectChanges();
          });
        }
      });
    } else {
      this.userSocialService.followUser(userId).subscribe({
        next: (response: any) => {
          this.ngZone.run(() => {
            setTimeout(() => {
              this.followStatus[userId] = response.status || 'requested';
              if (response.requestId) { this.requestIds[userId] = response.requestId; }
              this.processingFollow[userId] = false;
              this.cdr.detectChanges();
            }, 0);
          });
        },
        error: (error) => {
          console.error('Error al seguir usuario:', error);
          this.ngZone.run(() => {
            this.processingFollow[userId] = false;
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