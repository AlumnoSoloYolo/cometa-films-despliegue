import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'truncate',
  standalone: true // Importante para poder usarlo en componentes standalone
})
export class TruncatePipe implements PipeTransform {

  /**
   * Trunca un texto si excede una longitud máxima.
   * @param value El texto a truncar.
   * @param limit La longitud máxima antes de truncar. Por defecto es 20.
   * @param ellipsis El sufijo a añadir al texto truncado. Por defecto es '...'.
   * @returns El texto original o el texto truncado.
   */
  transform(value: string, limit: number = 20, ellipsis: string = '...'): string {
    if (!value || typeof value !== 'string') {
      return '';
    }

    return value.length > limit ? value.substring(0, limit) + ellipsis : value;
  }
}