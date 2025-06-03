import { Component, Input, Output, OnInit, EventEmitter, OnDestroy } from '@angular/core';
import { VotoColorPipe } from '../../shared/pipes/voto-color.pipe';
import { CommonModule } from '@angular/common';
import { PeliculasService } from '../../services/peliculas.service';
import { RouterModule } from '@angular/router';
import { UserMovieService } from '../../services/user.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-pelicula-card',
  standalone: true,
  imports: [VotoColorPipe, CommonModule, RouterModule],
  templateUrl: './pelicula-card.component.html',
  styleUrls: ['./pelicula-card.component.css']
})
export class PeliculaCardComponent implements OnInit, OnDestroy {

  @Input() pelicula: any;
  @Input() showActionButtons: boolean = true;
  @Input() userProfileData: any = null;
  @Input() skipProfileLoad: boolean = false;

  listaGeneros: any[] = [];
  vista = false;
  pendiente = false;
  userProfile: any = null;

  @Output() peliculaVistaAgregada = new EventEmitter<string>();
  @Output() peliculaVistaEliminada = new EventEmitter<string>();
  @Output() peliculaPendienteAgregada = new EventEmitter<string>();
  @Output() peliculaPendienteEliminada = new EventEmitter<string>();

  private generosSubscription?: Subscription;

  constructor(
    private pelisService: PeliculasService,
    private userService: UserMovieService
  ) { }

  ngOnInit(): void {
    this.loadGeneros();

    if (this.showActionButtons) {
      if (this.userProfileData) {
        this.userProfile = this.userProfileData;
        this.checkEstados();
      } else if (!this.skipProfileLoad) {
        this.cargarPerfilUsuario();
      }
    }
  }

  ngOnDestroy(): void {
    if (this.generosSubscription) {
      this.generosSubscription.unsubscribe();
    }
  }

  private cargarPerfilUsuario(): void {
    this.userService.getUserPerfil().subscribe({
      next: (perfil) => {
        this.userProfile = perfil;
        this.checkEstados();
      },
      error: (error) => console.error('Error al obtener perfil de usuario', error),
    });
  }

  private checkEstados(): void {
    if (!this.userProfile) return;

    const movieIdString = this.pelicula.id.toString();
    this.vista = this.userProfile.pelisVistas.some((peli: any) => peli.movieId === movieIdString);
    this.pendiente = this.userProfile.pelisPendientes.some((peli: any) => peli.movieId === movieIdString);
  }

  private loadGeneros(): void {
    const cachedGeneros = this.pelisService.getGenerosSync();
    if (cachedGeneros.length > 0) {
      this.listaGeneros = cachedGeneros;
      return;
    }

    this.generosSubscription = this.pelisService.generos$.subscribe({
      next: (generos) => {
        if (generos.length > 0) {
          this.listaGeneros = generos;
        }
      }
    });

    if (cachedGeneros.length === 0) {
      this.pelisService.getGeneros().subscribe({
        next: (response) => {
          this.listaGeneros = response.genres || [];
        },
        error: (error) => console.error("Error al consultar géneros", error)
      });
    }
  }

  nombreGeneros(genero_id: number): string {
    return this.listaGeneros.find(genero => genero.id === genero_id)?.name || '';
  }

  toggleVista(event: Event): void {
    event.stopPropagation();
    this.vista ? this.removeFromVistas() : this.addToVistas();
  }

  togglePendiente(event: Event): void {
    event.stopPropagation();
    this.pendiente ? this.removeFromPendientes() : this.addToPendientes();
  }

  private addToVistas(): void {
    const movieIdString = this.pelicula.id.toString();

    this.userService.addPelisVistas(movieIdString).subscribe({
      next: () => {

        this.vista = true;
        this.pendiente = false;

        this.peliculaVistaAgregada.emit(movieIdString);

      },
      error: (error) => {
        console.error('Error al añadir a vistas:', error);
      }
    });
  }

  private removeFromVistas(): void {
    const movieIdString = this.pelicula.id.toString();


    this.userService.removePelisVistas(movieIdString).subscribe({
      next: () => {

        this.vista = false;

        this.peliculaVistaEliminada.emit(movieIdString);
      },
      error: (error) => {
        console.error('Error al eliminar de vistas:', error);
      }
    });
  }

  private addToPendientes(): void {
    const movieIdString = this.pelicula.id.toString();

    this.userService.addPelisPendientes(movieIdString).subscribe({
      next: () => {

        this.pendiente = true;
        this.vista = false;

        this.peliculaPendienteAgregada.emit(movieIdString);

      },
      error: (error) => {
        console.error('Error al añadir a pendientes:', error);

      }
    });
  }

  private removeFromPendientes(): void {
    const movieIdString = this.pelicula.id.toString();

    this.userService.removePelisPendientes(movieIdString).subscribe({
      next: () => {

        this.pendiente = false;

        this.peliculaPendienteEliminada.emit(movieIdString);

      },
      error: (error) => {
        console.error('Error al eliminar de pendientes:', error);
      }
    });
  }
}