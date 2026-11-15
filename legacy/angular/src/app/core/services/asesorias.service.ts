import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface Materia {
  id: string;
  nombre: string;
}

export interface AsesoriaDisponible {
  horario_id: string;
  asignatura_id: string;
  asignatura_nombre: string;
  profesor_id: string;
  profesor_nombre: string;
  inicio: string;
  fin: string;
}

@Injectable({
  providedIn: 'root',
})
export class AsesoriasService {
  private readonly auth = inject(AuthService);

  async obtenerMaterias(): Promise<Materia[]> {
    const { data, error } = await this.auth.supabase
      .from('asignaturas')
      .select('id, nombre')
      .order('nombre');

    if (error) {
      throw new Error('No fue posible consultar las asignaturas.');
    }

    return data ?? [];
  }

  async buscar(
    asignaturaId: string,
    fecha: string,
  ): Promise<AsesoriaDisponible[]> {
    const { data, error } = await this.auth.supabase.rpc(
      'buscar_asesorias_disponibles',
      {
        p_asignatura: asignaturaId || null,
        p_fecha: fecha || null,
      },
    );

    if (error) {
      throw new Error(
        'No fue posible buscar asesorías. Comprueba tu sesión e intenta nuevamente.',
      );
    }

    return (data ?? []) as AsesoriaDisponible[];
  }

  async reservar(horarioId: string): Promise<void> {
    const perfil = await this.auth.obtenerPerfil();

    if (perfil.rol !== 'estudiante') {
      throw new Error(
        'Solo los estudiantes pueden reservar asesorías.',
      );
    }

    const { error } = await this.auth.supabase
      .from('reservas')
      .insert({
        horario_id: horarioId,
        estudiante_id: perfil.id,
      });

    if (error) {
      if (error.code === '23505') {
        throw new Error(
          'Ese horario acaba de ser reservado. Actualiza los resultados y selecciona otro.',
        );
      }

      throw new Error(
        'No se pudo crear la reserva. El horario puede haber comenzado o ya no estar disponible.',
      );
    }
  }
}