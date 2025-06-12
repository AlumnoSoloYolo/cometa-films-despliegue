// ARCHIVO: components/like-button/like-button.component.spec.ts

import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LikeButtonComponent } from './like-button.component';
import { LikeService } from '../../services/like.service';
import { AuthService } from '../../services/auth.service';

// --- Mocks de los Servicios ---
// Creamos objetos espía (spies) para simular los servicios.
// Esto nos permite controlar lo que devuelven sus métodos y verificar si son llamados,
// sin depender de la implementación real de los servicios.
const mockLikeService = jasmine.createSpyObj('LikeService', ['checkLike', 'getLikeCount', 'toggleLike', 'getLikeUsers']);
const mockAuthService = jasmine.createSpyObj('AuthService', ['isAuthenticated']);
const mockRouter = jasmine.createSpyObj('Router', ['navigate']);

describe('LikeButtonComponent', () => {
  let component: LikeButtonComponent;
  let fixture: ComponentFixture<LikeButtonComponent>;

  // --- Configuración del Entorno de Pruebas ---
  // beforeEach se ejecuta antes de cada prueba (cada bloque 'it').
  beforeEach(async () => {
    // TestBed es la principal utilidad de Angular para configurar un entorno de pruebas.
    // Creamos un módulo de prueba que imita el @NgModule de nuestra aplicación.
    await TestBed.configureTestingModule({
      imports: [LikeButtonComponent], // Importamos el componente a probar.
      providers: [
        // Proveemos las versiones "mock" de los servicios.
        // Cuando el componente pida AuthService, Angular le dará nuestro mockAuthService.
        { provide: AuthService, useValue: mockAuthService },
        { provide: LikeService, useValue: mockLikeService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents(); // Compila las plantillas y estilos del componente.

    // Creamos una instancia del componente.
    // La 'fixture' es un envoltorio que nos permite interactuar con el componente y su plantilla.
    fixture = TestBed.createComponent(LikeButtonComponent);
    component = fixture.componentInstance; // La instancia de la clase del componente.

    // Asignamos los valores de entrada (@Input) necesarios para las pruebas.
    component.contentType = 'review';
    component.contentId = '123';

    // Restablecemos los espías antes de cada prueba para asegurar que los tests estén aislados.
    mockLikeService.checkLike.calls.reset();
    mockLikeService.getLikeCount.calls.reset();
    mockLikeService.toggleLike.calls.reset();
    mockRouter.navigate.calls.reset();
  });

  // --- Pruebas Unitarias ---

  it('debería crearse correctamente', () => {
    // La prueba más simple: verifica que el componente se instancia sin errores.
    expect(component).toBeTruthy();
  });

  describe('Inicialización (ngOnInit)', () => {
    it('debería obtener el estado del "like" y el contador si el usuario está autenticado', () => {
      // Preparamos los mocks para que devuelvan valores simulados.
      mockAuthService.isAuthenticated.and.returnValue(true);
      mockLikeService.checkLike.and.returnValue(of({ liked: true }));
      mockLikeService.getLikeCount.and.returnValue(of({ count: 10 }));

      // detectChanges() dispara el ciclo de vida de Angular, incluyendo ngOnInit.
      fixture.detectChanges();

      // Verificamos que los métodos del servicio fueron llamados.
      expect(mockLikeService.checkLike).toHaveBeenCalledWith('review', '123');
      expect(mockLikeService.getLikeCount).toHaveBeenCalledWith('review', '123');

      // Verificamos que las propiedades del componente se actualizaron correctamente.
      expect(component.isLiked).toBe(true);
      expect(component.likeCount).toBe(10);
    });

    it('no debería comprobar el estado del "like" si el usuario no está autenticado', () => {
      // Simulamos un usuario no autenticado.
      mockAuthService.isAuthenticated.and.returnValue(false);
      mockLikeService.getLikeCount.and.returnValue(of({ count: 5 }));

      fixture.detectChanges();

      // El contador de "likes" se debe obtener siempre.
      expect(mockLikeService.getLikeCount).toHaveBeenCalled();
      expect(component.likeCount).toBe(5);

      // Pero el estado del "like" del usuario no debe comprobarse.
      expect(mockLikeService.checkLike).not.toHaveBeenCalled();
      expect(component.isLiked).toBe(false);
    });
  });

  describe('Funcionalidad de "Like" (onLikeClick)', () => {
    // Usamos fakeAsync para controlar el paso del tiempo en pruebas asíncronas.
    it('debería cambiar el estado a "liked", incrementar el contador y llamar al servicio', fakeAsync(() => {
      // Estado inicial: no le ha gustado.
      component.isLiked = false;
      component.likeCount = 5;
      
      // Preparamos los mocks.
      mockAuthService.isAuthenticated.and.returnValue(true);
      // El servicio de "toggle" devuelve el nuevo estado.
      mockLikeService.toggleLike.and.returnValue(of({ liked: true, count: 6 }));

      // Simulamos el clic en el botón.
      component.onLikeClick(new MouseEvent('click'));
      
      // Verificamos la actualización optimista de la UI.
      expect(component.isLiked).toBe(true);
      expect(component.likeCount).toBe(6);
      expect(component.loading).toBe(true); // El componente debería estar en estado de carga.

      // tick() avanza el tiempo simulado, permitiendo que las operaciones asíncronas (como los Observables) se completen.
      tick();
      fixture.detectChanges();

      // Verificamos que se llamó al servicio con los parámetros correctos.
      expect(mockLikeService.toggleLike).toHaveBeenCalledWith('review', '123');
      expect(component.loading).toBe(false); // La carga debería haber terminado.
    }));

    it('debería revertir el estado si la llamada al servicio falla', fakeAsync(() => {
      component.isLiked = false;
      component.likeCount = 5;
      mockAuthService.isAuthenticated.and.returnValue(true);
      // Simulamos un error en el servicio.
      mockLikeService.toggleLike.and.returnValue(throwError(() => new Error('Error de red')));

      component.onLikeClick(new MouseEvent('click'));

      // Comprobamos la UI optimista.
      expect(component.isLiked).toBe(true);
      expect(component.likeCount).toBe(6);

      tick(); // Permitimos que la promesa del observable se rechace.
      fixture.detectChanges();

      // Verificamos que el estado se revirtió al original.
      expect(component.isLiked).toBe(false);
      expect(component.likeCount).toBe(5);
      expect(component.loading).toBe(false);
    }));

    it('debería navegar a /login si el usuario no está autenticado', () => {
      mockAuthService.isAuthenticated.and.returnValue(false);

      component.onLikeClick(new MouseEvent('click'));

      // Verificamos que se intentó navegar a la página de login.
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('Plantilla (HTML)', () => {
    it('debería mostrar un corazón relleno (bi-heart-fill) cuando isLiked es true', () => {
      component.isLiked = true;
      fixture.detectChanges(); // Actualizamos la plantilla.
      
      // nativeElement nos da acceso al DOM real.
      const buttonIcon = fixture.nativeElement.querySelector('.like-button i');
      expect(buttonIcon.classList).toContain('bi-heart-fill');
      expect(buttonIcon.classList).not.toContain('bi-heart');
    });

    it('debería mostrar el contador de "likes" si es mayor que cero', () => {
      component.likeCount = 15;
      fixture.detectChanges();
      
      const countElement = fixture.nativeElement.querySelector('.like-count');
      expect(countElement).toBeTruthy();
      expect(countElement.textContent.trim()).toBe('15');
    });

    it('no debería mostrar el contador si es cero', () => {
      component.likeCount = 0;
      fixture.detectChanges();
      
      const countElement = fixture.nativeElement.querySelector('.like-count');
      expect(countElement).toBeFalsy();
    });
  });
});