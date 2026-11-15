import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import { DatePipe } from '@angular/common';

import {
  FormBuilder,
  ReactiveFormsModule,
} from '@angular/forms';

import { Router, RouterLink } from '@angular/router';

import {
  AuthService,
  Perfil,
} from '../../core/services/auth.service';

import {
  AsesoriaDisponible,
  AsesoriasService,
  Materia,
} from '../../core/services/asesorias.service';

@Component({
  selector: 'app-estudiante',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    RouterLink,
  ],
  templateUrl: './estudiante.html',
  styleUrl: './estudiante.scss',
})
export class Estudiante implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly asesoriasService = inject(AsesoriasService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly perfil = signal<Perfil | null>(null);
  readonly materias = signal<Materia[]>([]);
  readonly asesorias = signal<AsesoriaDisponible[]>([]);

  readonly cargando = signal(true);
  readonly reservando = signal<string | null>(null);
  readonly cerrandoSesion = signal(false);

  readonly error = signal('');
  readonly mensaje = signal('');
  readonly seleccionada = signal<AsesoriaDisponible | null>(null);

  readonly filtros = this.fb.nonNullable.group({
    asignaturaId: [''],
    fecha: [''],
  });

  get iniciales(): string {
    return (
      this.perfil()?.nombre
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((palabra) => palabra.charAt(0))
        .join('')
        .toUpperCase() || 'E'
    );
  }

  async ngOnInit(): Promise<void> {
    try {
      const perfil = await this.auth.obtenerPerfil();

      if (perfil.rol !== 'estudiante') {
        await this.router.navigateByUrl('/profesor');
        return;
      }

      this.perfil.set(perfil);

      this.materias.set(
        await this.asesoriasService.obtenerMaterias(),
      );

      await this.cargarResultados();
    } catch (error: unknown) {
      this.mostrarError(error);
    } finally {
      this.cargando.set(false);
    }
  }

  private mostrarError(error: unknown): void {
    this.error.set(
      error instanceof Error
        ? error.message
        : 'Ocurrió un error. Intenta nuevamente.',
    );
  }

  private async cargarResultados(): Promise<void> {
    const { asignaturaId, fecha } = this.filtros.getRawValue();

    this.asesorias.set(
      await this.asesoriasService.buscar(asignaturaId, fecha),
    );
  }

  async buscar(): Promise<void> {
    if (this.cargando() || this.reservando()) {
      return;
    }

    this.cargando.set(true);
    this.error.set('');
    this.mensaje.set('');
    this.seleccionada.set(null);

    try {
      await this.cargarResultados();
    } catch (error: unknown) {
      this.mostrarError(error);
    } finally {
      this.cargando.set(false);
    }
  }

  async limpiarFiltros(): Promise<void> {
    if (this.cargando() || this.reservando()) {
      return;
    }

    this.filtros.reset({
      asignaturaId: '',
      fecha: '',
    });

    await this.buscar();
  }

  verAsesoria(asesoria: AsesoriaDisponible): void {
    this.error.set('');
    this.mensaje.set('');
    this.seleccionada.set(asesoria);
  }

  cerrarDetalle(): void {
    if (!this.reservando()) {
      this.seleccionada.set(null);
    }
  }

  async confirmarReserva(): Promise<void> {
    const asesoria = this.seleccionada();

    if (!asesoria || this.reservando()) {
      return;
    }

    this.reservando.set(asesoria.horario_id);
    this.error.set('');
    this.mensaje.set('');

    try {
      await this.asesoriasService.reservar(
        asesoria.horario_id,
      );

      this.seleccionada.set(null);

      this.asesorias.update((lista) =>
        lista.filter(
          (item) => item.horario_id !== asesoria.horario_id,
        ),
      );

      this.mensaje.set(
        'Reserva creada correctamente. Quedó pendiente de confirmación por el profesor.',
      );
    } catch (error: unknown) {
      this.mostrarError(error);
    } finally {
      this.reservando.set(null);
    }
  }

  async cerrarSesion(): Promise<void> {
    if (this.cerrandoSesion() || this.reservando()) {
      return;
    }

    this.cerrandoSesion.set(true);
    this.error.set('');

    try {
      await this.auth.cerrarSesion();
      await this.router.navigateByUrl('/login');
    } catch {
      this.error.set('No fue posible cerrar sesión.');
    } finally {
      this.cerrandoSesion.set(false);
    }
  }
}