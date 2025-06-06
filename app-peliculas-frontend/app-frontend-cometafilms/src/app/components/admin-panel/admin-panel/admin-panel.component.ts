import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import {
  AdminService,
  AdminUser,
  AdminReview,
  AdminComment,
  AdminList,
  SystemStats,
  UserPermissions,
  PermissionsResponse
} from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';

interface TabState {
  activeTab: string;
  activeContentTab: string;
}

interface PaginationState {
  users: { page: number; total: number; hasMore: boolean };
  reviews: { page: number; total: number; hasMore: boolean };
  comments: { page: number; total: number; hasMore: boolean };
  lists: { page: number; total: number; hasMore: boolean };
}

interface LoadingState {
  stats: boolean;
  users: boolean;
  reviews: boolean;
  comments: boolean;
  lists: boolean;
  permissions: boolean;
  banning: boolean;
}

interface ErrorState {
  stats: string | null;
  users: string | null;
  reviews: string | null;
  comments: string | null;
  lists: string | null;
  permissions: string | null;
}

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPanelComponent implements OnInit, OnDestroy {

  // Estado de la aplicación
  currentUser: any = null;
  userPermissions: UserPermissions | null = null;

  // Estados de UI
  tabState: TabState = {
    activeTab: 'dashboard',
    activeContentTab: 'reviews'
  };

  loading: LoadingState = {
    stats: false,
    users: false,
    reviews: false,
    comments: false,
    lists: false,
    permissions: false,
    banning: false
  };

  errors: ErrorState = {
    stats: null,
    users: null,
    reviews: null,
    comments: null,
    lists: null,
    permissions: null
  };

  pagination: PaginationState = {
    users: { page: 1, total: 0, hasMore: false },
    reviews: { page: 1, total: 0, hasMore: false },
    comments: { page: 1, total: 0, hasMore: false },
    lists: { page: 1, total: 0, hasMore: false }
  };

  // Datos
  stats: SystemStats | null = null;
  users: AdminUser[] = [];
  reviews: AdminReview[] = [];
  comments: AdminComment[] = [];
  lists: AdminList[] = [];

  // Formularios de búsqueda y filtros
  userSearchForm!: FormGroup;

  // Modales
  showBanModal = false;
  showRoleModal = false;
  showDeleteModal = false;

  // Estado del modal actual
  modalData: {
    userId?: string;
    username?: string;
    currentRole?: string;
    itemId?: string;
    itemType?: string;
    itemTitle?: string;
  } = {};

  // Formularios de modal
  banForm!: FormGroup;
  roleForm!: FormGroup;
  deleteForm!: FormGroup;

  private subscriptions = new Subscription();

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.createForms();
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // ===== INICIALIZACIÓN =====

  private createForms(): void {
    // Formulario de búsqueda de usuarios
    this.userSearchForm = this.fb.group({
      search: [''],
      role: [''],
      status: ['']
    });

    // Formulario de ban
    this.banForm = this.fb.group({
      reason: ['', [Validators.required, Validators.minLength(10)]],
      duration: [''] // Vacío = permanente
    });

    // Formulario de cambio de rol
    this.roleForm = this.fb.group({
      newRole: ['', Validators.required],
      reason: ['']
    });

    // Formulario de eliminación
    this.deleteForm = this.fb.group({
      reason: ['']
    });
  }

  private initializeComponent(): void {
    this.currentUser = this.getCurrentUser();
    this.loadUserPermissions();
    this.loadDashboard();
    this.loadUsers();
    this.setupSearchSubscription();
  }

  private setupSubscriptions(): void {
    // Suscribirse a cambios de datos para refrescar
    const refreshSub = this.adminService.refreshData$.subscribe(dataType => {
      if (dataType) {
        this.handleDataRefresh(dataType);
      }
    });

    this.subscriptions.add(refreshSub);
  }

  private setupSearchSubscription(): void {
    const searchSub = this.userSearchForm.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.resetUsersPagination();
        this.loadUsers();
      });

    this.subscriptions.add(searchSub);
  }

  private handleDataRefresh(dataType: string): void {
    switch (dataType) {
      case 'users':
        this.loadUsers();
        this.loadDashboard();
        break;
      case 'reviews':
        this.loadReviews();
        break;
      case 'comments':
        this.loadComments();
        break;
      case 'lists':
        this.loadLists();
        break;
    }
  }

  // ===== CARGA DE DATOS CON OBSERVABLES =====

  private loadUserPermissions(): void {
    this.loading.permissions = true;
    this.errors.permissions = null;

    const permissionsSub = this.adminService.getUserPermissions().subscribe({
      next: (response) => {
        this.userPermissions = response?.permissions || null;
        console.log('Permisos cargados:', this.userPermissions);
      },
      error: (error: any) => {
        this.errors.permissions = error.message;
        console.error('Error cargando permisos:', error);
      },
      complete: () => {
        this.loading.permissions = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.add(permissionsSub);
  }

  loadDashboard(): void {
    this.loading.stats = true;
    this.errors.stats = null;

    const statsSub = this.adminService.getSystemStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        console.log('Estadísticas cargadas:', this.stats);
      },
      error: (error: any) => {
        this.errors.stats = error.message;
        console.error('Error cargando estadísticas:', error);
      },
      complete: () => {
        this.loading.stats = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.add(statsSub);
  }

  loadUsers(page: number = 1): void {
    if (this.loading.users && page !== 1) return;

    this.loading.users = true;
    this.errors.users = null;

    const formValue = this.userSearchForm.value;
    const filters: any = { page, limit: 20 };

    // Aplicar filtros del formulario
    if (formValue.search?.trim()) {
      filters.search = formValue.search.trim();
    }
    if (formValue.role) {
      filters.role = formValue.role;
    }
    if (formValue.status === 'banned') {
      filters.banned = true;
    } else if (formValue.status === 'active') {
      filters.banned = false;
    }

    console.log('Cargando usuarios con filtros:', filters);

    const usersSub = this.adminService.getUsers(filters).subscribe({
      next: (response) => {
        if (response) {
          this.users = page === 1 ? (response.users || []) : [...this.users, ...(response.users || [])];

          this.pagination.users = {
            page: response.pagination.page,
            total: response.pagination.total,
            hasMore: response.pagination.hasMore
          };

          console.log(`Usuarios cargados: ${this.users.length} total, página ${page}`);
        }
      },
      error: (error: any) => {
        this.errors.users = error.message;
        console.error('Error cargando usuarios:', error);
      },
      complete: () => {
        this.loading.users = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.add(usersSub);
  }

  loadReviews(page: number = 1): void {
    if (this.loading.reviews && page !== 1) return;

    this.loading.reviews = true;
    this.errors.reviews = null;

    const reviewsSub = this.adminService.getReviews({ page, limit: 20 }).subscribe({
      next: (response) => {
        if (response) {
          this.reviews = page === 1 ? (response.reviews || []) : [...this.reviews, ...(response.reviews || [])];
          this.pagination.reviews = {
            page: response.pagination.page,
            total: response.pagination.total,
            hasMore: response.pagination.hasMore
          };
          console.log(`Reseñas cargadas: ${this.reviews.length} total`);
        }
      },
      error: (error: any) => {
        this.errors.reviews = error.message;
        console.error('Error cargando reseñas:', error);
      },
      complete: () => {
        this.loading.reviews = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.add(reviewsSub);
  }

  loadComments(page: number = 1): void {
    if (this.loading.comments && page !== 1) return;

    this.loading.comments = true;
    this.errors.comments = null;

    const commentsSub = this.adminService.getComments({ page, limit: 20 }).subscribe({
      next: (response) => {
        if (response) {
          this.comments = page === 1 ? (response.comments || []) : [...this.comments, ...(response.comments || [])];
          this.pagination.comments = {
            page: response.pagination.page,
            total: response.pagination.total,
            hasMore: response.pagination.hasMore
          };
          console.log(`Comentarios cargados: ${this.comments.length} total`);
        }
      },
      error: (error: any) => {
        this.errors.comments = error.message;
        console.error('Error cargando comentarios:', error);
      },
      complete: () => {
        this.loading.comments = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.add(commentsSub);
  }

  loadLists(page: number = 1): void {
    if (this.loading.lists && page !== 1) return;

    this.loading.lists = true;
    this.errors.lists = null;

    const listsSub = this.adminService.getLists({ page, limit: 20 }).subscribe({
      next: (response) => {
        if (response) {
          this.lists = page === 1 ? (response.lists || []) : [...this.lists, ...(response.lists || [])];
          this.pagination.lists = {
            page: response.pagination.page,
            total: response.pagination.total,
            hasMore: response.pagination.hasMore
          };
          console.log(`Listas cargadas: ${this.lists.length} total`);
        }
      },
      error: (error: any) => {
        this.errors.lists = error.message;
        console.error('Error cargando listas:', error);
      },
      complete: () => {
        this.loading.lists = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.add(listsSub);
  }

  // ===== NAVEGACIÓN DE TABS =====

  showTab(tabName: string): void {
    this.tabState.activeTab = tabName;

    switch (tabName) {
      case 'users':
        if (this.users.length === 0) this.loadUsers();
        break;
      case 'content':
        if (this.reviews.length === 0) this.loadReviews();
        break;
    }

    this.cdr.markForCheck();
  }

  showContentTab(contentType: string): void {
    this.tabState.activeContentTab = contentType;

    switch (contentType) {
      case 'reviews':
        if (this.reviews.length === 0) this.loadReviews();
        break;
      case 'comments':
        if (this.comments.length === 0) this.loadComments();
        break;
      case 'lists':
        if (this.lists.length === 0) this.loadLists();
        break;
    }

    this.cdr.markForCheck();
  }

  // ===== GESTIÓN DE MODALES =====

  openBanModal(user: AdminUser): void {
    this.modalData = {
      userId: user._id,
      username: user.username
    };
    this.banForm.reset();
    this.showBanModal = true;
    this.cdr.markForCheck();
    console.log('Abriendo modal de ban para:', user.username);
  }

  openRoleModal(user: AdminUser): void {
    this.modalData = {
      userId: user._id,
      username: user.username,
      currentRole: user.role
    };
    this.roleForm.patchValue({ newRole: '', reason: '' });
    this.showRoleModal = true;
    this.cdr.markForCheck();
    console.log('Abriendo modal de rol para:', user.username);
  }

  openDeleteModal(itemType: string, itemId: string, itemTitle: string): void {
    this.modalData = {
      itemId,
      itemType,
      itemTitle
    };
    this.deleteForm.reset();
    this.showDeleteModal = true;
    this.cdr.markForCheck();
    console.log('Abriendo modal de eliminación para:', itemType, itemTitle);
  }

  closeModals(): void {
    this.showBanModal = false;
    this.showRoleModal = false;
    this.showDeleteModal = false;
    this.modalData = {};
    this.cdr.markForCheck();
  }

  // ===== ACCIONES DE BAN CON OBSERVABLES =====

  banUser(): void {
    if (this.banForm.invalid || !this.modalData.userId) {
      console.log('Formulario de ban inválido o falta userId');
      return;
    }

    this.loading.banning = true;

    const formValue = this.banForm.value;
    const duration = formValue.duration ? parseInt(formValue.duration) : undefined;

    console.log('Baneando usuario:', {
      userId: this.modalData.userId,
      username: this.modalData.username,
      reason: formValue.reason,
      duration: duration
    });

    const banSub = this.adminService.banUser(
      this.modalData.userId,
      formValue.reason,
      duration
    ).subscribe({
      next: (response) => {
        this.closeModals();
        console.log(`Usuario ${this.modalData.username} baneado correctamente`, response);

        // Refrescar lista de usuarios
        this.resetUsersPagination();
        this.loadUsers();
      },
      error: (error: any) => {
        console.error('Error baneando usuario:', error);
        alert(`Error al banear usuario: ${error.message}`);
      },
      complete: () => {
        this.loading.banning = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.add(banSub);
  }

  unbanUser(user: AdminUser): void {
    console.log('Desbaneando usuario:', user.username);

    const unbanSub = this.adminService.unbanUser(user._id, 'Desbaneado desde panel de admin').subscribe({
      next: (response) => {
        console.log(`Usuario ${user.username} desbaneado correctamente`, response);

        // Refrescar lista de usuarios
        this.resetUsersPagination();
        this.loadUsers();
      },
      error: (error: any) => {
        console.error('Error desbaneando usuario:', error);
        alert(`Error al desbanear usuario: ${error.message}`);
      }
    });

    this.subscriptions.add(unbanSub);
  }

  changeUserRole(): void {
    if (this.roleForm.invalid || !this.modalData.userId) return;

    const formValue = this.roleForm.value;

    console.log('Cambiando rol de usuario:', {
      userId: this.modalData.userId,
      username: this.modalData.username,
      newRole: formValue.newRole,
      reason: formValue.reason
    });

    const roleSub = this.adminService.changeUserRole(
      this.modalData.userId,
      formValue.newRole,
      formValue.reason
    ).subscribe({
      next: (response) => {
        this.closeModals();
        console.log(`Rol de ${this.modalData.username} cambiado correctamente`, response);

        // Refrescar lista de usuarios
        this.resetUsersPagination();
        this.loadUsers();
      },
      error: (error: any) => {
        console.error('Error cambiando rol:', error);
        alert(`Error al cambiar rol: ${error.message}`);
      }
    });

    this.subscriptions.add(roleSub);
  }

  // ===== ACCIONES DE CONTENIDO =====

  deleteContent(): void {
    if (!this.modalData.itemId || !this.modalData.itemType) return;

    const reason = this.deleteForm.value.reason || 'Eliminado por moderación';

    console.log('Eliminando contenido:', {
      type: this.modalData.itemType,
      id: this.modalData.itemId,
      reason: reason
    });

    let deleteObservable;

    switch (this.modalData.itemType) {
      case 'review':
        deleteObservable = this.adminService.deleteReview(this.modalData.itemId, reason);
        break;
      case 'comment':
        deleteObservable = this.adminService.deleteComment(this.modalData.itemId, reason);
        break;
      case 'list':
        deleteObservable = this.adminService.deleteList(this.modalData.itemId, reason);
        break;
      default:
        console.error('Tipo de contenido no válido');
        return;
    }

    const deleteSub = deleteObservable.subscribe({
      next: (response) => {
        this.closeModals();
        console.log(`${this.capitalizeFirst(this.modalData.itemType || '')} eliminado correctamente`, response);
      },
      error: (error: any) => {
        console.error('Error eliminando contenido:', error);
        alert(`Error al eliminar contenido: ${error.message}`);
      }
    });

    this.subscriptions.add(deleteSub);
  }

  // ===== PAGINACIÓN =====

  loadMoreUsers(): void {
    if (this.pagination.users.hasMore && !this.loading.users) {
      this.loadUsers(this.pagination.users.page + 1);
    }
  }

  loadMoreReviews(): void {
    if (this.pagination.reviews.hasMore && !this.loading.reviews) {
      this.loadReviews(this.pagination.reviews.page + 1);
    }
  }

  loadMoreComments(): void {
    if (this.pagination.comments.hasMore && !this.loading.comments) {
      this.loadComments(this.pagination.comments.page + 1);
    }
  }

  loadMoreLists(): void {
    if (this.pagination.lists.hasMore && !this.loading.lists) {
      this.loadLists(this.pagination.lists.page + 1);
    }
  }

  private resetUsersPagination(): void {
    this.pagination.users = { page: 1, total: 0, hasMore: false };
    this.users = [];
  }

  // ===== UTILIDADES =====

  private getCurrentUser(): any {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  public capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ===== GETTERS PARA TEMPLATES =====

  get canManageUsers(): boolean {
    return this.userPermissions?.can.manageUsers || this.userPermissions?.can.banUsers || false;
  }

  get canBanUsers(): boolean {
    return this.userPermissions?.can.banUsers || false;
  }

  get canModerateContent(): boolean {
    return this.userPermissions?.can.moderateContent || false;
  }

  get isAdmin(): boolean {
    return this.userPermissions?.role === 'admin';
  }

  get isModerator(): boolean {
    return this.userPermissions?.role === 'moderator' || this.isAdmin;
  }

  // Métodos auxiliares para templates
  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getBadgeRoleClass(role: string): string {
    const roleClasses: { [key: string]: string } = {
      'admin': 'badge-role-admin',
      'moderator': 'badge-role-moderator',
      'premium': 'badge-role-premium',
      'user': 'badge-role-user'
    };
    return roleClasses[role] || 'badge-role-user';
  }

  getUserAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // Método para obtener texto de duración de ban
  getBanDurationText(duration: string): string {
    switch (duration) {
      case '1': return '1 hora';
      case '24': return '24 horas (1 día)';
      case '168': return '7 días (1 semana)';
      case '720': return '30 días (1 mes)';
      case '': return 'Permanente';
      default: return `${duration} horas`;
    }
  }


  // ===== MÉTODOS AUXILIARES PARA TEMPLATES =====



  formatShortDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
  }

  getRoleClass(role: string): string {
    const roleClasses: { [key: string]: string } = {
      'admin': 'badge-admin',
      'moderator': 'badge-moderator',
      'premium': 'badge-premium',
      'user': 'badge-user'
    };
    return roleClasses[role] || 'badge-user';
  }

  getRoleDisplayName(role: string): string {
    const roleNames: { [key: string]: string } = {
      'admin': 'Admin',
      'moderator': 'Mod',
      'premium': 'Premium',
      'user': 'Usuario'
    };
    return roleNames[role] || role;
  }


}