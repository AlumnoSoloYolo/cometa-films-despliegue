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
  contentSearchForm!: FormGroup;  // NUEVO FORMULARIO PARA CONTENIDO

  // ===== BÚSQUEDA DE CONTENIDO =====
  isContentFiltered = false;
  originalContentData = {
    reviews: [] as any[],
    comments: [] as any[],
    lists: [] as any[]
  };
  filteredReviews: any[] = [];
  filteredComments: any[] = [];
  filteredLists: any[] = [];

  // Modales originales
  showBanModal = false;
  showRoleModal = false;
  showDeleteModal = false;

  // ===== NUEVOS MODALES =====
  showHistoryModal = false;
  showReviewModal = false;

  // ===== BÚSQUEDA DE CONTENIDO POR USUARIO =====

  searchContent(): void {
    const username = this.contentSearchForm.get('username')?.value?.trim().toLowerCase();
    const userRole = this.contentSearchForm.get('userRole')?.value;

    console.log('Búsqueda de contenido por usuario:', { username, userRole });

    if (!username && !userRole) {
      this.clearContentSearch();
      return;
    }

    this.isContentFiltered = true;

    // Guardar datos originales si es la primera búsqueda
    if (this.originalContentData.reviews.length === 0) {
      this.originalContentData.reviews = [...this.reviews];
      this.originalContentData.comments = [...this.comments];
      this.originalContentData.lists = [...this.lists];
    }

    // Filtrar reseñas
    this.filteredReviews = this.originalContentData.reviews.filter(review => {
      if (!review.userId) return false;
      return this.matchesContentFilter(review.userId, username, userRole);
    });

    // Filtrar comentarios
    this.filteredComments = this.originalContentData.comments.filter(comment => {
      if (!comment.userId) return false;
      return this.matchesContentFilter(comment.userId, username, userRole);
    });

    // Filtrar listas
    this.filteredLists = this.originalContentData.lists.filter(list => {
      if (!list.userId) return false;
      return this.matchesContentFilter(list.userId, username, userRole);
    });

    console.log('Resultados de búsqueda de contenido:', {
      reseñas: this.filteredReviews.length,
      comentarios: this.filteredComments.length,
      listas: this.filteredLists.length
    });

    this.cdr.markForCheck();
  }

  private matchesContentFilter(user: any, username: string, userRole: string): boolean {
    // Si no hay usuario, no puede coincidir con filtros
    if (!user) return false;
    
    // Filtro por username
    if (username && !user.username?.toLowerCase().includes(username)) {
      return false;
    }

    // Filtro por rol
    if (userRole && user.role !== userRole) {
      return false;
    }

    return true;
  }

  clearContentSearch(): void {
    this.contentSearchForm.reset();
    this.isContentFiltered = false;
    
    // Restaurar datos originales
    if (this.originalContentData.reviews.length > 0) {
      this.filteredReviews = [];
      this.filteredComments = [];
      this.filteredLists = [];
      
      // Limpiar datos originales
      this.originalContentData = {
        reviews: [],
        comments: [],
        lists: []
      };
    }

    console.log('Búsqueda de contenido limpiada');
    this.cdr.markForCheck();
  }

  // Getters para mostrar datos filtrados o completos
  get displayReviews(): any[] {
    return this.isContentFiltered ? this.filteredReviews : this.reviews;
  }

  get displayComments(): any[] {
    return this.isContentFiltered ? this.filteredComments : this.comments;
  }

  get displayLists(): any[] {
    return this.isContentFiltered ? this.filteredLists : this.lists;
  }
  isGlobalSearch = false;
  originalUsers: any[] = [];
  originalReviews: any[] = [];
  originalComments: any[] = [];
  originalLists: any[] = [];

  // Estado del modal actual
  modalData: {
    userId?: string;
    username?: string;
    currentRole?: string;
    itemId?: string;
    itemType?: string;
    itemTitle?: string;
    moderationHistory?: any[];
    review?: any;
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

    // NUEVO: Formulario de búsqueda de contenido
    this.contentSearchForm = this.fb.group({
      username: [''],
      userRole: ['']
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
        // Si no es búsqueda global, usar búsqueda normal
        if (!this.isGlobalSearch) {
          this.resetUsersPagination();
          this.loadUsers();
        }
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
          const newReviews = response.reviews || [];
          
          // FILTRAR RESEÑAS QUE TIENEN userId NULL (usuarios eliminados)
          const validReviews = newReviews.filter(review => review.userId !== null && review.userId !== undefined);
          console.log(`Reseñas filtradas: ${validReviews.length} de ${newReviews.length} (eliminadas ${newReviews.length - validReviews.length} sin usuario)`);
          
          this.reviews = page === 1 ? validReviews : [...this.reviews, ...validReviews];
          
          this.pagination.reviews = {
            page: response.pagination.page,
            total: response.pagination.total,
            hasMore: response.pagination.hasMore
          };
          
          console.log(`Reseñas cargadas: ${this.reviews.length} total`);
          
          // Si hay búsqueda activa, actualizar filtros
          if (this.isContentFiltered) {
            this.originalContentData.reviews = [...this.reviews];
            this.searchContent();
          }
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
        console.log('Respuesta de comentarios:', response);
        if (response) {
          const newComments = response.comments || [];
          
          // FILTRAR COMENTARIOS QUE TIENEN userId NULL (usuarios eliminados)
          const validComments = newComments.filter(comment => comment.userId !== null && comment.userId !== undefined);
          console.log(`Comentarios filtrados: ${validComments.length} de ${newComments.length} (eliminados ${newComments.length - validComments.length} sin usuario)`);
          
          this.comments = page === 1 ? validComments : [...this.comments, ...validComments];
          
          this.pagination.comments = {
            page: response.pagination?.page || page,
            total: response.pagination?.total || 0,
            hasMore: response.pagination?.hasMore || false
          };
          
          console.log(`Comentarios cargados: ${this.comments.length} total`);
          
          // Si hay búsqueda activa, actualizar filtros
          if (this.isContentFiltered) {
            this.originalContentData.comments = [...this.comments];
            this.searchContent();
          }
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

    console.log('Cargando listas - página:', page);

    const listsSub = this.adminService.getLists({ page, limit: 20 }).subscribe({
      next: (response) => {
        console.log('Respuesta de listas recibida:', response);
        console.log('Tipo de respuesta:', typeof response);
        console.log('Es array?:', Array.isArray(response));
        
        if (response) {
          // Manejar diferentes formatos de respuesta
          let newLists: any[] = [];
          
          if (Array.isArray(response)) {
            // Si la respuesta es directamente un array
            newLists = response;
            this.pagination.lists = {
              page: page,
              total: response.length,
              hasMore: false
            };
          } else if (response.lists && Array.isArray(response.lists)) {
            // Si la respuesta tiene formato { lists: [], pagination: {} }
            newLists = response.lists;
            this.pagination.lists = {
              page: response.pagination?.page || page,
              total: response.pagination?.total || 0,
              hasMore: response.pagination?.hasMore || false
            };
          } else if (response.data && Array.isArray(response.data)) {
            // Si la respuesta tiene formato { data: [], pagination: {} }
            newLists = response.data;
            this.pagination.lists = {
              page: response.pagination?.page || page,
              total: response.pagination?.total || 0,
              hasMore: response.pagination?.hasMore || false
            };
          } else {
            console.warn('Formato de respuesta no reconocido para listas:', response);
            newLists = [];
          }
          
          // FILTRAR LISTAS QUE TIENEN userId NULL (usuarios eliminados)
          const validLists = newLists.filter(list => list.userId !== null && list.userId !== undefined);
          console.log(`Listas filtradas: ${validLists.length} de ${newLists.length} (eliminadas ${newLists.length - validLists.length} sin usuario)`);
          
          this.lists = page === 1 ? validLists : [...this.lists, ...validLists];
          
          console.log(`Listas procesadas: ${this.lists.length} total`);
          console.log('Muestra de lista:', this.lists[0]);
          
          // Si hay búsqueda activa, actualizar filtros
          if (this.isContentFiltered) {
            this.originalContentData.lists = [...this.lists];
            this.searchContent();
          }
        }
      },
      error: (error: any) => {
        this.errors.lists = error.message;
        console.error('Error cargando listas:', error);
        console.error('Detalles del error:', error);
      },
      complete: () => {
        this.loading.lists = false;
        this.cdr.markForCheck();
        // Debug específico para listas
        setTimeout(() => this.debugLists(), 500);
      }
    });

    this.subscriptions.add(listsSub);
  }

  // ===== FUNCIÓN DE DEPURACIÓN PARA LISTAS =====
  debugLists(): void {
    console.log('=== DEBUG LISTAS ===');
    console.log('Datos cargados:', this.lists);
    console.log('Loading state:', this.loading.lists);
    console.log('Error state:', this.errors.lists);
    console.log('Pagination:', this.pagination.lists);
    console.log('Tab state:', this.tabState.activeContentTab);
    console.log('Array length:', this.lists.length);
    console.log('Array type:', Array.isArray(this.lists));
    console.log('===================');
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
    console.log('Cambiando a pestaña de contenido:', contentType);
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
        // Debug específico para listas
        setTimeout(() => this.debugLists(), 500);
        break;
    }

    this.cdr.markForCheck();
  }

  // ===== BÚSQUEDA GLOBAL =====

  searchGlobally(): void {
    const searchTerm = this.userSearchForm.get('search')?.value?.trim().toLowerCase();
    const roleFilter = this.userSearchForm.get('role')?.value;
    const statusFilter = this.userSearchForm.get('status')?.value;

    console.log('Búsqueda global iniciada:', { searchTerm, roleFilter, statusFilter });

    if (!searchTerm && !roleFilter && !statusFilter) {
      // Si no hay filtros, restaurar datos originales
      this.restoreOriginalData();
      this.isGlobalSearch = false;
      return;
    }

    this.isGlobalSearch = true;

    // Guardar datos originales si es la primera búsqueda
    if (this.originalUsers.length === 0) {
      this.originalUsers = [...this.users];
      this.originalReviews = [...this.reviews];
      this.originalComments = [...this.comments];
      this.originalLists = [...this.lists];
    }

    // Filtrar usuarios
    this.users = this.originalUsers.filter(user => 
      this.matchesGlobalFilter(user, searchTerm, roleFilter, statusFilter, 'user')
    );

    // Filtrar reseñas por usuario
    this.reviews = this.originalReviews.filter(review => {
      if (review.userId && review.userId.username) {
        return this.matchesGlobalFilter(review.userId, searchTerm, roleFilter, statusFilter, 'review');
      }
      return false;
    });

    // Filtrar comentarios por usuario
    this.comments = this.originalComments.filter(comment => {
      if (comment.userId && comment.userId.username) {
        return this.matchesGlobalFilter(comment.userId, searchTerm, roleFilter, statusFilter, 'comment');
      }
      return false;
    });

    // Filtrar listas por usuario
    this.lists = this.originalLists.filter(list => {
      if (list.userId && list.userId.username) {
        return this.matchesGlobalFilter(list.userId, searchTerm, roleFilter, statusFilter, 'list');
      }
      return false;
    });

    console.log('Resultados de búsqueda:', {
      usuarios: this.users.length,
      reseñas: this.reviews.length,
      comentarios: this.comments.length,
      listas: this.lists.length
    });

    this.cdr.markForCheck();
  }

  // Función auxiliar para verificar si un elemento coincide con los filtros
  private matchesGlobalFilter(user: any, searchTerm: string, roleFilter: string, statusFilter: string, type: string): boolean {
    // Filtro por término de búsqueda (username o email)
    if (searchTerm) {
      const matchesSearch = 
        user.username?.toLowerCase().includes(searchTerm) ||
        user.email?.toLowerCase().includes(searchTerm);
      
      if (!matchesSearch) return false;
    }

    // Filtro por rol
    if (roleFilter && user.role !== roleFilter) {
      return false;
    }

    // Filtro por estado
    if (statusFilter) {
      const isActive = !user.isBanned;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'banned' && isActive) return false;
    }

    return true;
  }

  // Restaurar datos originales
  private restoreOriginalData(): void {
    if (this.originalUsers.length > 0) {
      this.users = [...this.originalUsers];
      this.reviews = [...this.originalReviews];
      this.comments = [...this.originalComments];
      this.lists = [...this.originalLists];
      
      // Limpiar datos originales
      this.originalUsers = [];
      this.originalReviews = [];
      this.originalComments = [];
      this.originalLists = [];
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
    this.closeOtherModals(['ban']);
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
    this.closeOtherModals(['role']);
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
    this.closeOtherModals(['delete']);
    this.cdr.markForCheck();
    console.log('Abriendo modal de eliminación para:', itemType, itemTitle);
  }

  // ===== NUEVOS MODALES =====

  openHistoryModal(user: any): void {
    console.log('Abriendo historial para:', user.username);
    
    this.modalData = {
      username: user.username,
      userId: user._id,
      moderationHistory: user.moderationHistory || []
    };
    
    this.showHistoryModal = true;
    this.closeOtherModals(['history']);
    this.cdr.markForCheck();
    
    console.log('Historial de moderación:', this.modalData.moderationHistory);
  }

  openReviewModal(review: any): void {
    console.log('Abriendo reseña completa:', review._id);
    
    this.modalData = {
      review: {
        _id: review._id,
        movieId: review.movieId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        userId: {
          username: review.userId.username,
          avatar: review.userId.avatar,
          role: review.userId.role
        }
      }
    };
    
    this.showReviewModal = true;
    this.closeOtherModals(['review']);
    this.cdr.markForCheck();
    
    console.log('Datos de la reseña:', this.modalData.review);
  }

  closeOtherModals(except: string[] = []): void {
    if (!except.includes('ban')) {
      this.showBanModal = false;
    }
    if (!except.includes('role')) {
      this.showRoleModal = false;
    }
    if (!except.includes('delete')) {
      this.showDeleteModal = false;
    }
    if (!except.includes('history')) {
      this.showHistoryModal = false;
    }
    if (!except.includes('review')) {
      this.showReviewModal = false;
    }
  }

  closeModals(): void {
    this.showBanModal = false;
    this.showRoleModal = false;
    this.showDeleteModal = false;
    this.showHistoryModal = false;
    this.showReviewModal = false;
    
    // Limpiar datos del modal
    this.modalData = {
      userId: '',
      username: '',
      currentRole: '',
      itemType: '',
      itemId: '',
      itemTitle: ''
    };
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
    if (!this.modalData.itemId || !this.modalData.itemType) {
      console.error('Datos del modal faltantes:', this.modalData);
      return;
    }

    // Verificar que el formulario existe
    if (!this.deleteForm) {
      console.error('Formulario de eliminación no inicializado');
      return;
    }

    const reason = this.deleteForm.value?.reason || 'Eliminado por moderación';

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
        console.error('Tipo de contenido no válido:', this.modalData.itemType);
        alert('Tipo de contenido no válido');
        return;
    }

    if (!deleteObservable) {
      console.error('No se pudo crear el observable de eliminación');
      return;
    }

    const deleteSub = deleteObservable.subscribe({
      next: (response) => {
        this.closeModals();
        console.log(`${this.capitalizeFirst(this.modalData.itemType || '')} eliminado correctamente`, response);
        
        // Refrescar el contenido correspondiente
        try {
          switch (this.modalData.itemType) {
            case 'review':
              this.reviews = this.reviews.filter(r => r._id !== this.modalData.itemId);
              if (this.isContentFiltered) {
                this.filteredReviews = this.filteredReviews.filter(r => r._id !== this.modalData.itemId);
              }
              break;
            case 'comment':
              this.comments = this.comments.filter(c => c._id !== this.modalData.itemId);
              if (this.isContentFiltered) {
                this.filteredComments = this.filteredComments.filter(c => c._id !== this.modalData.itemId);
              }
              break;
            case 'list':
              this.lists = this.lists.filter(l => l._id !== this.modalData.itemId);
              if (this.isContentFiltered) {
                this.filteredLists = this.filteredLists.filter(l => l._id !== this.modalData.itemId);
              }
              break;
          }
          this.cdr.markForCheck();
        } catch (error) {
          console.error('Error actualizando listas locales:', error);
        }
      },
      error: (error: any) => {
        console.error('Error eliminando contenido:', error);
        alert(`Error al eliminar contenido: ${error.message || 'Error desconocido'}`);
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

  // ===== FUNCIÓN PARA OBTENER TEXTO DE ACCIÓN DE HISTORIAL =====

  getActionText(action: string): string {
    const actions: { [key: string]: string } = {
      'ban': 'Usuario Baneado',
      'unban': 'Usuario Desbaneado',
      'role_change': 'Cambio de Rol',
      'warning': 'Advertencia Emitida',
      'content_delete': 'Contenido Eliminado',
      'account_created': 'Cuenta Creada',
      'profile_update': 'Perfil Actualizado',
      'login_attempt': 'Intento de Login',
      'password_change': 'Cambio de Contraseña',
      'email_change': 'Cambio de Email',
      'premium_granted': 'Premium Otorgado',
      'premium_revoked': 'Premium Revocado',
      'suspension': 'Suspensión Temporal',
      'account_deletion': 'Eliminación de Cuenta',
      'data_export': 'Exportación de Datos',
      'privacy_update': 'Actualización de Privacidad'
    };
    
    return actions[action] || this.capitalizeFirst(action.replace('_', ' '));
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
    if (!str) return '';
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