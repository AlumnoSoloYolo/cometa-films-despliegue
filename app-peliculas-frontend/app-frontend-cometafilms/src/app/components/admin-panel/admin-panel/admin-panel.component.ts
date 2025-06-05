
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
    permissions: false
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

  // Formularios de modal - Inicializados correctamente
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
      reason: ['', Validators.required],
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

  private async initializeComponent(): Promise<void> {
    try {
      this.currentUser = this.getCurrentUser();
      await this.loadUserPermissions();
      await this.loadDashboard();
      this.setupSearchSubscription();
    } catch (error) {
      console.error('Error inicializando panel de admin:', error);
      this.router.navigate(['/']);
    }
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
        this.loadUsers();
      });

    this.subscriptions.add(searchSub);
  }

  private handleDataRefresh(dataType: string): void {
    switch (dataType) {
      case 'users':
        this.loadUsers();
        this.loadDashboard(); // Actualizar stats también
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

  // ===== CARGA DE DATOS =====

  private async loadUserPermissions(): Promise<void> {
    this.loading.permissions = true;
    this.errors.permissions = null;

    try {
      const response = await this.adminService.getUserPermissions().toPromise();
      // Extraer solo los permisos de la respuesta completa
      this.userPermissions = response?.permissions || null;
    } catch (error: any) {
      this.errors.permissions = error.message;
      throw error; // Re-lanzar para manejar en initializeComponent
    } finally {
      this.loading.permissions = false;
      this.cdr.markForCheck();
    }
  }

  async loadDashboard(): Promise<void> {
    this.loading.stats = true;
    this.errors.stats = null;

    try {
      this.stats = await this.adminService.getSystemStats().toPromise() || null;
    } catch (error: any) {
      this.errors.stats = error.message;
    } finally {
      this.loading.stats = false;
      this.cdr.markForCheck();
    }
  }

  async loadUsers(page: number = 1): Promise<void> {
    if (this.loading.users) return;

    this.loading.users = true;
    this.errors.users = null;

    try {
      const formValue = this.userSearchForm.value;
      const filters: any = { page, limit: 20 };

      if (formValue.search?.trim()) filters.search = formValue.search.trim();
      if (formValue.role) filters.role = formValue.role;
      if (formValue.status === 'banned') filters.banned = true;
      if (formValue.status === 'active') filters.banned = false;

      const response = await this.adminService.getUsers(filters).toPromise();
      
      if (response) {
        this.users = page === 1 ? (response.users || []) : [...this.users, ...(response.users || [])];
        this.pagination.users = {
          page: response.pagination.page,
          total: response.pagination.total,
          hasMore: response.pagination.hasMore
        };
      }
    } catch (error: any) {
      this.errors.users = error.message;
    } finally {
      this.loading.users = false;
      this.cdr.markForCheck();
    }
  }

  async loadReviews(page: number = 1): Promise<void> {
    if (this.loading.reviews) return;

    this.loading.reviews = true;
    this.errors.reviews = null;

    try {
      const response = await this.adminService.getReviews({ page, limit: 20 }).toPromise();
      
      if (response) {
        this.reviews = page === 1 ? (response.reviews || []) : [...this.reviews, ...(response.reviews || [])];
        this.pagination.reviews = {
          page: response.pagination.page,
          total: response.pagination.total,
          hasMore: response.pagination.hasMore
        };
      }
    } catch (error: any) {
      this.errors.reviews = error.message;
    } finally {
      this.loading.reviews = false;
      this.cdr.markForCheck();
    }
  }

  async loadComments(page: number = 1): Promise<void> {
    if (this.loading.comments) return;

    this.loading.comments = true;
    this.errors.comments = null;

    try {
      const response = await this.adminService.getComments({ page, limit: 20 }).toPromise();
      
      if (response) {
        this.comments = page === 1 ? (response.comments || []) : [...this.comments, ...(response.comments || [])];
        this.pagination.comments = {
          page: response.pagination.page,
          total: response.pagination.total,
          hasMore: response.pagination.hasMore
        };
      }
    } catch (error: any) {
      this.errors.comments = error.message;
    } finally {
      this.loading.comments = false;
      this.cdr.markForCheck();
    }
  }

  async loadLists(page: number = 1): Promise<void> {
    if (this.loading.lists) return;

    this.loading.lists = true;
    this.errors.lists = null;

    try {
      const response = await this.adminService.getLists({ page, limit: 20 }).toPromise();
      
      if (response) {
        this.lists = page === 1 ? (response.lists || []) : [...this.lists, ...(response.lists || [])];
        this.pagination.lists = {
          page: response.pagination.page,
          total: response.pagination.total,
          hasMore: response.pagination.hasMore
        };
      }
    } catch (error: any) {
      this.errors.lists = error.message;
    } finally {
      this.loading.lists = false;
      this.cdr.markForCheck();
    }
  }

  // ===== NAVEGACIÓN DE TABS =====

  showTab(tabName: string): void {
    this.tabState.activeTab = tabName;
    
    // Cargar datos al cambiar de tab
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
    
    // Cargar datos específicos del tipo de contenido
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
  }

  closeModals(): void {
    this.showBanModal = false;
    this.showRoleModal = false;
    this.showDeleteModal = false;
    this.modalData = {};
    this.cdr.markForCheck();
  }

  // ===== ACCIONES DE USUARIO =====

  async banUser(): Promise<void> {
    if (this.banForm.invalid || !this.modalData.userId) return;

    try {
      const formValue = this.banForm.value;
      await this.adminService.banUser(
        this.modalData.userId,
        formValue.reason,
        formValue.duration ? parseInt(formValue.duration) : undefined
      ).toPromise();

      this.closeModals();
      this.showSuccessMessage(`Usuario ${this.modalData.username} baneado correctamente`);
    } catch (error: any) {
      this.showErrorMessage(error.message);
    }
  }

  async unbanUser(user: AdminUser): Promise<void> {
    try {
      await this.adminService.unbanUser(user._id, 'Desbaneado desde panel de admin').toPromise();
      this.showSuccessMessage(`Usuario ${user.username} desbaneado correctamente`);
    } catch (error: any) {
      this.showErrorMessage(error.message);
    }
  }

  async changeUserRole(): Promise<void> {
    if (this.roleForm.invalid || !this.modalData.userId) return;

    try {
      const formValue = this.roleForm.value;
      await this.adminService.changeUserRole(
        this.modalData.userId,
        formValue.newRole,
        formValue.reason
      ).toPromise();

      this.closeModals();
      this.showSuccessMessage(`Rol de ${this.modalData.username} cambiado correctamente`);
    } catch (error: any) {
      this.showErrorMessage(error.message);
    }
  }

  // ===== ACCIONES DE CONTENIDO =====

  async deleteContent(): Promise<void> {
    if (!this.modalData.itemId || !this.modalData.itemType) return;

    try {
      const reason = this.deleteForm.value.reason || 'Eliminado por moderación';

      switch (this.modalData.itemType) {
        case 'review':
          await this.adminService.deleteReview(this.modalData.itemId, reason).toPromise();
          break;
        case 'comment':
          await this.adminService.deleteComment(this.modalData.itemId, reason).toPromise();
          break;
        case 'list':
          await this.adminService.deleteList(this.modalData.itemId, reason).toPromise();
          break;
      }

      this.closeModals();
      this.showSuccessMessage(`${this.capitalizeFirst(this.modalData.itemType || '')} eliminado correctamente`);
    } catch (error: any) {
      this.showErrorMessage(error.message);
    }
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

  // ===== UTILIDADES =====

  private getCurrentUser(): any {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  private showSuccessMessage(message: string): void {
    // Implementar notificación de éxito
    console.log('✅', message);
    // Aquí puedes integrar con tu sistema de notificaciones
  }

  private showErrorMessage(message: string): void {
    // Implementar notificación de error
    console.error('❌', message);
    // Aquí puedes integrar con tu sistema de notificaciones
  }

  public capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ===== GETTERS PARA TEMPLATES =====

  get canManageUsers(): boolean {
    return this.userPermissions?.can.manageUsers || false;
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

  getRoleClass(role: string): string {
    const roleClasses: { [key: string]: string } = {
      'admin': 'badge-admin',
      'moderator': 'badge-moderator',
      'premium': 'badge-premium',
      'user': 'badge-user'
    };
    return roleClasses[role] || 'badge-user';
  }

  getUserAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}