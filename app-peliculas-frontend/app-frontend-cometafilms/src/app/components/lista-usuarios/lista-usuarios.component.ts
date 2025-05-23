// src/app/components/lista-usuarios/lista-usuarios.component.ts
import { Component, OnInit, HostListener } from '@angular/core';
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

  // Nuevas propiedades para seguimiento
  followStatus: { [userId: string]: 'none' | 'requested' | 'following' } = {};
  requestIds: { [userId: string]: string } = {};
  isHovering: { [userId: string]: boolean } = {};

  constructor(
    private userSocialService: UserSocialService,
    private fb: FormBuilder
  ) {
    this.searchForm = this.fb.group({
      username: [
        '',
        [
          Validators.minLength(3),
          Validators.maxLength(30),
          Validators.pattern(/^[a-zA-Z0-9_-]*$/) // Solo letras, números, guiones y guiones bajos
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

    // Configurar búsqueda con debounce
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
    this.paginaActual = 1;
    this.usuarios = [];
    this.cargarUsuarios();
  }

  // Método para verificar estado de seguimiento de todos los usuarios
  checkFollowStatus(usuarios: User[]): void {
    usuarios.forEach(usuario => {
      this.userSocialService.getFollowStatus(usuario._id).subscribe({
        next: (response: any) => {
          this.followStatus[usuario._id] = response.status;
          if (response.requestId) {
            this.requestIds[usuario._id] = response.requestId;
          }
        },
        error: (error) => {
          console.error(`Error al verificar estado de seguimiento para ${usuario.username}:`, error);
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

        // Verificar estado de seguimiento de los nuevos usuarios
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
        this.hayMasPaginas = false; // Desactivar scroll infinito en modo búsqueda
        this.cargando = false;

        // Verificar estado de seguimiento para resultados de búsqueda
        this.checkFollowStatus(usuarios);
      },
      error: (error: any) => {
        console.error('Error al buscar usuarios:', error);
        this.cargando = false;
        this.error = true;
      }
    });
  }

  // Método para manejar el hover
  setHovering(userId: string, isHovering: boolean): void {
    this.isHovering[userId] = isHovering;
  }

  // Método toggleFollow actualizado
  toggleFollow(usuario: User, event: Event): void {
    event.stopPropagation();
    const userId = usuario._id;

    // Si ya está siguiendo, dejar de seguir
    if (this.followStatus[userId] === 'following') {
      this.userSocialService.unfollowUser(userId).subscribe({
        next: () => {
          this.followStatus[userId] = 'none';
          usuario.isFollowing = false;
        },
        error: (error) => {
          console.error('Error al dejar de seguir:', error);
        }
      });
      return;
    }

    // Si hay una solicitud pendiente, cancelarla
    if (this.followStatus[userId] === 'requested' && this.requestIds[userId]) {
      this.userSocialService.cancelFollowRequest(this.requestIds[userId]).subscribe({
        next: () => {
          this.followStatus[userId] = 'none';
          delete this.requestIds[userId];
        },
        error: (error) => {
          console.error('Error al cancelar solicitud:', error);
        }
      });
      return;
    }

    // En cualquier otro caso, intentar seguir
    this.userSocialService.followUser(userId).subscribe({
      next: (response: any) => {
        this.followStatus[userId] = response.status;
        if (response.requestId) {
          this.requestIds[userId] = response.requestId;
        }
        if (response.status === 'following') {
          usuario.isFollowing = true;
        }
      },
      error: (error) => {
        console.error('Error al seguir usuario:', error);
        alert(`Error: ${error.error?.message || 'No se pudo completar la acción'}`);
      }
    });
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