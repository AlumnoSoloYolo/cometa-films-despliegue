// ruta: alumnosoloyolo/cometa-films-despliegue/cometa-films-despliegue-7f6577b5729d77469e59291a26ba2ec93dafde3c/app-peliculas-frontend/app-frontend-cometafilms/src/app/components/fondo/fondo.component.ts
import { Component, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, NgZone } from '@angular/core';

interface Star {
  x: number;
  y: number;
  baseRadius: number;
  currentCoreRadius: number;
  alpha: number;
  color: string; // Color del resplandor de la estrella

  phase: number;
  phaseSpeed: number;
  initialDelayFrames: number;
}

@Component({
  selector: 'app-fondo',
  standalone: true,
  templateUrl: './fondo.component.html',
  styleUrls: ['./fondo.component.css']
})
export class FondoComponent implements OnInit, OnDestroy {
  @ViewChild('starCanvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D | null;
  private stars: Star[] = [];
  private numStars: number = 1000;
  private animationFrameId?: number;

  private readonly FPS = 60;

  private config = {
    // Paleta de colores para el RESPLANDOR, con tintes más definidos y distribución ajustada
    colors: [
      '#FFFFFF', '#FFFFFF',                           // ~20% Resplandor blanco (para estrellas puramente blancas)
      '#AEC6CF', '#AEC6CF', '#AEC6CF',               // ~30% "Pastel Blue" o similar (un azul pálido pero visible)
      '#FFFAC8', '#FFFAC8', '#FFFAC8',               // ~30% "Lemon Chiffon" aclarado (amarillo pálido cálido y visible)
       '#a3d8ff', '#a3d8ff', '#a3d8ff',               // ~23% NUEVO: Azul Hielo Estelar
      '#ffe699', '#ffe699', '#ffe699' 
      // Nota: Eliminamos los verdes/lavandas muy oscuros o difíciles de percibir como "luz"
    ],
    minBaseRadius: 0.05,
    maxBaseRadius: 0.25,

    opacityRange: { min: 0.25, max: 0.65 }, // Permitir que la opacidad suba un poco más
    scaleRange: { min: 0.3, max: 1.1 },   // Rango de pulso amplio

    minPhaseSpeed: 0.00007,
    maxPhaseSpeed: 0.0055,

    maxInitialDelaySeconds: 12,
  };

  constructor(private ngZone: NgZone) { }

  ngOnInit(): void {
    const canvas = this.canvasRef.nativeElement;
    if (!canvas) { console.error('Canvas no encontrado.'); return; }
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) { console.error('Error al obtener contexto 2D.'); return; }

    this.resizeCanvas();
    this.initializeStars();
    this.ngZone.runOutsideAngular(() => {
      this.animateStars();
    });
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.stars = [];
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.resizeCanvas();
    this.initializeStars();
  }

  private resizeCanvas(): void {
    if (this.canvasRef?.nativeElement && this.ctx) {
      const canvas = this.canvasRef.nativeElement;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  private initializeStars(): void {
    this.stars = [];
    if (!this.canvasRef?.nativeElement) return;

    const canvasWidth = this.canvasRef.nativeElement.width;
    const canvasHeight = this.canvasRef.nativeElement.height;

    for (let i = 0; i < this.numStars; i++) {
      const baseRadius = Math.random() * (this.config.maxBaseRadius - this.config.minBaseRadius) + this.config.minBaseRadius;
      const initialDelayInSeconds = Math.random() * this.config.maxInitialDelaySeconds;

      this.stars.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        baseRadius: baseRadius,
        currentCoreRadius: baseRadius * this.config.scaleRange.min,
        alpha: this.config.opacityRange.min,
        color: this.config.colors[Math.floor(Math.random() * this.config.colors.length)],
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: Math.random() * (this.config.maxPhaseSpeed - this.config.minPhaseSpeed) + this.config.minPhaseSpeed,
        initialDelayFrames: Math.round(initialDelayInSeconds * this.FPS),
      });
    }
  }

  private updateAndDrawStar(star: Star): void {
    if (!this.ctx) return;

    if (star.initialDelayFrames > 0) {
      star.initialDelayFrames--;
      const initialScale = this.config.scaleRange.min * 0.2; // Aún más pequeñas durante el delay
      const initialRadius = star.baseRadius * initialScale;
      this.drawActualStarShape(star.x, star.y, Math.max(0.01, initialRadius), this.config.opacityRange.min * 0.2, star.color);
      return;
    }

    star.phase += star.phaseSpeed;
    if (star.phase >= Math.PI * 2) {
      star.phase -= Math.PI * 2;
    }

    const animationProgress = (1 - Math.cos(star.phase)) / 2;

    star.alpha = this.config.opacityRange.min + (this.config.opacityRange.max - this.config.opacityRange.min) * animationProgress;

    const currentScale = this.config.scaleRange.min + (this.config.scaleRange.max - this.config.scaleRange.min) * animationProgress;
    star.currentCoreRadius = star.baseRadius * currentScale;
    star.currentCoreRadius = Math.max(0.01, star.currentCoreRadius); // Núcleo mínimo absoluto

    this.drawActualStarShape(star.x, star.y, star.currentCoreRadius, star.alpha, star.color);
  }

  private drawActualStarShape(x: number, y: number, coreRadius: number, alpha: number, glowHexColor: string): void {
    if (!this.ctx) return;

    const glowRadiusMultiplier = 6; // Reducimos un poco el multiplicador para que el color no se disperse tanto
    const minGlowRadius = 0.3;   // Resplandor mínimo
    const glowRadius = Math.max(coreRadius * glowRadiusMultiplier, minGlowRadius);

    const gradientInnerRadiusStop = 0.05; // El núcleo blanco puro es muy pequeño (5% del radio del gradiente)
    const glowColorStartStop = 0.15;   // El color del resplandor empieza muy cerca del núcleo
    const glowColorFullStop = 0.5;   // El color del resplandor está a plena intensidad aquí

    const gradient = this.ctx.createRadialGradient(
      x, y, Math.max(0.01, coreRadius * gradientInnerRadiusStop),
      x, y, glowRadius
    );

    // Núcleo del gradiente: blanco puro y opaco
    gradient.addColorStop(0, `rgba(255, 255, 255, 1)`);
    // Transición rápida al color del resplandor
    gradient.addColorStop(glowColorStartStop, `rgba(255, 255, 255, 0.7)`); // Blanco se difumina un poco
    gradient.addColorStop(glowColorFullStop, glowHexColor); // Color del resplandor a su "plenitud"
    // Desvanecimiento del color del resplandor a transparente
    gradient.addColorStop(1, this.hexToRgba(glowHexColor, 0));

    this.ctx.beginPath();
    this.ctx.arc(x, y, glowRadius, 0, Math.PI * 2, false);
    this.ctx.fillStyle = gradient;
    this.ctx.globalAlpha = alpha;
    this.ctx.fill();
  }

  private hexToRgba(hex: string, alphaValue: number): string {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    return `rgba(${r},${g},${b},${alphaValue})`;
  }

  private animateStars(): void {
    if (!this.ctx || !this.canvasRef?.nativeElement) {
      this.animationFrameId = requestAnimationFrame(() => this.animateStars());
      return;
    }

    this.ctx.clearRect(0, 0, this.canvasRef.nativeElement.width, this.canvasRef.nativeElement.height);
    this.ctx.globalAlpha = 1.0;

    for (const star of this.stars) {
      this.updateAndDrawStar(star);
    }

    this.animationFrameId = requestAnimationFrame(() => this.animateStars());
  }
}