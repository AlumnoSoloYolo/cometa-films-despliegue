import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, interval, debounceTime, distinctUntilChanged } from 'rxjs';
import { PeliculasService } from '../../../services/peliculas.service';

// PrimeNG Imports
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { TableModule } from 'primeng/table';
import { BadgeModule } from 'primeng/badge';
import { ToolbarModule } from 'primeng/toolbar';
import { PanelModule } from 'primeng/panel';
import { TooltipModule } from 'primeng/tooltip';
import { MessagesModule } from 'primeng/messages';
import { MessageModule } from 'primeng/message';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextarea } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';

// Services
import {
  AdminService,
  AdminUser,
  AdminReview,
  AdminComment,
  AdminList,
  AdminReport,
  DashboardMetrics,
  RealtimeMetrics,
  SystemStats,
  UserPermissions,
  PermissionsResponse,
  ReportStats
} from '../../../services/admin.service';
import { AuthService } from '../../../services/auth.service';

// Interfaces
interface TabState {
  activeTab: string;
  activeContentTab: string;
}

interface PaginationState {
  users: { page: number; total: number; hasMore: boolean };
  reviews: { page: number; total: number; hasMore: boolean };
  comments: { page: number; total: number; hasMore: boolean };
  lists: { page: number; total: number; hasMore: boolean };
  reports: { page: number; total: number; hasMore: boolean };
}

interface LoadingState {
  dashboard: boolean;
  stats: boolean;
  users: boolean;
  reviews: boolean;
  comments: boolean;
  lists: boolean;
  permissions: boolean;
  banning: boolean;
  reports: boolean;
  resolvingReport: boolean;
  reportStats: boolean;
  charts: boolean;
  realtime: boolean;
}

interface ErrorState {
  dashboard: string | null;
  stats: string | null;
  users: string | null;
  reviews: string | null;
  comments: string | null;
  lists: string | null;
  permissions: string | null;
  reports: string | null;
  reportStats: string | null;
  charts: string | null;
}

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    FormsModule,
    CardModule,
    ChartModule,
    ButtonModule,
    SelectButtonModule,
    ProgressBarModule,
    TagModule,
    SkeletonModule,
    DividerModule,
    TableModule,
    BadgeModule,
    ToolbarModule,
    PanelModule,
    TooltipModule,
    MessagesModule,
    MessageModule,
    DialogModule,
    InputTextModule,
    DropdownModule,
    CheckboxModule
  ],
  templateUrl: './admin-panel.component.html',
  styleUrls: ['./admin-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPanelComponent implements OnInit, OnDestroy {

  // ===== ESTADO DE LA APLICACIÓN =====
  currentUser: any = null;
  userPermissions: UserPermissions | null = null;

  // Estados de UI
  tabState: TabState = {
    activeTab: 'dashboard',
    activeContentTab: 'reviews'
  };

  loading: LoadingState = {
    dashboard: false,
    stats: false,
    users: false,
    reviews: false,
    comments: false,
    lists: false,
    permissions: false,
    banning: false,
    reports: false,
    resolvingReport: false,
    reportStats: false,
    charts: false,
    realtime: false
  };

  errors: ErrorState = {
    dashboard: null,
    stats: null,
    users: null,
    reviews: null,
    comments: null,
    lists: null,
    permissions: null,
    reports: null,
    reportStats: null,
    charts: null
  };

  pagination: PaginationState = {
    users: { page: 1, total: 0, hasMore: false },
    reviews: { page: 1, total: 0, hasMore: false },
    comments: { page: 1, total: 0, hasMore: false },
    lists: { page: 1, total: 0, hasMore: false },
    reports: { page: 1, total: 0, hasMore: false }
  };

  // ===== DATOS =====
  dashboardData: DashboardMetrics | null = null;
  realtimeMetrics: RealtimeMetrics | null = null;
  stats: SystemStats | null = null;
  users: AdminUser[] = [];
  reviews: AdminReview[] = [];
  comments: AdminComment[] = [];
  lists: AdminList[] = [];
  reports: AdminReport[] = [];
  reportStats: ReportStats | null = null;

  // ===== PELÍCULAS POPULARES =====
  private _topMovies: any[] = [];
  private _enhancedTopMovies: any[] = [];
  private posterLoadingStates = new Map<string, 'loading' | 'loaded' | 'error'>();

  // ===== CACHE DE POSTERS =====
  private moviePostersCache = new Map<string, string>();
  private posterErrors = new Set<string>();

  // ===== DATOS PARA GRÁFICAS =====
  userGrowthChartData: any;
  userGrowthChartOptions: any;
  activityTrendsChartData: any;
  activityTrendsChartOptions: any;
  contentDistributionChartData: any;
  contentDistributionChartOptions: any;
  moderationChartData: any;
  moderationChartOptions: any;

  // ===== CONFIGURACIÓN UI =====
  selectedTimeRange = 'week';
  timeRangeOptions = [
    { label: 'Hoy', value: 'today' },
    { label: '7 días', value: 'week' },
    { label: '30 días', value: 'month' }
  ];

  // ===== FORMULARIOS =====
  userSearchForm!: FormGroup;
  contentSearchForm!: FormGroup;
  reportSearchForm!: FormGroup;
  banForm!: FormGroup;
  roleForm!: FormGroup;
  deleteForm!: FormGroup;
  resolveReportForm!: FormGroup;

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

  // ===== MODALES =====
  showBanModal = false;
  showRoleModal = false;
  showDeleteModal = false;
  showHistoryModal = false;
  showReviewModal = false;
  showResolveReportModal = false;
  showReportDetailModal = false;

  // ===== BÚSQUEDA GLOBAL =====
  isGlobalSearch = false;
  originalUsers: any[] = [];
  originalReviews: any[] = [];
  originalComments: any[] = [];
  originalLists: any[] = [];

  // ===== ESTADO DEL MODAL ACTUAL =====
  modalData: {
    userId?: string;
    username?: string;
    currentRole?: string;
    itemId?: string;
    itemType?: string;
    itemTitle?: string;
    moderationHistory?: any[];
    review?: any;
    report?: AdminReport;
  } = {};

  // ===== AUTO-REFRESH =====
  private realtimeSubscription?: Subscription;
  private refreshInterval = 30000; // 30 segundos
  private subscriptions = new Subscription();

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private peliculaService: PeliculasService
  ) {
    this.createForms();
    this.initializeChartOptions();
  }

  ngOnInit(): void {
    this.initializeComponent();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.cleanupResources();
  }

  // ===== GETTERS PARA PELÍCULAS =====

  /**
   * Getter para obtener las películas populares
   */
  get topMovies(): any[] {
    return this._enhancedTopMovies.length > 0 ? this._enhancedTopMovies : this._topMovies;
  }

  /**
   * Verifica si hay datos de películas disponibles
   */
  get hasMoviesData(): boolean {
    return this.topMovies.length > 0;
  }

  /**
   * Obtiene el número total de películas populares
   */
  get totalPopularMovies(): number {
    return this.topMovies.length;
  }

  /**
   * Obtiene estadísticas resumidas de las películas
   */
  get moviesStats(): { totalReviews: number; averageRating: number; totalLikes: number } {
    if (!this.hasMoviesData) {
      return { totalReviews: 0, averageRating: 0, totalLikes: 0 };
    }
    
    const totalReviews = this.topMovies.reduce((sum, movie) => sum + (movie.reviewCount || 0), 0);
    const totalLikes = this.topMovies.reduce((sum, movie) => sum + (movie.totalLikes || 0), 0);
    const averageRating = this.topMovies.reduce((sum, movie) => sum + (movie.averageRating || 0), 0) / this.topMovies.length;
    
    return {
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      totalLikes
    };
  }

  // ===== INICIALIZACIÓN =====
  
  private createForms(): void {
    this.userSearchForm = this.fb.group({
      search: [''],
      role: [''],
      status: ['']
    });

    this.contentSearchForm = this.fb.group({
      username: [''],
      userRole: ['']
    });

    this.reportSearchForm = this.fb.group({
      status: [''],
      priority: [''],
      contentType: [''],
      category: [''],
      reason: ['']
    });

    this.banForm = this.fb.group({
      reason: ['', [Validators.required, Validators.minLength(10)]],
      duration: ['']
    });

    this.roleForm = this.fb.group({
      newRole: ['', Validators.required],
      reason: ['']
    });

    this.deleteForm = this.fb.group({
      reason: ['']
    });

    this.resolveReportForm = this.fb.group({
      action: ['', Validators.required],
      notes: [''],
      shouldNotify: [true]
    });
  }

  private initializeComponent(): void {
    this.currentUser = this.getCurrentUser();
    this.loadUserPermissions();
    this.loadDashboard();
    this.loadUsers();
    this.setupSearchSubscription();
    this.startRealtimeUpdates();
  }

  private setupSubscriptions(): void {
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
      case 'reports':
        this.loadReports();
        this.loadReportStats();
        break;
    }
  }

  // ===== MÉTODOS PARA PELÍCULAS =====

  /**
   * Setter para establecer las películas populares
   */
  private setTopMovies(movies: any[]): void {
    this._topMovies = movies || [];
    this.enhanceMovieStats();
  }

  /**
   * Actualiza los datos de películas desde el dashboard
   */
  private updateTopMoviesFromDashboard(): void {
    if (this.dashboardData?.charts?.topMovies) {
      this.setTopMovies(this.dashboardData.charts.topMovies);
      this.preloadMoviePosters();
      console.log('Lista de películas populares actualizada:', this.topMovies.length);
    } else {
      this._topMovies = [];
      this._enhancedTopMovies = [];
    }
  }

  /**
   * Mejora las estadísticas de películas
   */
  private enhanceMovieStats(): void {
    if (!this._topMovies.length) {
      this._enhancedTopMovies = [];
      return;
    }
    
    this._enhancedTopMovies = this._topMovies.map((movie, index) => {
      const baseScore = (this._topMovies.length - index) * 10;
      const randomVariation = Math.floor(Math.random() * 20);
      const trendingScore = Math.max(0, baseScore + randomVariation);
      
      const ratingFactor = movie.averageRating ? (movie.averageRating / 10) : 0.5;
      const estimatedLikes = Math.floor((movie.reviewCount || 0) * ratingFactor * 1.5);
      
      return {
        ...movie,
        trendingScore,
        totalLikes: movie.totalLikes || estimatedLikes,
        position: index + 1,
        isTopThree: index < 3,
        popularityScore: this.calculatePopularityScore(movie, index)
      };
    });
    
    console.log('Estadísticas de películas mejoradas:', this._enhancedTopMovies.length);
  }

  /**
   * Calcula un score de popularidad para la película
   */
  private calculatePopularityScore(movie: any, position: number): number {
    const reviewWeight = 0.4;
    const ratingWeight = 0.3;
    const positionWeight = 0.3;
    
    const reviewScore = Math.min((movie.reviewCount || 0) / 10, 100);
    const ratingScore = (movie.averageRating || 0) * 10;
    const positionScore = Math.max(0, 100 - (position * 10));
    
    return Math.round(
      (reviewScore * reviewWeight) + 
      (ratingScore * ratingWeight) + 
      (positionScore * positionWeight)
    );
  }



  /**
   * Pre-carga los posters de las películas populares
   */
  private preloadMoviePosters(): void {
    if (!this.topMovies.length) return;
    
    this.topMovies.forEach(movie => {
      const posterUrl = this.getMoviePoster(movie.movieId);
      if (posterUrl) {
        const img = new Image();
        img.src = posterUrl;
        img.onload = () => {
          console.log(`Poster cargado para película ${movie.movieId}`);
        };
        img.onerror = () => {
          // this.onPosterError(null, movie.movieId);
        };
      }
    });
  }

  /**
   * Limpia el cache de posters
   */
  clearPosterCache(): void {
    this.moviePostersCache.clear();
    this.posterErrors.clear();
    console.log('Cache de posters limpiado');
  }

  /**
   * Ver detalles de una película específica
   */
  viewMovieDetails(movieId: string | number): void {
    console.log(`Viendo detalles de la película ${movieId}`);
    this.openMovieDetailModal(movieId);
  }

  /**
   * Abre un modal con detalles de la película
   */
  private openMovieDetailModal(movieId: string | number): void {
    const movie = this.topMovies.find(m => m.movieId.toString() === movieId.toString());
    
    if (movie) {
      const message = `
Película: ${movie.title || `ID ${movie.movieId}`}
Rating: ${movie.averageRating.toFixed(1)}/10
Reseñas: ${movie.reviewCount}
${movie.totalLikes ? `Likes: ${movie.totalLikes}` : ''}
${movie.trendingScore ? `Tendencia: +${movie.trendingScore}%` : ''}
      `.trim();
      
      alert(message);
    }
  }

  /**
   * Ver todas las películas populares
   */
  viewAllPopularMovies(): void {
    console.log('Navegando a todas las películas populares');
    this.showTab('content');
    this.showContentTab('reviews');
  }

  /**
   * Exportar datos de películas populares
   */
  exportPopularMovies(): void {
    console.log('Exportando datos de películas populares');
    
    if (!this.topMovies.length) {
      alert('No hay datos de películas para exportar');
      return;
    }
    
    try {
      const exportData = this.topMovies.map((movie, index) => ({
        ranking: index + 1,
        movieId: movie.movieId,
        title: movie.title || `Película ${movie.movieId}`,
        averageRating: movie.averageRating.toFixed(1),
        reviewCount: movie.reviewCount,
        totalLikes: movie.totalLikes || 0,
        trendingScore: movie.trendingScore || 0
      }));
      
      const csvContent = this.convertToCSV(exportData);
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `peliculas-populares-${this.getCurrentDateString()}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('Archivo CSV descargado exitosamente');
      
    } catch (error) {
      console.error('Error exportando datos:', error);
      alert('Error al exportar los datos. Intenta de nuevo.');
    }
  }

  /**
   * Convierte un array de objetos a formato CSV
   */
  private convertToCSV(data: any[]): string {
    if (!data.length) return '';
    
    const headers = Object.keys(data[0]);
    const headerRow = headers.join(',');
    
    const rows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    return [headerRow, ...rows].join('\n');
  }

  /**
   * Obtiene la fecha actual como string para nombres de archivo
   */
  private getCurrentDateString(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ===== CARGA DE DATOS DASHBOARD =====

  loadDashboard(): void {
    this.loading.dashboard = true;
    this.errors.dashboard = null;
    this.loading.charts = true;

    this.adminService.getDashboardMetrics(this.selectedTimeRange).subscribe({
      next: (data) => {
        this.dashboardData = data;
        this.prepareChartsData();
        
        setTimeout(() => {
          this.preloadMoviePosters();
        }, 100);
        
        console.log('Dashboard data loaded:', data);
      },
      error: (error) => {
        this.errors.dashboard = error.message || 'Error cargando dashboard';
        this.errors.charts = error.message || 'Error cargando gráficas';
        console.error('Error loading dashboard:', error);
        this.loadBasicStats();
      },
      complete: () => {
        this.loading.dashboard = false;
        this.loading.charts = false;
        this.cdr.markForCheck();
      }
    });
  }


  private loadBasicStats(): void {
    this.loading.stats = true;
    
    this.adminService.getSystemStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        console.log('Basic stats loaded:', stats);
      },
      error: (error) => {
        this.errors.stats = error.message;
        console.error('Error loading basic stats:', error);
      },
      complete: () => {
        this.loading.stats = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadRealtimeMetrics(): void {
    this.loading.realtime = true;

    this.adminService.getRealtimeMetrics().subscribe({
      next: (data) => {
        this.realtimeMetrics = data;
        console.log('Realtime metrics updated:', data);
      },
      error: (error) => {
        console.error('Error loading realtime metrics:', error);
      },
      complete: () => {
        this.loading.realtime = false;
        this.cdr.markForCheck();
      }
    });
  }

  private loadUserPermissions(): void {
    this.loading.permissions = true;
    this.errors.permissions = null;

    this.adminService.getUserPermissions().subscribe({
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
  }

  // ===== PREPARACIÓN DE GRÁFICAS =====

  private prepareChartsData(): void {
    if (!this.dashboardData) return;

    this.userGrowthChartData = {
      labels: this.dashboardData.charts.userGrowth.map(item => item.date),
      datasets: [
        {
          label: 'Nuevos Usuarios',
          data: this.dashboardData.charts.userGrowth.map(item => item.count),
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    };

    this.activityTrendsChartData = {
      labels: this.dashboardData.charts.activityTrends.map(item => item.date),
      datasets: [
        {
          label: 'Reseñas',
          data: this.dashboardData.charts.activityTrends.map(item => item.reviews),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          tension: 0.3
        },
        {
          label: 'Comentarios',
          data: this.dashboardData.charts.activityTrends.map(item => item.comments),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          tension: 0.3
        },
        {
          label: 'Likes',
          data: this.dashboardData.charts.activityTrends.map(item => item.likes),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.8)',
          tension: 0.3
        }
      ]
    };

    this.contentDistributionChartData = {
      labels: ['Reseñas', 'Comentarios', 'Listas', 'Usuarios Premium'],
      datasets: [
        {
          data: [
            this.dashboardData.overview.totalReviews,
            this.dashboardData.overview.totalComments,
            this.dashboardData.overview.totalLists,
            this.dashboardData.overview.premiumUsers
          ],
          backgroundColor: [
            '#6366f1',
            '#10b981',
            '#f59e0b',
            '#8b5cf6'
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };

    // Actualizar películas populares
    this.updateTopMoviesFromDashboard();
  }

  private initializeChartOptions(): void {
    const textColor = '#374151';
    const borderColor = '#e5e7eb';

    const baseLineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top' as const,
          labels: {
            color: textColor,
            font: {
              size: 12,
              weight: 500
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: textColor,
            font: {
              size: 11
            }
          },
          grid: {
            color: borderColor
          }
        },
        y: {
          ticks: {
            color: textColor,
            font: {
              size: 11
            }
          },
          grid: {
            color: borderColor
          }
        }
      }
    };

    this.userGrowthChartOptions = {
      ...baseLineOptions,
      plugins: {
        ...baseLineOptions.plugins,
        title: {
          display: true,
          text: 'Crecimiento de Usuarios',
          color: textColor,
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      }
    };

    this.activityTrendsChartOptions = {
      ...baseLineOptions,
      plugins: {
        ...baseLineOptions.plugins,
        title: {
          display: true,
          text: 'Tendencias de Actividad',
          color: textColor,
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      }
    };

    this.contentDistributionChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: {
            color: textColor,
            font: {
              size: 12
            },
            padding: 20
          }
        },
        title: {
          display: true,
          text: 'Distribución de Contenido',
          color: textColor,
          font: {
            size: 14,
            weight: 'bold'
          }
        }
      }
    };
  }

  // ===== EVENTOS Y ACCIONES =====

    onTimeRangeChange(): void {
      console.log('Time range changed to:', this.selectedTimeRange);
      this.loadDashboard(); // ← Aquí se queda en loading
    }

  refreshDashboard(): void {
    this.loadDashboard();
    this.loadRealtimeMetrics();
  }

  private startRealtimeUpdates(): void {
    this.realtimeSubscription = interval(this.refreshInterval).subscribe(() => {
      this.loadRealtimeMetrics();
    });

    this.loadRealtimeMetrics();
  }

  

  // ===== NAVEGACIÓN =====

  showTab(tabName: string): void {
    this.tabState.activeTab = tabName;

    switch (tabName) {
      case 'users':
        if (this.users.length === 0) this.loadUsers();
        break;
      case 'content':
        if (this.reviews.length === 0) this.loadReviews();
        break;
      case 'reports':
        if (this.reports.length === 0) {
          this.loadReports();
          this.loadReportStats();
        }
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
        break;
    }

    this.cdr.markForCheck();
  }

  navigateToReports(): void {
    this.showTab('reports');
  }

  navigateToUsers(): void {
    this.showTab('users');
  }

  navigateToContent(): void {
    this.showTab('content');
  }

  // ===== MÉTODOS DE CARGA =====

  loadUsers(page: number = 1): void {
    if (this.loading.users && page !== 1) return;

    this.loading.users = true;
    this.errors.users = null;

    const formValue = this.userSearchForm.value;
    const filters: any = { page, limit: 20 };

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
          const validReviews = newReviews.filter(review => review.userId !== null && review.userId !== undefined);
          console.log(`Reseñas filtradas: ${validReviews.length} de ${newReviews.length}`);

          this.reviews = page === 1 ? validReviews : [...this.reviews, ...validReviews];

          this.pagination.reviews = {
            page: response.pagination.page,
            total: response.pagination.total,
            hasMore: response.pagination.hasMore
          };

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
        if (response) {
          const newComments = response.comments || [];
          const validComments = newComments.filter(comment => comment.userId !== null && comment.userId !== undefined);

          this.comments = page === 1 ? validComments : [...this.comments, ...validComments];

          this.pagination.comments = {
            page: response.pagination?.page || page,
            total: response.pagination?.total || 0,
            hasMore: response.pagination?.hasMore || false
          };

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

    const listsSub = this.adminService.getLists({ page, limit: 20 }).subscribe({
      next: (response) => {
        if (response) {
          let newLists: any[] = [];

          if (Array.isArray(response)) {
            newLists = response;
            this.pagination.lists = {
              page: page,
              total: response.length,
              hasMore: false
            };
          } else if (response.lists && Array.isArray(response.lists)) {
            newLists = response.lists;
            this.pagination.lists = {
              page: response.pagination?.page || page,
              total: response.pagination?.total || 0,
              hasMore: response.pagination?.hasMore || false
            };
          } else if (response.data && Array.isArray(response.data)) {
            newLists = response.data;
            this.pagination.lists = {
              page: response.pagination?.page || page,
              total: response.pagination?.total || 0,
              hasMore: response.pagination?.hasMore || false
            };
          }

          const validLists = newLists.filter(list => list.userId !== null && list.userId !== undefined);
          this.lists = page === 1 ? validLists : [...this.lists, ...validLists];

          if (this.isContentFiltered) {
            this.originalContentData.lists = [...this.lists];
            this.searchContent();
          }
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

  loadReports(page: number = 1): void {
    if (this.loading.reports && page !== 1) return;

    this.loading.reports = true;
    this.errors.reports = null;

    const formValue = this.reportSearchForm.value;
    const filters: any = { page, limit: 20 };

    if (formValue.status) filters.status = formValue.status;
    if (formValue.priority) filters.priority = formValue.priority;
    if (formValue.contentType) filters.contentType = formValue.contentType;
    if (formValue.category) filters.category = formValue.category;
    if (formValue.reason) filters.reason = formValue.reason;

    console.log('Cargando reportes con filtros:', filters);

    const reportsSub = this.adminService.getReports(filters).subscribe({
      next: (response) => {
        if (response) {
          this.reports = page === 1 ? (response.reports || []) : [...this.reports, ...(response.reports || [])];

          this.pagination.reports = {
            page: response.pagination.page,
            total: response.pagination.total,
            hasMore: response.pagination.hasMore
          };

          console.log(`Reportes cargados: ${this.reports.length} total, página ${page}`);
        }
      },
      error: (error: any) => {
        this.errors.reports = error.message;
        console.error('Error cargando reportes:', error);
      },
      complete: () => {
        this.loading.reports = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.add(reportsSub);
  }

  loadReportStats(): void {
    this.loading.reportStats = true;
    this.errors.reportStats = null;

    const statsSub = this.adminService.getReportStats().subscribe({
      next: (stats) => {
        this.reportStats = stats;
        console.log('Estadísticas de reportes cargadas:', stats);
      },
      error: (error: any) => {
        this.errors.reportStats = error.message;
        console.error('Error cargando estadísticas de reportes:', error);
      },
      complete: () => {
        this.loading.reportStats = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.add(statsSub);
  }

  // ===== UTILIDADES Y GETTERS =====

  get userGrowthPercentage(): number {
    if (!this.dashboardData) return 0;
    
    const todayUsers = this.dashboardData.today.newUsers;
    const periodAverage = this.dashboardData.period.newUsers / this.getPeriodDays();
    
    if (periodAverage === 0) return 0;
    return Math.round(((todayUsers / periodAverage) - 1) * 100);
  }

  get activityGrowthPercentage(): number {
    if (!this.dashboardData) return 0;
    
    const todayActivity = this.dashboardData.today.newReviews + this.dashboardData.today.newComments;
    const periodActivity = this.dashboardData.period.newReviews + this.dashboardData.period.newComments;
    const periodAverage = periodActivity / this.getPeriodDays();
    
    if (periodAverage === 0) return 0;
    return Math.round(((todayActivity / periodAverage) - 1) * 100);
  }

  get moderationEfficiency(): number {
    if (!this.dashboardData) return 100;
    return this.dashboardData.moderation.efficiency;
  }

   getPeriodDays(): number {
    switch (this.selectedTimeRange) {
      case 'today': return 1;
      case 'week': return 7;
      case 'month': return 30;
      default: return 7;
    }
  }

  getTrendClass(percentage: number): string {
    if (percentage > 10) return 'trend-positive';
    if (percentage < -10) return 'trend-negative';
    return 'trend-neutral';
  }

  getModerationSeverity(): 'success' | 'info' | 'warn' | 'danger' {
    if (!this.dashboardData) return 'success';
    
    const pending = this.dashboardData.moderation.pendingReports;
    if (pending === 0) return 'success';
    if (pending <= 5) return 'info';
    if (pending <= 15) return 'warn';
    return 'danger';
  }

  getActivityLevel(): 'success' | 'info' | 'warn' | 'danger' {
    if (!this.dashboardData) return 'info';
    
    const totalToday = this.dashboardData.today.newReviews + 
                      this.dashboardData.today.newComments + 
                      this.dashboardData.today.newUsers;
    
    if (totalToday >= 50) return 'success';
    if (totalToday >= 20) return 'info';
    if (totalToday >= 10) return 'warn';
    return 'danger';
  }

  // ===== PROPIEDADES PARA TEMPLATE =====

  get isLoading(): boolean {
    return this.loading.dashboard || this.loading.charts;
  }

  get hasError(): boolean {
    return !!(this.errors.dashboard || this.errors.charts);
  }

  get canShowCharts(): boolean {
    return !this.isLoading && !this.hasError && !!this.dashboardData;
  }

  get mostActiveUser(): any {
    return this.dashboardData?.content.mostActiveUser;
  }

  get systemHealth(): string {
    if (!this.realtimeMetrics?.systemHealth) return 'unknown';
    return this.realtimeMetrics.systemHealth.status;
  }

  // ===== UTILIDADES DE FORMATEO =====

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  formatPercentage(num: number): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '0%';
  }
  
  const sign = num > 0 ? '+' : '';
  const rounded = Math.round(num * 100) / 100; // Máximo 2 decimales
  
  // Si es un número entero, no mostrar decimales
  if (rounded % 1 === 0) {
    return `${sign}${rounded}%`;
  }
  
  // Si tiene decimales, mostrar máximo 1 decimal
  return `${sign}${rounded.toFixed(1)}%`;
}

  formatTime(hours: number): string {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    }
    return `${Math.round(hours / 24)}d`;
  }

  getLastUpdated(): string {
    if (!this.realtimeMetrics?.timestamp) return '';
    
    const now = new Date();
    const updated = new Date(this.realtimeMetrics.timestamp);
    const diffMs = now.getTime() - updated.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Ahora mismo';
    if (diffMinutes === 1) return 'Hace 1 minuto';
    return `Hace ${diffMinutes} minutos`;
  }

  formatDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  capitalizeFirst(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  getUserAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
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

  // ===== GETTERS PARA PERMISOS =====

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

  // ===== MÉTODOS AUXILIARES =====

  private getCurrentUser(): any {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  }

  getReasonDisplayText(reason: string): string {
    return this.adminService.getReasonDisplayText(reason);
  }

  // ===== BÚSQUEDA DE CONTENIDO =====

  searchContent(): void {
    const username = this.contentSearchForm.get('username')?.value?.trim().toLowerCase();
    const userRole = this.contentSearchForm.get('userRole')?.value;

    console.log('Búsqueda de contenido por usuario:', { username, userRole });

    if (!username && !userRole) {
      this.clearContentSearch();
      return;
    }

    this.isContentFiltered = true;

    if (this.originalContentData.reviews.length === 0) {
      this.originalContentData.reviews = [...this.reviews];
      this.originalContentData.comments = [...this.comments];
      this.originalContentData.lists = [...this.lists];
    }

    this.filteredReviews = this.originalContentData.reviews.filter(review => {
      if (!review.userId) return false;
      return this.matchesContentFilter(review.userId, username, userRole);
    });

    this.filteredComments = this.originalContentData.comments.filter(comment => {
      if (!comment.userId) return false;
      return this.matchesContentFilter(comment.userId, username, userRole);
    });

    this.filteredLists = this.originalContentData.lists.filter(list => {
      if (!list.userId) return false;
      return this.matchesContentFilter(list.userId, username, userRole);
    });

    this.cdr.markForCheck();
  }

  private matchesContentFilter(user: any, username: string, userRole: string): boolean {
    if (!user) return false;

    if (username && !user.username?.toLowerCase().includes(username)) {
      return false;
    }

    if (userRole && user.role !== userRole) {
      return false;
    }

    return true;
  }

  clearContentSearch(): void {
    this.contentSearchForm.reset();
    this.isContentFiltered = false;

    if (this.originalContentData.reviews.length > 0) {
      this.filteredReviews = [];
      this.filteredComments = [];
      this.filteredLists = [];

      this.originalContentData = {
        reviews: [],
        comments: [],
        lists: []
      };
    }

    this.cdr.markForCheck();
  }

  get displayReviews(): any[] {
    return this.isContentFiltered ? this.filteredReviews : this.reviews;
  }

  get displayComments(): any[] {
    return this.isContentFiltered ? this.filteredComments : this.comments;
  }

  get displayLists(): any[] {
    return this.isContentFiltered ? this.filteredLists : this.lists;
  }

  // ===== BÚSQUEDA GLOBAL =====

  searchGlobally(): void {
    const searchTerm = this.userSearchForm.get('search')?.value?.trim().toLowerCase();
    const roleFilter = this.userSearchForm.get('role')?.value;
    const statusFilter = this.userSearchForm.get('status')?.value;

    console.log('Búsqueda global iniciada:', { searchTerm, roleFilter, statusFilter });

    if (!searchTerm && !roleFilter && !statusFilter) {
      this.restoreOriginalData();
      this.isGlobalSearch = false;
      return;
    }

    this.isGlobalSearch = true;

    if (this.originalUsers.length === 0) {
      this.originalUsers = [...this.users];
      this.originalReviews = [...this.reviews];
      this.originalComments = [...this.comments];
      this.originalLists = [...this.lists];
    }

    this.users = this.originalUsers.filter(user =>
      this.matchesGlobalFilter(user, searchTerm, roleFilter, statusFilter, 'user')
    );

    this.reviews = this.originalReviews.filter(review => {
      if (review.userId && review.userId.username) {
        return this.matchesGlobalFilter(review.userId, searchTerm, roleFilter, statusFilter, 'review');
      }
      return false;
    });

    this.comments = this.originalComments.filter(comment => {
      if (comment.userId && comment.userId.username) {
        return this.matchesGlobalFilter(comment.userId, searchTerm, roleFilter, statusFilter, 'comment');
      }
      return false;
    });

    this.lists = this.originalLists.filter(list => {
      if (list.userId && list.userId.username) {
        return this.matchesGlobalFilter(list.userId, searchTerm, roleFilter, statusFilter, 'list');
      }
      return false;
    });

    this.cdr.markForCheck();
  }


  /**
 * Ordena las fechas de menor a mayor y formatea para la gráfica
 */
private fixActivityChartDates(data: any[]): void {
  // 1. Ordenar por fecha
  const sortedData = data.sort((a, b) => {
    const dateA = new Date(a.date || a._id || a.day);
    const dateB = new Date(b.date || b._id || b.day);
    return dateA.getTime() - dateB.getTime();
  });
  
  // 2. Crear labels con fechas ordenadas
  const labels = sortedData.map(item => {
    const date = new Date(item.date || item._id || item.day);
    
    // Formatear según el período seleccionado
    if (this.selectedTimeRange === 'month') {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    } else if (this.selectedTimeRange === 'week') {
      return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    } else {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
  });
  
  // 3. Crear los datasets con datos ordenados
  this.activityTrendsChartData = {
    labels: labels,
    datasets: [
      {
        label: 'Reseñas',
        data: sortedData.map(item => item.reviews || item.newReviews || 0),
        backgroundColor: 'rgba(107, 119, 229, 0.8)',
        borderColor: 'rgba(107, 119, 229, 1)',
        borderWidth: 2
      },
      {
        label: 'Comentarios',
        data: sortedData.map(item => item.comments || item.newComments || 0),
        backgroundColor: 'rgba(0, 255, 176, 0.8)',
        borderColor: 'rgba(0, 255, 176, 1)',
        borderWidth: 2
      },
      {
        label: 'Likes',
        data: sortedData.map(item => item.likes || item.totalLikes || 0),
        backgroundColor: 'rgba(255, 193, 7, 0.8)',
        borderColor: 'rgba(255, 193, 7, 1)',
        borderWidth: 2
      }
    ]
  };
}

  private matchesGlobalFilter(user: any, searchTerm: string, roleFilter: string, statusFilter: string, type: string): boolean {
    if (searchTerm) {
      const matchesSearch =
        user.username?.toLowerCase().includes(searchTerm) ||
        user.email?.toLowerCase().includes(searchTerm);

      if (!matchesSearch) return false;
    }

    if (roleFilter && user.role !== roleFilter) {
      return false;
    }

    if (statusFilter) {
      const isActive = !user.isBanned;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'banned' && isActive) return false;
    }

    return true;
  }

  private restoreOriginalData(): void {
    if (this.originalUsers.length > 0) {
      this.users = [...this.originalUsers];
      this.reviews = [...this.originalReviews];
      this.comments = [...this.originalComments];
      this.lists = [...this.originalLists];

      this.originalUsers = [];
      this.originalReviews = [];
      this.originalComments = [];
      this.originalLists = [];
    }
    this.cdr.markForCheck();
  }

  // ===== BÚSQUEDA DE REPORTES =====

  searchReports(): void {
    console.log('Búsqueda de reportes iniciada');
    this.resetReportsPagination();
    this.loadReports();
  }

  clearReportSearch(): void {
    this.reportSearchForm.reset();
    this.resetReportsPagination();
    this.loadReports();
    console.log('Búsqueda de reportes limpiada');
  }

  private resetReportsPagination(): void {
    this.pagination.reports = { page: 1, total: 0, hasMore: false };
    this.reports = [];
  }

  private resetUsersPagination(): void {
    this.pagination.users = { page: 1, total: 0, hasMore: false };
    this.users = [];
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
  }

  openHistoryModal(user: any): void {
    this.modalData = {
      username: user.username,
      userId: user._id,
      moderationHistory: user.moderationHistory || []
    };

    this.showHistoryModal = true;
    this.closeOtherModals(['history']);
    this.cdr.markForCheck();
  }

  openReviewModal(review: any): void {
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
  }

  openResolveReportModal(report: AdminReport): void {
    this.modalData = { report };
    this.resolveReportForm.reset({
      action: '',
      notes: '',
      shouldNotify: true
    });
    this.showResolveReportModal = true;
    this.closeOtherModals(['resolveReport']);
    this.cdr.markForCheck();
    console.log('Abriendo modal de resolución para reporte:', report._id);
  }

  openReportDetailModal(report: AdminReport): void {
    this.modalData = { report };
    this.showReportDetailModal = true;
    this.closeOtherModals(['reportDetail']);
    this.cdr.markForCheck();
    console.log('Abriendo modal de detalles para reporte:', report._id);
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
    if (!except.includes('resolveReport')) {
      this.showResolveReportModal = false;
    }
    if (!except.includes('reportDetail')) {
      this.showReportDetailModal = false;
    }
  }

  closeModals(): void {
    this.showBanModal = false;
    this.showRoleModal = false;
    this.showDeleteModal = false;
    this.showHistoryModal = false;
    this.showReviewModal = false;
    this.closeReportModals();

    this.modalData = {};
    this.cdr.markForCheck();
  }

  closeReportModals(): void {
    this.showResolveReportModal = false;
    this.showReportDetailModal = false;
    this.cdr.markForCheck();
  }

  // ===== ACCIONES DE BAN =====

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

  loadMoreReports(): void {
    if (this.pagination.reports.hasMore && !this.loading.reports) {
      this.loadReports(this.pagination.reports.page + 1);
    }
  }

  // ===== GESTIÓN DE REPORTES =====

  resolveReport(): void {
    if (this.resolveReportForm.invalid || !this.modalData.report) {
      console.log('❌ Formulario de resolución inválido o falta reporte');
      return;
    }

    this.loading.resolvingReport = true;

    const formValue = this.resolveReportForm.value;
    const reportId = this.modalData.report._id;

    console.log('🔧 Resolviendo reporte:', {
      reportId: reportId,
      action: formValue.action,
      notes: formValue.notes,
      shouldNotify: formValue.shouldNotify
    });

    const resolveSub = this.adminService.resolveReport(reportId, {
      action: formValue.action,
      notes: formValue.notes,
      shouldNotify: formValue.shouldNotify
    }).subscribe({
      next: (response) => {
        this.closeReportModals();
        console.log('✅ Reporte resuelto correctamente:', response);

        const reportIndex = this.reports.findIndex(r => r._id === reportId);
        if (reportIndex !== -1) {
          this.reports[reportIndex].status = 'resolved';
          this.reports[reportIndex].resolution = {
            action: formValue.action,
            notes: formValue.notes,
            resolvedBy: {
              _id: this.currentUser?._id || '',
              username: this.currentUser?.username || ''
            },
            resolvedAt: new Date()
          };
        }

        let actionMessage = 'Reporte resuelto correctamente.';
        
        if (response.data?.actionTaken) {
          const actionDetails = [];
          
          if (response.data.notificationsSent?.includes('content_deletion')) {
            actionDetails.push('✅ Contenido eliminado');
          }
          if (response.data.notificationsSent?.includes('user_warning')) {
            actionDetails.push('⚠️ Usuario advertido');
          }
          if (response.data.notificationsSent?.includes('user_ban')) {
            actionDetails.push('🚫 Usuario baneado');
          }
          if (response.data.notificationsSent?.includes('reporter_resolution')) {
            actionDetails.push('📧 Reporter notificado');
          }

          if (actionDetails.length > 0) {
            actionMessage += '\n\nAcciones ejecutadas:\n' + actionDetails.join('\n');
          }
        }

        this.showSuccessNotification(actionMessage);
        this.loadReportStats();
        this.cdr.markForCheck();
      },
      error: (error: any) => {
        console.error('❌ Error resolviendo reporte:', error);
        this.showErrorNotification(`Error al resolver reporte: ${error.message}`);
      },
      complete: () => {
        this.loading.resolvingReport = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.add(resolveSub);
  }

  updateReportStatus(reportId: string, newStatus: string): void {
    console.log('🔄 Actualizando estado del reporte:', reportId, 'a', newStatus);

    const updateSub = this.adminService.updateReportStatus(reportId, {
      status: newStatus as any,
      notes: `Estado cambiado a ${newStatus} por ${this.currentUser?.username}`
    }).subscribe({
      next: (response) => {
        console.log('✅ Estado del reporte actualizado:', response);

        const reportIndex = this.reports.findIndex(r => r._id === reportId);
        if (reportIndex !== -1) {
          this.reports[reportIndex].status = newStatus as any;
          this.cdr.markForCheck();
        }

        this.loadReportStats();
        this.showSuccessNotification(`Estado del reporte actualizado a: ${this.getStatusDisplayText(newStatus)}`);
      },
      error: (error: any) => {
        console.error('❌ Error actualizando estado del reporte:', error);
        this.showErrorNotification(`Error al actualizar estado: ${error.message}`);
      }
    });

    this.subscriptions.add(updateSub);
  }

  private showSuccessNotification(message: string): void {
    console.log('✅ Éxito:', message);
    alert(message);
  }

  private showErrorNotification(message: string): void {
    console.error('❌ Error:', message);
    alert(message);
  }

  // ===== MÉTODOS AUXILIARES PARA REPORTES =====

  getContentTypeDisplayText(contentType: string): string {
    const typeMap: { [key: string]: string } = {
      'user': 'Perfil de usuario',
      'review': 'Reseña',
      'comment': 'Comentario',
      'list': 'Lista personalizada'
    };
    return typeMap[contentType] || contentType;
  }

  getActionDisplayText(action: string): string {
    const actionMap: { [key: string]: string } = {
      'no_action': 'Sin acción',
      'content_deleted': 'Contenido eliminado',
      'user_warned': 'Usuario advertido',
      'user_banned': 'Usuario baneado',
      'other': 'Otra acción'
    };
    return actionMap[action] || action;
  }

  getStatusDisplayText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pendiente',
      'under_review': 'En revisión',
      'resolved': 'Resuelto',
      'dismissed': 'Descartado'
    };
    return statusMap[status] || status;
  }

  getPriorityClass(priority: string): string {
    const priorityClasses: { [key: string]: string } = {
      'low': 'priority-low',
      'medium': 'priority-medium',
      'high': 'priority-high',
      'urgent': 'priority-urgent'
    };
    return priorityClasses[priority] || 'priority-medium';
  }

  getReportStatusClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'pending': 'status-pending',
      'under_review': 'status-under-review',
      'resolved': 'status-resolved',
      'dismissed': 'status-dismissed'
    };
    return statusClasses[status] || 'status-pending';
  }

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

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

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

  formatShortDate(date: Date | string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit'
    });
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

  // ===== MÉTODOS DE LIMPIEZA Y OPTIMIZACIÓN =====

  /**
   * Limpia recursos para evitar memory leaks
   */
  private cleanupResources(): void {
    this.clearPosterCache();
    this.subscriptions.unsubscribe();
    
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }

    // Limpiar datos de películas
    this._topMovies = [];
    this._enhancedTopMovies = [];
    
    console.log('Dashboard component destroyed, resources cleaned');
  }

  /**
   * Método para limpiar datos de películas
   */
  clearMoviesData(): void {
    this._topMovies = [];
    this._enhancedTopMovies = [];
    this.clearPosterCache();
  }

  /**
   * Método para obtener películas con filtros
   */
  getFilteredTopMovies(filter?: 'trending' | 'highest-rated' | 'most-reviewed'): any[] {
    if (!filter) return this.topMovies;
    
    const movies = [...this.topMovies];
    
    switch (filter) {
      case 'trending':
        return movies.sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
      
      case 'highest-rated':
        return movies.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
      
      case 'most-reviewed':
        return movies.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
      
      default:
        return movies;
    }
  }

  /**
   * Método para buscar una película específica
   */
  findMovieById(movieId: string | number): any | null {
    return this.topMovies.find(movie => 
      movie.movieId.toString() === movieId.toString()
    ) || null;
  }

  /**
   * Método para refrescar solo las películas sin recargar todo el dashboard
   */
  refreshMoviesOnly(): void {
    if (this.dashboardData?.charts?.topMovies) {
      this.updateTopMoviesFromDashboard();
      console.log('Películas populares refrescadas');
    }
  }

  /**
   * Obtiene el color del badge de ranking basado en la posición
   */
  getRankingBadgeSeverity(position: number): 'success' | 'info' | 'warn' | 'danger' {
    if (position === 1) return 'warn'; // Oro
    if (position <= 3) return 'info';  // Plata/Bronce
    if (position <= 5) return 'success'; // Verde
    return 'danger'; // Resto
  }

  /**
   * Obtiene la clase CSS para el icono de tendencia
   */
  getTrendingIconClass(trendingScore: number): string {
    if (trendingScore > 50) return 'pi pi-arrow-up text-green-500';
    if (trendingScore > 20) return 'pi pi-arrow-up text-yellow-500';
    if (trendingScore > 0) return 'pi pi-minus text-blue-500';
    return 'pi pi-arrow-down text-red-500';
  }

  /**
   * Verifica si una película está en tendencia
   */
  isMovieTrending(movie: any): boolean {
    return movie.trendingScore && movie.trendingScore > 30;
  }

  // Métodos necesarios para la nueva sección
getReviewTrend(): number {
  // Calcular tendencia de reseñas vs período anterior
  return Math.random() * 20 - 10; // Placeholder
}

getCommentTrend(): number {
  // Calcular tendencia de comentarios vs período anterior  
  return Math.random() * 30 - 15; // Placeholder
}

getPeriodMultiplier(): number {
  switch(this.selectedTimeRange) {
    case 'today': return 1;
    case 'week': return 7;
    case 'month': return 30;
    default: return 7;
  }
}

getLikesPerDay(): number {
  const total = this.dashboardData?.today.totalLikes || 0;
  const multiplier = this.getPeriodMultiplier();
  return Math.round((total * multiplier) / multiplier);
}

getEngagementRate(): number {
  const reviews = this.dashboardData?.period.newReviews || 0;
  const users = this.dashboardData?.overview.totalUsers || 1;
  return Math.round((reviews / users) * 100);
}

getActivityScore(): number {
  const engagement = this.getEngagementRate();
  const growth = Math.abs(this.activityGrowthPercentage);
  return Math.min(100, Math.round((engagement + growth) / 2));
}

getMostActiveDay(): string {
  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  return days[Math.floor(Math.random() * days.length)];
}

getDailyAverage(): number {
  const reviews = this.dashboardData?.period.newReviews || 0;
  const comments = this.dashboardData?.period.newComments || 0;
  const days = this.getPeriodMultiplier();
  return Math.round((reviews + comments) / days);
}

  exportActivityData(): void {
    console.log('Exportando datos de actividad...');

    if (!this.activityTrendsChartData || !this.activityTrendsChartData.labels.length) {
      alert('No hay datos de tendencias de actividad para exportar.');
      return;
    }

    try {
      // 1. Extraer datos de la gráfica
      const labels = this.activityTrendsChartData.labels;
      const reviewsData = this.activityTrendsChartData.datasets.find((d: any) => d.label === 'Reseñas')?.data || [];
      const commentsData = this.activityTrendsChartData.datasets.find((d: any) => d.label === 'Comentarios')?.data || [];

      // 2. Mapear los datos de la gráfica a un formato estructurado
      const trendData = labels.map((label: any, index: any) => ({
        periodo: label,
        reseñas: reviewsData[index] || 0,
        comentarios: commentsData[index] || 0,
      }));

      // 3. Añadir las métricas de resumen como una sección separada en el mismo CSV.
      // Para hacerlo más legible, añadimos cabeceras de sección.
      let csvContent = this.convertToCSV(trendData);
      
      csvContent += '\n\n'; // Espacio entre secciones
      csvContent += 'Métricas de Resumen del Período\n'; // Título de la sección

      if (this.dashboardData) {
        const summaryData = [
          { metrica: 'Total Reseñas en Período', valor: this.dashboardData.period.newReviews },
          { metrica: 'Tendencia de Reseñas', valor: `${this.formatPercentage(this.getReviewTrend())} vs anterior` },
          { metrica: 'Total Comentarios en Período', valor: this.dashboardData.period.newComments },
          { metrica: 'Tendencia de Comentarios', valor: `${this.formatPercentage(this.getCommentTrend())} vs anterior` },
          { metrica: 'Tasa de Engagement', valor: `${this.getEngagementRate()}%` },
          { metrica: 'Activity Score', valor: `${this.getActivityScore()}/100` },
          { metrica: 'Día más activo', valor: this.getMostActiveDay() },
          { metrica: 'Promedio diario interacciones', valor: this.getDailyAverage() }
        ];
        csvContent += this.convertToCSV(summaryData);
      }
      
      // 4. Crear y descargar el blob CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `tendencias-actividad-${this.getCurrentDateString()}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('Archivo CSV de actividad descargado exitosamente');

    } catch (error) {
      console.error('Error exportando datos de actividad:', error);
      alert('Error al exportar los datos de actividad. Intenta de nuevo.');
    }
  }

getMoviePoster(movieId: string | number): string {
  const id = movieId.toString();
  
  // Si ya está cargado, devolverlo
  if (this.moviePostersCache.has(id)) {
    return this.moviePostersCache.get(id)!;
  }
  
  // Si está cargando o falló, devolver placeholder
  const loadingState = this.posterLoadingStates.get(id);
  if (loadingState === 'loading' || loadingState === 'error') {
    return this.buildPosterUrl(id);
  }
  
  // Marcar como cargando
  this.posterLoadingStates.set(id, 'loading');
  
  // Cargar de forma asíncrona
  this.peliculaService.getDetallesPelicula(id).subscribe({
    next: (movie) => {
      if (movie?.poster_path) {
        const posterUrl = `https://image.tmdb.org/t/p/w300${movie.poster_path}`;
        this.moviePostersCache.set(id, posterUrl);
        this.posterLoadingStates.set(id, 'loaded');
        
        // IMPORTANTE: Forzar actualización de la vista
        this.cdr.detectChanges();
      } else {
        this.handlePosterError(id);
      }
    },
    error: () => {
      this.handlePosterError(id);
    }
  });
  
  return this.buildPosterUrl(id);
}

private handlePosterError(movieId: string): void {
  this.posterErrors.add(movieId);
  this.posterLoadingStates.set(movieId, 'error');
  this.moviePostersCache.set(movieId, this.buildPosterUrl(movieId));
  this.cdr.detectChanges();
}



// 4. MÉTODO HELPER 
private buildPosterUrl(movieId: string): string {
  const colors = ['4338ca', '059669', 'dc2626', 'ea580c', '7c3aed', 'db2777'];
  const colorIndex = parseInt(movieId) % colors.length;
  const color = colors[colorIndex];
  return `https://via.placeholder.com/300x450/${color}/ffffff?text=ID+${movieId}`;
}

// 5. MÉTODO ADICIONAL PARA DEBUGGING - VER QUÉ PELÍCULAS ESTÁN FALLANDO
debugMoviePosters(): void {
  console.log('🎭 Estado del cache de posters:');
  console.log('Cache size:', this.moviePostersCache.size);
  console.log('Errores:', Array.from(this.posterErrors));
  console.log('Películas en topMovies:', this.topMovies.map(m => m.movieId));
  
  // Probar una película específica manualmente
  if (this.topMovies.length > 0) {
    const testId = this.topMovies[0].movieId;
    console.log(`🔍 Probando película ${testId}...`);
    
    this.peliculaService.getDetallesPelicula(testId.toString()).subscribe({
      next: (movie) => {
        console.log(`✅ Resultado para ${testId}:`, movie);
      },
      error: (error) => {
        console.error(`❌ Error para ${testId}:`, error);
      }
    });
  }
}


getResponsiveChartOptions(chartType: 'line' | 'bar' | 'doughnut'): any {
  const isMobile = window.innerWidth <= 768;
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: !isMobile || chartType === 'doughnut',
        position: isMobile ? 'bottom' : 'top',
        labels: {
          font: { size: isMobile ? 10 : 12 }
        }
      }
    },
    scales: chartType !== 'doughnut' ? {
      x: {
        ticks: { font: { size: isMobile ? 9 : 11 } }
      },
      y: {
        ticks: { font: { size: isMobile ? 9 : 11 } }
      }
    } : undefined
  };
}
}