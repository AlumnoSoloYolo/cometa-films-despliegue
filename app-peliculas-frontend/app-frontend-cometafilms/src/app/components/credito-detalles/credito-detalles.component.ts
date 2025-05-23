import { Component, OnInit } from '@angular/core';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { PeliculasService } from '../../services/peliculas.service';
import { CommonModule } from '@angular/common';
import { PeliculaCardComponent } from '../pelicula-card/pelicula-card.component';

@Component({
  selector: 'app-credito-detalles',
  standalone: true,
  imports: [RouterModule, CommonModule, PeliculaCardComponent],
  templateUrl: './credito-detalles.component.html',
  styleUrl: './credito-detalles.component.css'
})
export class CreditoDetallesComponent implements OnInit {

  person: any = {}

  constructor(private pelisService: PeliculasService, private route: ActivatedRoute) {
    window.scrollTo({
      top: -100,
      left: 0,
      behavior: 'smooth'
    });
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      this.cargarDetallesPersona(id);
    });
    window.scrollTo({
      top: -100,
      left: 0,
      behavior: 'smooth'
    });

  }

  cargarDetallesPersona(id: string): void {
    this.pelisService.getDetallesPersona(id).subscribe({
      next: (data) => {
        this.person = data;
        // console.log(data)
      },
      error: (error) => {
        console.error("No se ha podido cargar los detalles de la perosna", error)
      }
    })
  }




  scrollSection(sectionId: string, direction: 'left' | 'right'): void {
    const container = document.getElementById(sectionId);
    if (!container) return;

    const scrollContenido = container.querySelector('.movie-scroll-content');
    if (!scrollContenido) return;

    const itemAncho = scrollContenido.querySelector('.movie-scroll-item')?.clientWidth || 300;
    const scrollCantidad = itemAncho * 2;
    const scrollActual = scrollContenido.scrollLeft;

    let newScroll = direction === 'right'
      ? scrollActual + scrollCantidad
      : scrollActual - scrollCantidad;

    scrollContenido.scrollTo({
      left: newScroll,
      behavior: 'smooth'
    });
  }
}
