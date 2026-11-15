import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import { Router, RouterLink } from '@angular/router';

import {
  AuthService,
  Perfil,
} from '../../core/services/auth.service';

import {
  ReservasService,
  ResumenProfesor,
} from '../../core/services/reservas.service';

@Component({
  selector: 'app-profesor',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './profesor.html',
  styleUrl: './profesor.scss',
})
export class Profesor implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly reservasService = inject(ReservasService);

  readonly perfil = signal<Perfil | null>(null);
  readonly resumen = signal<ResumenProfesor | null>(null);

  readonly cargando = signal(true);
  readonly cargandoResumen = signal(false);
  readonly cerrandoSesion = signal(false);

  readonly error = signal('');
  readonly errorResumen = signal('');

  get iniciales(): string {
    const nombre = this.perfil()?.nombre.trim();

    if (!nombre) {
      return 'P';
    }

    return nombre
      .split(/\s+/)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0))
      .join('')
      .toUpperCase();
  }

  async ngOnInit(): Promise<void> {
    try {
      const perfil = await this.auth.obtenerPerfil();

      if (perfil.rol !== 'profesor') {
        await this.router.navigateByUrl('/panel');
        return;
      }

      this.perfil.set(perfil);

      await this.cargarResumen();
    } catch {
      this.error.set(
        'No fue posible cargar el perfil. Recarga la página para intentar nuevamente.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  async cargarResumen(): Promise<void> {
    if (this.cargandoResumen()) {
      return;
    }

    this.cargandoResumen.set(true);
    this.errorResumen.set('');

    try {
      const resumen = await this.reservasService.obtenerResumen();

      this.resumen.set(resumen);
    } catch {
      this.errorResumen.set(
        'No fue posible actualizar el resumen. Intenta nuevamente.',
      );
    } finally {
      this.cargandoResumen.set(false);
    }
  }

  async cerrarSesion(): Promise<void> {
    if (this.cerrandoSesion()) {
      return;
    }

    this.cerrandoSesion.set(true);
    this.error.set('');

    try {
      await this.auth.cerrarSesion();

      await this.router.navigateByUrl('/login');
    } catch {
      this.error.set(
        'No fue posible cerrar sesión. Intenta nuevamente.',
      );
    } finally {
      this.cerrandoSesion.set(false);
    }
  }
}