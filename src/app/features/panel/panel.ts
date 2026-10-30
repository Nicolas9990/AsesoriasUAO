import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-panel',
  standalone: true,
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
})
export class Panel implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly correo = signal('');
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const session = await this.auth.obtenerSesion();
      this.correo.set(session?.user.email ?? '');
    } catch {
      this.error.set('No fue posible cargar la sesión.');
    }
  }

  async salir(): Promise<void> {
    this.error.set('');

    try {
      await this.auth.cerrarSesion();
      await this.router.navigateByUrl('/login');
    } catch {
      this.error.set('No fue posible cerrar sesión. Intenta nuevamente.');
    }
  }
}