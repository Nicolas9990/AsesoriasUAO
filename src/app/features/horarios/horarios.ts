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
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  Asignatura,
  Horario,
  HorariosService,
} from '../../core/services/horarios.service';

function fechaColombia(valor: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(valor);

  const obtener = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';

  return `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
}

function sumarDias(fecha: string, cantidad: number): string {
  const valor = new Date(`${fecha}T12:00:00Z`);
  valor.setUTCDate(valor.getUTCDate() + cantidad);

  return valor.toISOString().slice(0, 10);
}

function lunesDeSemana(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  const distancia = dia === 0 ? 6 : dia - 1;

  return sumarDias(fecha, -distancia);
}

@Component({
  selector: 'app-horarios',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  templateUrl: './horarios.html',
  styleUrl: './horarios.scss',
})
export class Horarios implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly horariosService = inject(HorariosService);

  readonly asignaturas = signal<Asignatura[]>([]);
  readonly horarios = signal<Horario[]>([]);

  readonly inicioSemana = signal(
    lunesDeSemana(fechaColombia()),
  );

  readonly finSemana = computed(() =>
    sumarDias(this.inicioSemana(), 6),
  );

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly eliminando = signal<string | null>(null);
  readonly mostrarFormulario = signal(false);

  readonly error = signal('');
  readonly mensaje = signal('');

  readonly ocupado = computed(() =>
    this.cargando() ||
    this.guardando() ||
    this.eliminando() !== null,
  );

  readonly dias = computed(() => {
    const nombres = [
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
      'Domingo',
    ];

    return nombres.map((nombre, indice) => {
      const fecha = sumarDias(this.inicioSemana(), indice);

      return {
        nombre,
        fecha,
        horarios: this.horarios().filter(
          (horario) =>
            fechaColombia(new Date(horario.inicio)) === fecha,
        ),
      };
    });
  });

  readonly formulario = this.fb.nonNullable.group({
    asignaturaId: ['', Validators.required],
    fecha: ['', Validators.required],
    horaInicio: ['08:00', Validators.required],
    horaFin: ['09:00', Validators.required],
  });

  async ngOnInit(): Promise<void> {
    await this.cargarDatos();
  }

  private mostrarError(error: unknown): void {
    this.error.set(
      error instanceof Error
        ? error.message
        : 'Ocurrió un error. Intenta nuevamente.',
    );
  }

  async cargarDatos(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.horarios.set([]);

    try {
      const desde = `${this.inicioSemana()}T00:00:00-05:00`;
      const hasta =
        `${sumarDias(this.inicioSemana(), 7)}T00:00:00-05:00`;

      const datos = await this.horariosService.obtenerDatos(
        desde,
        hasta,
      );

      this.asignaturas.set(datos.asignaturas);
      this.horarios.set(datos.horarios);
    } catch (error: unknown) {
      this.mostrarError(error);
    } finally {
      this.cargando.set(false);
    }
  }

  async moverSemana(cantidad: number): Promise<void> {
    if (this.ocupado()) {
      return;
    }

    this.mensaje.set('');
    this.inicioSemana.set(
      sumarDias(this.inicioSemana(), cantidad * 7),
    );

    await this.cargarDatos();
  }

  async irAHoy(): Promise<void> {
    if (this.ocupado()) {
      return;
    }

    this.mensaje.set('');
    this.inicioSemana.set(
      lunesDeSemana(fechaColombia()),
    );

    await this.cargarDatos();
  }

  nombreAsignatura(id: string): string {
    return this.asignaturas().find(
      (asignatura) => asignatura.id === id,
    )?.nombre ?? 'Asignatura';
  }

  esPasado(horario: Horario): boolean {
    return new Date(horario.inicio).getTime() <= Date.now();
  }

  puedeEliminar(horario: Horario): boolean {
    return !horario.tieneHistorial && !this.esPasado(horario);
  }

  estadoHorario(horario: Horario): string {
    if (this.esPasado(horario)) {
      return horario.reservado
        ? 'Pasado · con reserva'
        : 'Pasado';
    }

    return horario.reservado ? 'Reservado' : 'Disponible';
  }

  abrirFormulario(): void {
    this.error.set('');
    this.mensaje.set('');
    this.mostrarFormulario.set(true);
  }

  cancelar(): void {
    if (this.guardando()) {
      return;
    }

    this.mostrarFormulario.set(false);
    this.error.set('');
    this.reiniciarFormulario();
  }

  private reiniciarFormulario(): void {
    this.formulario.reset({
      asignaturaId: '',
      fecha: '',
      horaInicio: '08:00',
      horaFin: '09:00',
    });
  }

  async guardar(): Promise<void> {
    if (this.ocupado()) {
      return;
    }

    this.error.set('');
    this.mensaje.set('');

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.error.set('Completa todos los campos del horario.');
      return;
    }

    const {
      asignaturaId,
      fecha,
      horaInicio,
      horaFin,
    } = this.formulario.getRawValue();

    const inicio = new Date(`${fecha}T${horaInicio}:00-05:00`);
    const fin = new Date(`${fecha}T${horaFin}:00-05:00`);

    if (
      Number.isNaN(inicio.getTime()) ||
      Number.isNaN(fin.getTime())
    ) {
      this.error.set('Selecciona una fecha y horas válidas.');
      return;
    }

    if (fin <= inicio) {
      this.error.set(
        'La hora final debe ser posterior a la inicial.',
      );
      return;
    }

    if (inicio.getTime() <= Date.now()) {
      this.error.set('El horario debe comenzar en el futuro.');
      return;
    }

    this.guardando.set(true);

    try {
      await this.horariosService.crearHorario(
        asignaturaId,
        inicio.toISOString(),
        fin.toISOString(),
      );

      this.mostrarFormulario.set(false);
      this.reiniciarFormulario();

      this.inicioSemana.set(lunesDeSemana(fecha));
      await this.cargarDatos();

      this.mensaje.set(
        this.error()
          ? 'El horario se guardó, pero no se pudo actualizar el calendario.'
          : 'Horario publicado correctamente.',
      );
    } catch (error: unknown) {
      this.mostrarError(error);
    } finally {
      this.guardando.set(false);
    }
  }

  async eliminar(horario: Horario): Promise<void> {
    if (this.ocupado() || !this.puedeEliminar(horario)) {
      return;
    }

    if (!window.confirm('¿Quieres eliminar esta franja horaria?')) {
      return;
    }

    this.eliminando.set(horario.id);
    this.error.set('');
    this.mensaje.set('');

    try {
      await this.horariosService.eliminarHorario(horario.id);

      this.horarios.update((lista) =>
        lista.filter((item) => item.id !== horario.id),
      );

      this.mensaje.set('Horario eliminado correctamente.');
    } catch (error: unknown) {
      this.mostrarError(error);
    } finally {
      this.eliminando.set(null);
    }
  }
}