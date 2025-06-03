import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { catchError, EMPTY } from 'rxjs';

import { UserSocialService } from '../../services/social.service';
import { SocketService } from '../../services/socket.service';

interface FollowRequest {
  _id: string;
  requester: {
    _id: string;
    username: string;
    avatar: string;
  };
  createdAt: string;
}

type TabType = 'solicitudes' | 'notificaciones';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './notificaciones.component.html',
  styleUrl: './notificaciones.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotificacionesComponent implements OnInit, OnDestroy {
  followRequests: FollowRequest[] = [];
  cargando = false;
  activeTab: TabType = 'solicitudes';

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly userSocialService: UserSocialService,
    private readonly socketService: SocketService,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.cargarSolicitudes();
    this.setupSocketListener();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  cambiarTab(tab: TabType): void {
    this.activeTab = tab;

    if (tab === 'solicitudes') {
      this.cargarSolicitudes();
    }

    this.cdr.markForCheck();
  }

  aceptarSolicitud(requestId: string): void {
    const acceptSub = this.userSocialService.acceptFollowRequest(requestId)
      .pipe(
        catchError(error => {
          console.error('Error al aceptar solicitud:', error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.followRequests = this.followRequests.filter(req => req._id !== requestId);
        this.emitirCambioContador();
        this.cdr.markForCheck();
      });

    this.subscriptions.add(acceptSub);
  }

  rechazarSolicitud(requestId: string): void {
    const rejectSub = this.userSocialService.rejectFollowRequest(requestId)
      .pipe(
        catchError(error => {
          console.error('Error al rechazar solicitud:', error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.followRequests = this.followRequests.filter(req => req._id !== requestId);
        this.emitirCambioContador();
        this.cdr.markForCheck();
      });

    this.subscriptions.add(rejectSub);
  }

  getAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }

  private cargarSolicitudes(): void {
    this.cargando = true;
    this.cdr.markForCheck();

    const loadSub = this.userSocialService.getPendingFollowRequests()
      .pipe(
        catchError(error => {
          console.error('Error al cargar solicitudes de seguimiento:', error);
          this.cargando = false;
          this.cdr.markForCheck();
          return EMPTY;
        })
      )
      .subscribe(solicitudes => {
        this.followRequests = solicitudes;
        this.cargando = false;
        this.emitirCambioContador();
        this.cdr.markForCheck();
      });

    this.subscriptions.add(loadSub);
  }

  private setupSocketListener(): void {
    const socketSub = this.socketService.newFollowRequest$
      .pipe(
        catchError(error => {
          console.error('Error en socket de solicitudes:', error);
          return EMPTY;
        })
      )
      .subscribe(request => {
        if (request) {
          const existingIndex = this.followRequests.findIndex(r => r._id === request.requestId);

          if (existingIndex === -1) {
            this.followRequests.unshift({
              _id: request.requestId,
              requester: request.requester,
              createdAt: request.timestamp
            });

            this.emitirCambioContador();
            this.cdr.markForCheck();
          }
        }
      });

    this.subscriptions.add(socketSub);
  }

  private emitirCambioContador(): void {
    const event = new CustomEvent('updateNotificationCount', {
      detail: { count: this.followRequests.length }
    });
    window.dispatchEvent(event);
  }
}