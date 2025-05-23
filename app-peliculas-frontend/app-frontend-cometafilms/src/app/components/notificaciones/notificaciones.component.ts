import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { UserSocialService } from '../../services/social.service';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notificaciones.component.html',
  styleUrl: './notificaciones.component.css'
})
export class NotificacionesComponent implements OnInit, OnDestroy {
  followRequests: any[] = [];
  cargando: boolean = false;
  activeTab: 'solicitudes' | 'notificaciones' = 'solicitudes';
  private socketSubscription?: Subscription;

  constructor(
    private userSocialService: UserSocialService,
    private socketService: SocketService
  ) { }

  ngOnInit(): void {
    this.cargarSolicitudes();

    // Suscribirse a nuevas solicitudes de seguimiento
    this.socketSubscription = this.socketService.newFollowRequest$.subscribe(
      request => {
        if (request) {
          // Verificar si ya existe esta solicitud en la lista
          const existingIndex = this.followRequests.findIndex(r => r._id === request.requestId);

          if (existingIndex === -1) {
            // La solicitud no existe, añadirla al principio del array
            this.followRequests.unshift({
              _id: request.requestId,
              requester: request.requester,
              createdAt: request.timestamp
            });
          }
        }
      }
    );
  }

  ngOnDestroy(): void {
    if (this.socketSubscription) {
      this.socketSubscription.unsubscribe();
    }
  }

  cargarSolicitudes(): void {
    this.cargando = true;
    this.userSocialService.getPendingFollowRequests().subscribe({
      next: (solicitudes) => {
        this.followRequests = solicitudes;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al cargar solicitudes de seguimiento:', error);
        this.cargando = false;
      }
    });
  }

  aceptarSolicitud(requestId: string): void {
    this.userSocialService.acceptFollowRequest(requestId).subscribe({
      next: () => {
        // Actualizar la lista eliminando la solicitud aceptada
        this.followRequests = this.followRequests.filter(req => req._id !== requestId);
      },
      error: (error) => {
        console.error('Error al aceptar solicitud:', error);
      }
    });
  }

  rechazarSolicitud(requestId: string): void {
    this.userSocialService.rejectFollowRequest(requestId).subscribe({
      next: () => {
        // Actualizar la lista eliminando la solicitud rechazada
        this.followRequests = this.followRequests.filter(req => req._id !== requestId);
      },
      error: (error) => {
        console.error('Error al rechazar solicitud:', error);
      }
    });
  }

  cambiarTab(tab: 'solicitudes' | 'notificaciones'): void {
    this.activeTab = tab;
    if (tab === 'solicitudes') {
      this.cargarSolicitudes();
    }
  }

  getAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }
}

