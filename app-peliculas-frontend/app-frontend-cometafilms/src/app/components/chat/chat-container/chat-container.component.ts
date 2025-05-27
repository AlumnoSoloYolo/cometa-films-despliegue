import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { ChatListComponent } from '../chat-list/chat-list.component';

@Component({
  selector: 'app-chat-container',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, ChatListComponent],
  templateUrl: './chat-container.component.html',
  styleUrl: './chat-container.component.css'
})
export class ChatContainerComponent {
  
  hasActiveChat(): boolean {
    // Verificar si hay una ruta activa de chat
    return window.location.pathname.includes('/chat/');
  }
}