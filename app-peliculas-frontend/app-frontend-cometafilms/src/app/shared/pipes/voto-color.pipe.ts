import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'votoColor',
  standalone: true
})
export class VotoColorPipe implements PipeTransform {
  transform(rating: number): string {

    if (rating <= 5) {
      const rojo = 255;
      const verde = Math.round(255 * (rating / 5));
      return `rgb(${rojo}, ${verde}, 0)`;
    } else {
      const rojo = Math.round(255 * (1 - (rating - 5) / 5));
      const verde = 255;
      return `rgb(${rojo}, ${verde}, 0)`;
    }
  }
}