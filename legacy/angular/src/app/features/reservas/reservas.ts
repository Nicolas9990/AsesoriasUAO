import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import {
  AuthService,
  Perfil,
} from '../../core/services/auth.service';

import {
  EstadoReserva,
  Reserva,
  ReservasService,
} from '../../core/services/reservas.service';

type FiltroReserva = EstadoReserva | 'todas';

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './reservas.html',
  styleUrl: './reservas.scss',
})
export class Reservas implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly reservasService = inject(ReservasService);

  readonly perfil = signal<Perfil | null>(null);
  readonly reservas = signal<Reserva[]>([]);
  readonly filtro = signal<FiltroReserva>('todas');

  readonly cargando = signal(true);
  readonly procesando = signal<string | null>(null);
  readonly detalleId = signal<string | null>(null);
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly filtros: {
    valor: FiltroReserva;
    etiqueta: string;
  }[] = [
    { valor: 'todas', etiqueta: 'Todas' },
    { valor: 'pendiente', etiqueta: 'Pendientes' },
    { valor: 'confirmada', etiqueta: 'Confirmadas' },
    { valor: 'realizada', etiqueta: 'Realizadas' },
    { valor: 'cancelada', etiqueta: 'Canceladas' },
  ];

  readonly reservasFiltradas = computed(() => {
    const filtro = this.filtro();

    return filtro === 'todas'
      ? this.reservas()
      : this.reservas().filter(
          (reserva) => reserva.estado === filtro,
        );
  });

  get esProfesor(): boolean {
    return this.perfil()?.rol === 'profesor';
  }

  get rutaInicio(): string {
    return this.esProfesor ? '/profesor' : '/panel';
  }

  async ngOnInit(): Promise<void> {
    try {
      this.perfil.set(await this.auth.obtenerPerfil());
      await this.cargar();
    } catch {
      this.error.set('No fue posible cargar tu perfil.');
      this.cargando.set(false);
    }
  }

  async cargar(): Promise<void> {
    if (this.procesando()) {
      return;
    }

    this.cargando.set(true);
    this.error.set('');

    try {
      this.reservas.set(
        await this.reservasService.listar(),
      );
    } catch (error: unknown) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'No fue posible cargar las reservas.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarFiltro(filtro: FiltroReserva): void {
    this.filtro.set(filtro);
    this.detalleId.set(null);
  }

  alternarDetalle(id: string): void {
    this.detalleId.update(
      (actual) => actual === id ? null : id,
    );
  }

  puedeConfirmar(reserva: Reserva): boolean {
    return (
      this.esProfesor &&
      reserva.estado === 'pendiente' &&
      new Date(reserva.inicio).getTime() > Date.now()
    );
  }

  puedeCancelar(reserva: Reserva): boolean {
    return (
      (
        reserva.estado === 'pendiente' ||
        reserva.estado === 'confirmada'
      ) &&
      new Date(reserva.inicio).getTime() > Date.now()
    );
  }

  puedeRealizar(reserva: Reserva): boolean {
    return (
      this.esProfesor &&
      reserva.estado === 'confirmada' &&
      new Date(reserva.fin).getTime() <= Date.now()
    );
  }

  async cambiarEstado(
    reserva: Reserva,
    nuevoEstado: EstadoReserva,
  ): Promise<void> {
    if (this.procesando() || this.cargando()) {
      return;
    }

    const permitida =
      (nuevoEstado === 'confirmada' && this.puedeConfirmar(reserva)) ||
      (nuevoEstado === 'cancelada' && this.puedeCancelar(reserva)) ||
      (nuevoEstado === 'realizada' && this.puedeRealizar(reserva));

    if (!permitida) {
      this.error.set(
        'La acción ya no está disponible. Actualiza el listado.',
      );
      return;
    }

    if (
      nuevoEstado === 'cancelada' &&
      !window.confirm('¿Quieres cancelar esta reserva?')
    ) {
      return;
    }

    this.procesando.set(reserva.id);
    this.error.set('');
    this.mensaje.set('');

    try {
      await this.reservasService.cambiarEstado(
        reserva,
        nuevoEstado,
      );

      this.reservas.update((lista) =>
        lista.map((item) =>
          item.id === reserva.id
            ? { ...item, estado: nuevoEstado }
            : item,
        ),
      );

      this.mensaje.set(
        'El estado de la reserva se actualizó correctamente.',
      );
    } catch (error: unknown) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'No fue posible actualizar la reserva.',
      );
    } finally {
      this.procesando.set(null);
    }
  }
}