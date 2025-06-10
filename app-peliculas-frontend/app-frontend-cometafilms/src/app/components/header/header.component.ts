// header.component.ts - VERSIÓN CORREGIDA

import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable, Subscription, interval, EMPTY } from 'rxjs';
import { switchMap, filter, startWith, catchError, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { UserSocialService } from '../../services/social.service';
import { SocketService } from '../../services/socket.service';
import { ChatService } from '../../services/chat.service';
import { PremiumService } from '../../services/premium.service';

interface NotificationCounts {
  pendingRequests: number;
  unreadMessages: number;
  systemNotifications: number;
}

interface BannerState {
  showNotificationBanner: boolean;
  showMessageBanner: boolean;
  showSystemBanner: boolean;
  bannerFadingOut: boolean;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent implements OnInit, OnDestroy {

  readonly searchForm: FormGroup;

  // Estados
  notificationCounts: NotificationCounts = {
    pendingRequests: 0,
    unreadMessages: 0,
    systemNotifications: 0
  };

  bannerState: BannerState = {
    showNotificationBanner: true,
    showMessageBanner: true,
    showSystemBanner: true,
    bannerFadingOut: false
  };

  isPremiumUser = false;
  premiumStatusLoaded = false;
  isMenuOpen = false;
  isMobileView = false;

  // Constantes
  private readonly AUTO_HIDE_DELAY = 8000; // Más tiempo para leer
  private readonly ANIMATION_DURATION = 300;
  private readonly MOBILE_BREAKPOINT = 992;
  private readonly POLL_INTERVAL = 5 * 60 * 1000;
  private readonly NOTIFICATION_CHECK_INTERVAL = 30000; // Cada 30 segundos

  // Timeouts
  private notificationTimeout?: NodeJS.Timeout;
  private messageTimeout?: NodeJS.Timeout;
  private systemTimeout?: NodeJS.Timeout;

  // Subscriptions
  private readonly subscriptions = new Subscription();

  // Eventos
  private updateCounterListener?: (event: CustomEvent) => void;

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly authService: AuthService,
    private readonly userSocialService: UserSocialService,
    private readonly socketService: SocketService,
    private readonly premiumService: PremiumService,
    private readonly chatService: ChatService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.searchForm = this.createSearchForm();
    this.checkScreenSize();
    this.initializePremiumStateFromStorage();
  }

  @HostListener('window:resize', ['$event'])
  onResize(): void {
    this.checkScreenSize();
  }

  ngOnInit(): void {
    this.setupAuthenticationSubscription();
    this.setupRouterSubscription();
    this.setupCustomEventListener();
    
    // 🔧 Escuchar cambios en localStorage para notificaciones
    this.setupStorageListener();
  }

  ngOnDestroy(): void {
    this.clearAllTimeouts();
    this.subscriptions.unsubscribe();
    this.removeCustomEventListener();
  }

  // 🆕 SETUP STORAGE LISTENER PARA NOTIFICACIONES
  private setupStorageListener(): void {
    window.addEventListener('storage', (event) => {
      if (event.key === 'systemNotifications') {
        console.log('📱 Header: Cambio detectado en systemNotifications localStorage');
        this.loadSystemNotificationsCount();
      }
    });

    // También escuchar eventos personalizados
    window.addEventListener('systemNotificationsUpdated', () => {
      console.log('📱 Header: Evento systemNotificationsUpdated recibido');
      this.loadSystemNotificationsCount();
    });
  }

  // Public methods
  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  buscar(): void {
    if (this.searchForm.valid && this.searchForm.value.query?.trim()) {
      this.router.navigate(['/buscador-peliculas'], {
        queryParams: { query: this.searchForm.value.query }
      });
      this.searchForm.reset();
      this.closeMenuIfMobile();
    }
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  getUserAvatarPath(): string {
    const user = this.getUserFromStorage();
    const avatar = user?.avatar || 'avatar1';
    return `/avatares/${avatar}.gif`;
  }

  getUsername(): string {
    const user = this.getUserFromStorage();
    return user?.username || 'Usuario';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    this.handleRouteNavigation(route);
    this.closeMenuIfMobile();
  }

  shouldShowPremiumButton(): boolean {
    return this.premiumStatusLoaded && !this.isPremiumUser;
  }

  shouldShowNotificationBanner(): boolean {
    return (this.notificationCounts.pendingRequests > 0 && this.bannerState.showNotificationBanner) ||
      (this.notificationCounts.unreadMessages > 0 && this.bannerState.showMessageBanner) ||
      (this.notificationCounts.systemNotifications > 0 && this.bannerState.showSystemBanner);
  }

  shouldShowLogoBadge(): boolean {
    return !this.shouldShowNotificationBanner() && this.getTotalNotificationCount() > 0;
  }

  shouldPulseBadge(): boolean {
    return this.shouldShowLogoBadge();
  }

  getTotalNotificationCount(): number {
    return this.notificationCounts.pendingRequests + 
           this.notificationCounts.unreadMessages + 
           this.notificationCounts.systemNotifications;
  }

  dismissNotificationBanner(event: Event): void {
    event.stopPropagation();
    this.bannerState.showNotificationBanner = false;
    this.clearNotificationTimeout();
    this.cdr.markForCheck();
  }

  dismissMessageBanner(event: Event): void {
    event.stopPropagation();
    this.bannerState.showMessageBanner = false;
    this.clearMessageTimeout();
    this.cdr.markForCheck();
  }

  dismissSystemBanner(event: Event): void {
    event.stopPropagation();
    this.bannerState.showSystemBanner = false;
    this.clearSystemTimeout();
    this.cdr.markForCheck();
  }

  // 🔧 MEJORADO: Al hacer click en el badge del avatar, limpiar contadores
  onAvatarBadgeClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    // 🎯 LIMPIAR INMEDIATAMENTE LOS CONTADORES VISUALES
    const previousTotal = this.getTotalNotificationCount();
    
    // Prioridad: sistema > solicitudes > mensajes
    let route = '/notificaciones';
    
    if (this.notificationCounts.systemNotifications > 0) {
      route = '/notificaciones';
      // Marcar notificaciones del sistema como "vistas"
      this.notificationCounts.systemNotifications = 0;
      this.bannerState.showSystemBanner = false;
    } else if (this.notificationCounts.pendingRequests >= this.notificationCounts.unreadMessages) {
      route = '/notificaciones';
      // Las solicitudes se manejan en el componente de notificaciones
    } else {
      route = '/chat';
      // Los mensajes se manejan en el componente de chat
    }

    // 🎯 FORZAR ACTUALIZACIÓN VISUAL INMEDIATA
    this.clearAllTimeouts();
    this.cdr.markForCheck();

    console.log(`🎯 Avatar badge click: ${previousTotal} -> ${this.getTotalNotificationCount()}, navegando a ${route}`);

    this.navigateTo(route);
  }

  // Getters
  get pendingRequestsCount(): number {
    return this.notificationCounts.pendingRequests;
  }

  get unreadMessagesCount(): number {
    return this.notificationCounts.unreadMessages;
  }

  get systemNotificationsCount(): number {
    return this.notificationCounts.systemNotifications;
  }

  get showNotificationBanner(): boolean {
    return this.bannerState.showNotificationBanner;
  }

  get showMessageBanner(): boolean {
    return this.bannerState.showMessageBanner;
  }

  get showSystemBanner(): boolean {
    return this.bannerState.showSystemBanner;
  }

  get bannerFadingOut(): boolean {
    return this.bannerState.bannerFadingOut;
  }

  // Private methods
  private createSearchForm(): FormGroup {
    return this.fb.group({
      query: ['', [Validators.minLength(2)]]
    });
  }

  private checkScreenSize(): void {
    this.isMobileView = window.innerWidth < this.MOBILE_BREAKPOINT;
  }

  private closeMenuIfMobile(): void {
    if (this.isMenuOpen && this.isMobileView) {
      this.isMenuOpen = false;
    }
  }

  private getUserFromStorage(): any {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      return null;
    }
  }

  private initializePremiumStateFromStorage(): void {
    try {
      const user = this.getUserFromStorage();
      if (user && typeof user.isPremium === 'boolean') {
        this.isPremiumUser = user.isPremium;
        this.premiumStatusLoaded = true;
      }
    } catch (error) {
      console.error('Error initializing premium state from localStorage:', error);
    }
  }

  private setupAuthenticationSubscription(): void {
    const authSub = this.authService.currentUser
      .pipe(
        filter(user => !!user),
        catchError(error => {
          console.error('Error in authentication subscription:', error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        this.setupPremiumCheck();
        this.cargarSolicitudesPendientes();
        this.setupSocketListeners();
        this.loadUnreadMessagesCount();
        this.loadSystemNotificationsCount();
        this.setupPeriodicNotificationCheck();
      });

    this.subscriptions.add(authSub);
  }

  private setupRouterSubscription(): void {
    const routerSub = this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd)
      )
      .subscribe((event) => {
        this.handleRouteChange(event.url);
      });

    this.subscriptions.add(routerSub);
  }

  private setupCustomEventListener(): void {
    this.updateCounterListener = (event: CustomEvent) => {
      this.notificationCounts.pendingRequests = event.detail.count;
      this.cdr.markForCheck();
    };

    window.addEventListener('updateNotificationCount', this.updateCounterListener as EventListener);
  }

  private removeCustomEventListener(): void {
    if (this.updateCounterListener) {
      window.removeEventListener('updateNotificationCount', this.updateCounterListener as EventListener);
    }
  }

  private handleRouteChange(url: string): void {
    if (url === '/notificaciones') {
      this.resetNotificationState();
      this.resetSystemNotificationState();
      
      // 🔧 Dar tiempo para que el componente procese las notificaciones
      setTimeout(() => {
        this.loadSystemNotificationsCount();
      }, 1000);
    } else if (url === '/chat') {
      this.resetMessageState();
    }
  }

  private handleRouteNavigation(route: string): void {
    if (route === '/chat') {
      this.resetMessageState();
    } else if (route === '/notificaciones') {
      this.resetNotificationState();
      this.resetSystemNotificationState();
      
      // 🔧 Actualizar después de navegar
      setTimeout(() => {
        this.loadSystemNotificationsCount();
      }, 1500);
    }
  }

  private resetNotificationState(): void {
    this.notificationCounts.pendingRequests = 0;
    this.bannerState.showNotificationBanner = false;
    this.clearNotificationTimeout();
    this.cdr.markForCheck();
  }

  private resetMessageState(): void {
    this.notificationCounts.unreadMessages = 0;
    this.bannerState.showMessageBanner = false;
    this.clearMessageTimeout();
    this.cdr.markForCheck();
  }

  private resetSystemNotificationState(): void {
    this.notificationCounts.systemNotifications = 0;
    this.bannerState.showSystemBanner = false;
    this.clearSystemTimeout();
    this.cdr.markForCheck();
  }

  private setupPremiumCheck(): void {
    const premiumSub = this.premiumService.premiumStatus$
      .pipe(
        filter(status => !!status),
        distinctUntilChanged((prev, curr) => prev?.isPremium === curr?.isPremium),
        catchError(error => {
          console.error('Error in premium status subscription:', error);
          this.isPremiumUser = false;
          this.premiumStatusLoaded = true;
          this.cdr.markForCheck();
          return EMPTY;
        })
      )
      .subscribe(status => {
        this.isPremiumUser = status.isPremium;
        this.premiumStatusLoaded = true;
        this.cdr.markForCheck();
      });

    this.subscriptions.add(premiumSub);

    const initialCheck = this.premiumService.getPremiumStatus()
      .pipe(
        catchError(error => {
          console.error('Error in initial premium check:', error);
          this.premiumStatusLoaded = true;
          this.cdr.markForCheck();
          return EMPTY;
        })
      )
      .subscribe();

    this.subscriptions.add(initialCheck);

    const periodicCheck = interval(this.POLL_INTERVAL)
      .pipe(
        switchMap(() => {
          if (this.isAuthenticated()) {
            return this.premiumService.getPremiumStatus(true);
          }
          return EMPTY;
        }),
        catchError(error => {
          console.error('Error in periodic premium check:', error);
          return EMPTY;
        })
      )
      .subscribe();

    this.subscriptions.add(periodicCheck);
  }

  private setupSocketListeners(): void {
    // Solicitudes de seguimiento
    const followRequestSub = this.socketService.newFollowRequest$
      .pipe(
        filter(request => !!request),
        catchError(error => {
          console.error('Error in follow request subscription:', error);
          return EMPTY;
        })
      )
      .subscribe(request => {
        this.notificationCounts.pendingRequests++;
        this.bannerState.showNotificationBanner = true;
        this.resetNotificationTimeout();
        this.mostrarIndicadorNuevaNotificacion();
        this.cdr.markForCheck();
      });

    this.subscriptions.add(followRequestSub);

    // Nuevos mensajes
    const newMessageSub = this.socketService.newMessage$
      .pipe(
        filter(message => !!message),
        catchError(error => {
          console.error('Error in new message subscription:', error);
          return EMPTY;
        })
      )
      .subscribe(message => {
        this.notificationCounts.unreadMessages++;
        this.bannerState.showMessageBanner = true;
        this.resetMessageTimeout();
        this.mostrarIndicadorNuevoMensaje();
        this.cdr.markForCheck();
      });

    this.subscriptions.add(newMessageSub);

    // 🔧 MEJORADO: Notificaciones del sistema
    const systemNotificationSub = this.socketService.systemNotification$
      .pipe(
        filter(notification => !!notification),
        catchError(error => {
          console.error('Error in system notification subscription:', error);
          return EMPTY;
        })
      )
      .subscribe(notification => {
        console.log('📱 Header: Nueva notificación del sistema recibida:', notification);
        
        // 🎯 INCREMENTAR CONTADOR INMEDIATAMENTE
        this.notificationCounts.systemNotifications++;
        this.bannerState.showSystemBanner = true;
        this.resetSystemTimeout();
        
        // 🎯 MOSTRAR INDICADORES VISUALES
        this.mostrarIndicadorNuevaNotificacionSistema(notification);
        
        // 🎯 FORZAR ACTUALIZACIÓN
        this.cdr.markForCheck();
        
        console.log(`📱 Header: Contador actualizado a ${this.notificationCounts.systemNotifications}`);
      });

    this.subscriptions.add(systemNotificationSub);
  }

  private loadUnreadMessagesCount(): void {
    const messageCountSub = this.chatService.getUserChats(1, 50)
      .pipe(
        catchError(error => {
          console.error('Error loading unread messages count:', error);
          return EMPTY;
        })
      )
      .subscribe(response => {
        this.notificationCounts.unreadMessages = response.chats.reduce(
          (total, chat) => total + chat.unreadCount,
          0
        );
        this.cdr.markForCheck();
      });

    this.subscriptions.add(messageCountSub);
  }

  // 🔧 MEJORADO: Cargar contador de notificaciones del sistema
  private loadSystemNotificationsCount(): void {
    try {
      const stored = localStorage.getItem('systemNotifications');
      if (stored) {
        const notifications = JSON.parse(stored);
        const unreadCount = notifications.filter((n: any) => !n.read).length;
        
        const previousCount = this.notificationCounts.systemNotifications;
        
        // Solo actualizar si hay cambios reales
        if (previousCount !== unreadCount) {
          this.notificationCounts.systemNotifications = unreadCount;
          console.log(`📱 Header: Contador de sistema actualizado: ${previousCount} -> ${unreadCount}`);
          this.cdr.markForCheck();
        }
      } else {
        // Si no hay notificaciones almacenadas, el contador debería ser 0
        if (this.notificationCounts.systemNotifications !== 0) {
          this.notificationCounts.systemNotifications = 0;
          console.log('📱 Header: Contador de sistema reseteado a 0');
          this.cdr.markForCheck();
        }
      }
    } catch (error) {
      console.error('❌ Error cargando contador de notificaciones del sistema:', error);
      this.notificationCounts.systemNotifications = 0;
      this.cdr.markForCheck();
    }
  }

  // 🔧 MEJORADO: Chequeo periódico más inteligente
  private setupPeriodicNotificationCheck(): void {
    // Verificar notificaciones del sistema cada 30 segundos
    const systemNotificationCheck = interval(this.NOTIFICATION_CHECK_INTERVAL)
      .pipe(
        startWith(0),
        catchError(error => {
          console.error('Error in periodic system notification check:', error);
          return EMPTY;
        })
      )
      .subscribe(() => {
        if (this.isAuthenticated()) {
          this.loadSystemNotificationsCount();
        }
      });

    this.subscriptions.add(systemNotificationCheck);
  }

  private cargarSolicitudesPendientes(): void {
    const pendingRequestsSub = interval(this.NOTIFICATION_CHECK_INTERVAL)
      .pipe(
        startWith(0),
        switchMap(() => {
          if (this.isAuthenticated()) {
            return this.userSocialService.getPendingFollowRequests();
          }
          return EMPTY;
        }),
        catchError(error => {
          console.error('Error loading pending requests:', error);
          return EMPTY;
        })
      )
      .subscribe(solicitudes => {
        const previousCount = this.notificationCounts.pendingRequests;
        this.notificationCounts.pendingRequests = solicitudes.length;

        if (solicitudes.length > previousCount && solicitudes.length > 0) {
          this.bannerState.showNotificationBanner = true;
          this.resetNotificationTimeout();
        }

        this.cdr.markForCheck();
      });

    this.subscriptions.add(pendingRequestsSub);
  }

  private mostrarIndicadorNuevaNotificacion(): void {
    this.addPulseAnimation('.notify-badge');
    this.addPulseAnimation('.avatar-notification-badge');
  }

  private mostrarIndicadorNuevoMensaje(): void {
    this.addPulseAnimation('.notify-badge');
    this.addPulseAnimation('.avatar-notification-badge');
  }

  // 🔧 MEJORADO: Indicador para notificaciones del sistema
  private mostrarIndicadorNuevaNotificacionSistema(notification: any): void {
    // Animar badges
    this.addPulseAnimation('.avatar-notification-badge');
    this.addPulseAnimation('.notify-badge');
    
    // Mostrar notificación del navegador si está permitido
    if ('Notification' in window && Notification.permission === 'granted') {
      const title = notification.data?.title || 'Nueva notificación del sistema';
      const body = notification.data?.message || '';
      
      // 🎯 Personalizar según el tipo de notificación
      let icon = '/favicon.ico';
      let finalTitle = title;
      
      if (notification.data?.notificationType?.includes('report')) {
        finalTitle = `🛡️ ${title}`;
        if (notification.data?.severity === 'error') {
          finalTitle = `🚫 ${title}`;
        } else if (notification.data?.severity === 'warning') {
          finalTitle = `⚠️ ${title}`;
        } else if (notification.data?.severity === 'success') {
          finalTitle = `✅ ${title}`;
        }
      }
      
      new Notification(finalTitle, {
        body,
        icon,
        badge: icon,
        tag: `system-notification-${notification.id}`,
        requireInteraction: notification.data?.severity === 'error' // Para errores críticos
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      // Solicitar permisos si no están concedidos
      Notification.requestPermission();
    }
  }

  private addPulseAnimation(selector: string): void {
    const element = document.querySelector(selector);
    if (element) {
      element.classList.add('pulse-animation');
      setTimeout(() => {
        element.classList.remove('pulse-animation');
      }, 2000);
    }
  }

  private resetNotificationTimeout(): void {
    this.clearNotificationTimeout();
    this.notificationTimeout = setTimeout(() => {
      this.hideNotificationBannerWithAnimation();
    }, this.AUTO_HIDE_DELAY);
  }

  private resetMessageTimeout(): void {
    this.clearMessageTimeout();
    this.messageTimeout = setTimeout(() => {
      this.hideMessageBannerWithAnimation();
    }, this.AUTO_HIDE_DELAY);
  }

  private resetSystemTimeout(): void {
    this.clearSystemTimeout();
    this.systemTimeout = setTimeout(() => {
      this.hideSystemBannerWithAnimation();
    }, this.AUTO_HIDE_DELAY);
  }

  private clearNotificationTimeout(): void {
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
      this.notificationTimeout = undefined;
    }
  }

  private clearMessageTimeout(): void {
    if (this.messageTimeout) {
      clearTimeout(this.messageTimeout);
      this.messageTimeout = undefined;
    }
  }

  private clearSystemTimeout(): void {
    if (this.systemTimeout) {
      clearTimeout(this.systemTimeout);
      this.systemTimeout = undefined;
    }
  }

  private clearAllTimeouts(): void {
    this.clearNotificationTimeout();
    this.clearMessageTimeout();
    this.clearSystemTimeout();
  }

  private hideNotificationBannerWithAnimation(): void {
    this.bannerState.bannerFadingOut = true;
    this.cdr.markForCheck();

    setTimeout(() => {
      this.bannerState.showNotificationBanner = false;
      this.bannerState.bannerFadingOut = false;
      this.cdr.markForCheck();
    }, this.ANIMATION_DURATION);
  }

  private hideMessageBannerWithAnimation(): void {
    this.bannerState.bannerFadingOut = true;
    this.cdr.markForCheck();

    setTimeout(() => {
      this.bannerState.showMessageBanner = false;
      this.bannerState.bannerFadingOut = false;
      this.cdr.markForCheck();
    }, this.ANIMATION_DURATION);
  }

  private hideSystemBannerWithAnimation(): void {
    this.bannerState.bannerFadingOut = true;
    this.cdr.markForCheck();

    setTimeout(() => {
      this.bannerState.showSystemBanner = false;
      this.bannerState.bannerFadingOut = false;
      this.cdr.markForCheck();
    }, this.ANIMATION_DURATION);
  }
}