import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UserSocialService } from '../../services/social.service';
import { SocketService } from '../../services/socket.service';
import { ChatService } from '../../services/chat.service'; 
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { switchMap, filter, startWith } from 'rxjs/operators';
import { PremiumService } from '../../services/premium.service';


@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css'
})
export class HeaderComponent implements OnInit, OnDestroy {
  searchForm: FormGroup;
  pendingRequestsCount: number = 0;
  unreadMessagesCount: number = 0;
  isPremiumUser: boolean = false;
  isMenuOpen: boolean = false;
  isMobileView: boolean = false;

  private socketSubscription?: Subscription;
  private premiumSubscription?: Subscription;
  private socialCheckSubscription?: Subscription;
  private authStatusSubscription?: Subscription;
  private chatSubscription?: Subscription; 

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private userSocialService: UserSocialService,
    private socketService: SocketService,
    private premiumService: PremiumService,
    private chatService: ChatService 
  ) {
    this.searchForm = this.fb.group({
      query: ['', [Validators.minLength(2)]]
    });

    this.checkScreenSize();
  }

  @HostListener('window:resize', ['$event'])
  onResize() {
    this.checkScreenSize();
  }

  checkScreenSize() {
    this.isMobileView = window.innerWidth < 992;
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  ngOnInit() {
    // Comprobar estado de autenticación y luego configurar todo
    this.authStatusSubscription = this.authService.currentUser
      .pipe(
        // Solo realizar operaciones cuando hay un usuario autenticado
        filter(user => !!user)
      )
      .subscribe(() => {
        this.setupPremiumCheck();
        this.cargarSolicitudesPendientes();
        this.setupSocketListeners();
        this.loadUnreadMessagesCount(); 
      });
  }

  setupPremiumCheck() {
    //suscribirse directamente al estado premium 
    this.premiumSubscription = this.premiumService.premiumStatus$
      .pipe(
        // Filtrar valores nulos
        filter(status => !!status)
      )
      .subscribe({
        next: (status) => {
          // Solo loguear si realmente cambia el valor
          if (this.isPremiumUser !== status.isPremium) {
            console.log('Estado premium actualizado:', status);
          }
          this.isPremiumUser = status.isPremium;
        },
        error: (error) => {
          console.error('Error al verificar estado premium:', error);
          this.isPremiumUser = false;
        }
      });
      
    // Iniciar verificación de estado premium
    this.premiumService.getPremiumStatus().subscribe();
    
    // Configurar verificación periódica cada 5 minutos
    this.socialCheckSubscription = interval(5 * 60 * 1000)
      .subscribe(() => {
        if (this.isAuthenticated()) {
          this.premiumService.getPremiumStatus(true).subscribe();
        }
      });
  }

  setupSocketListeners() {
    // Suscribirse a nuevas solicitudes de seguimiento
    this.socketSubscription = this.socketService.newFollowRequest$.subscribe(
      request => {
        if (request) {
          this.pendingRequestsCount++;
          this.mostrarIndicadorNuevaNotificacion();
        }
      }
    );

    // Suscribirse a nuevos mensajes de chat
    const newMessageSub = this.socketService.newMessage$.subscribe(
      message => {
        if (message) {
          this.unreadMessagesCount++;
          this.mostrarIndicadorNuevoMensaje();
        }
      }
    );
    

    if (this.socketSubscription) {
      this.socketSubscription.add(newMessageSub);
    } else {
      this.socketSubscription = newMessageSub;
    }
  }

  loadUnreadMessagesCount(): void {
    this.chatSubscription = this.chatService.getUserChats(1, 50).subscribe({
      next: (response) => {
        this.unreadMessagesCount = response.chats.reduce((total, chat) => total + chat.unreadCount, 0);
      },
      error: (error) => {
        console.error('Error al cargar contador de mensajes no leídos:', error);
      }
    });
  }

  
  mostrarIndicadorNuevoMensaje(): void {
    const messageBadge = document.querySelector('.message-badge');
    if (messageBadge) {
      messageBadge.classList.add('pulse-animation');
      setTimeout(() => {
        messageBadge.classList.remove('pulse-animation');
      }, 2000);
    }
  }

  ngOnDestroy() {
    if (this.socketSubscription) {
      this.socketSubscription.unsubscribe();
    }
    if (this.premiumSubscription) {
      this.premiumSubscription.unsubscribe();
    }
    if (this.socialCheckSubscription) {
      this.socialCheckSubscription.unsubscribe();
    }
    if (this.authStatusSubscription) {
      this.authStatusSubscription.unsubscribe();
    }
    if (this.chatSubscription) { 
      this.chatSubscription.unsubscribe();
    }
  }

  cargarSolicitudesPendientes(): void {
    // Verificar solicitudes al iniciar y cada minuto
    this.socialCheckSubscription = interval(60000).pipe(
      startWith(0),
      switchMap(() => {
        if (this.isAuthenticated()) {
          return this.userSocialService.getPendingFollowRequests();
        }
        return [];
      })
    ).subscribe({
      next: (solicitudes) => {
        this.pendingRequestsCount = solicitudes.length;
      },
      error: (error) => {
        console.error('Error al verificar solicitudes pendientes:', error);
      }
    });
  }

  mostrarIndicadorNuevaNotificacion() {
    const notifyBadge = document.querySelector('.notify-badge');
    if (notifyBadge) {
      notifyBadge.classList.add('pulse-animation');
      setTimeout(() => {
        notifyBadge.classList.remove('pulse-animation');
      }, 2000);
    }
  }

  buscar(): void {
    if (this.searchForm.valid && this.searchForm.value.query?.trim()) {
      this.router.navigate(['/buscador-peliculas'], {
        queryParams: { query: this.searchForm.value.query }
      });
      this.searchForm.reset();

      // Cerrar menú móvil si está abierto
      if (this.isMenuOpen && this.isMobileView) {
        this.isMenuOpen = false;
      }
    }
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  getUserAvatarPath(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const avatar = user.avatar || 'avatar1';
    return `/avatares/${avatar}.gif`;
  }

  getUsername(): string {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.username || 'Usuario';
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateTo(route: string) {
    this.router.navigate([route]);

    // Reset unread messages count when navigating to chat
    if (route === '/chat') {
      this.unreadMessagesCount = 0;
    }

    // Cerrar menú móvil si está abierto
    if (this.isMenuOpen && this.isMobileView) {
      this.isMenuOpen = false;
    }
  }
}