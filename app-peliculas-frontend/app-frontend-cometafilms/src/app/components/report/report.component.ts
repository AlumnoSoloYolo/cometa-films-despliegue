import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';

import { ReportService, CreateReportRequest } from '../../services/report.service';

export interface ReportModalData {
  targetUser: {
    _id: string;
    username: string;
    avatar: string;
  };
  contentType: 'user' | 'review' | 'comment' | 'list';
  contentId?: string;
}

@Component({
  selector: 'app-report-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './report.component.html',
  styleUrls: ['./report.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportModalComponent implements OnInit {
  @Input() showModal = false;
  @Input() reportData: ReportModalData | null = null;
  @Output() modalClosed = new EventEmitter<void>();
  @Output() reportSubmitted = new EventEmitter<void>();

  reportForm!: FormGroup;
  submitting = false;

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly reportService: ReportService,
    private readonly cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.createForm();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private createForm(): void {
    this.reportForm = this.fb.group({
      reason: ['', [Validators.required]],
      description: ['', [Validators.maxLength(1000)]]
    });
  }

  get targetUser() {
    return this.reportData?.targetUser || { _id: '', username: '', avatar: '' };
  }

  getContentTypeText(): string {
    if (!this.reportData) return '';

    const typeMap: { [key: string]: string } = {
      'user': 'perfil de usuario',
      'review': 'reseña',
      'comment': 'comentario',
      'list': 'lista personalizada'
    };

    return typeMap[this.reportData.contentType] || 'contenido';
  }

  getAvatarPath(avatar: string): string {
    return `/avatares/${avatar}.gif`;
  }

  closeModal(): void {
    if (this.submitting) return;

    this.reportForm.reset();
    this.modalClosed.emit();
  }

  submitReport(): void {
    if (this.reportForm.invalid || !this.reportData || this.submitting) {
      return;
    }

    this.submitting = true;
    this.cdr.markForCheck();

    const formValue = this.reportForm.value;

    const reportRequest: CreateReportRequest = {
      reportedUserId: this.reportData.targetUser._id,
      contentType: this.reportData.contentType,
      contentId: this.reportData.contentId,
      reason: formValue.reason,
      description: formValue.description?.trim() || undefined
    };

    console.log('Enviando reporte:', reportRequest);

    const reportSub = this.reportService.createReport(reportRequest).subscribe({
      next: (response) => {
        console.log('Reporte enviado exitosamente:', response);

        // Mostrar mensaje de éxito
        this.showSuccessMessage();

        // Cerrar modal y notificar
        this.reportForm.reset();
        this.submitting = false;
        this.reportSubmitted.emit();
        this.modalClosed.emit();
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error al enviar reporte:', error);
        this.submitting = false;
        this.cdr.markForCheck();

        // Mostrar mensaje de error
        this.showErrorMessage(error);
      }
    });

    this.subscriptions.add(reportSub);
  }

  private showSuccessMessage(): void {
    // Implementar notificación de éxito (puedes usar un servicio de toast/notificaciones)
    alert('Reporte enviado correctamente. Será revisado por nuestro equipo de moderación.');
  }

  private showErrorMessage(error: any): void {
    let message = 'Error al enviar el reporte. Por favor, inténtalo de nuevo.';

    if (error.error?.message) {
      message = error.error.message;
    } else if (error.status === 409) {
      message = 'Ya has reportado este contenido anteriormente.';
    } else if (error.status === 400) {
      message = 'Datos del reporte inválidos. Revisa la información.';
    } else if (error.status === 404) {
      message = 'El usuario o contenido no fue encontrado.';
    }

    alert(message);
  }

  // Métodos para uso en el template
  onOverlayClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  preventPropagation(event: Event): void {
    event.stopPropagation();
  }
}