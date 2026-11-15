import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export type EstadoReserva =
  | 'pendiente'
  | 'confirmada'
  | 'realizada'
  | 'cancelada';

export interface Reserva {
  id: string;
  horario_id: string;
  estudiante_id: string;
  estudiante_nombre: string;
  profesor_id: string;
  profesor_nombre: string;
  asignatura_nombre: string;
  inicio: string;
  fin: string;
  estado: EstadoReserva;
  creada_en: string;
}

export interface ResumenProfesor {
  disponibles: number;
  pendientes: number;
  realizadas: number;
}

@Injectable({
  providedIn: 'root',
})
export class ReservasService {
  private readonly auth = inject(AuthService);

  async listar(): Promise<Reserva[]> {
    const { data, error } = await this.auth.supabase.rpc(
      'listar_mis_reservas',
    );

    if (error) {
      throw new Error(
        'No fue posible consultar las reservas. Intenta nuevamente.',
      );
    }

    return (data ?? []) as Reserva[];
  }

  async obtenerResumen(): Promise<ResumenProfesor> {
    const { data, error } = await this.auth.supabase.rpc(
      'resumen_profesor',
    );

    if (error || !data) {
      throw new Error(
        'No fue posible cargar el resumen del profesor.',
      );
    }

    return data as ResumenProfesor;
  }

  async cambiarEstado(
    reserva: Reserva,
    nuevoEstado: EstadoReserva,
  ): Promise<void> {
    const { data, error } = await this.auth.supabase
      .from('reservas')
      .update({
        estado: nuevoEstado,
      })
      .eq('id', reserva.id)
      .eq('estado', reserva.estado)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(
        'No se pudo cambiar el estado. Comprueba que la acción esté permitida para esa reserva y su horario.',
      );
    }

    if (!data) {
      throw new Error(
        'La reserva cambió o ya no tienes acceso. Actualiza el listado antes de intentar nuevamente.',
      );
    }
  }
}