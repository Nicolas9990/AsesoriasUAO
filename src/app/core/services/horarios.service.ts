import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface Asignatura {
  id: string;
  nombre: string;
}

export interface Horario {
  id: string;
  profesor_id: string;
  asignatura_id: string;
  inicio: string;
  fin: string;
  reservado: boolean;
  tieneHistorial: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class HorariosService {
  private readonly auth = inject(AuthService);

  async obtenerDatos(
    desde: string,
    hasta: string,
  ): Promise<{
    asignaturas: Asignatura[];
    horarios: Horario[];
  }> {
    const perfil = await this.auth.obtenerPerfil();

    if (perfil.rol !== 'profesor') {
      throw new Error('Esta función es exclusiva para profesores.');
    }

    const db = this.auth.supabase;

    const { data: relaciones, error: relacionesError } = await db
      .from('profesor_asignaturas')
      .select('asignatura_id')
      .eq('profesor_id', perfil.id);

    if (relacionesError) {
      throw new Error('No fue posible consultar tus asignaturas.');
    }

    const ids = (relaciones ?? []).map(
      (relacion) => relacion.asignatura_id,
    );

    let asignaturas: Asignatura[] = [];

    if (ids.length > 0) {
      const { data, error } = await db
        .from('asignaturas')
        .select('id, nombre')
        .in('id', ids)
        .order('nombre');

      if (error) {
        throw new Error('No fue posible cargar las asignaturas.');
      }

      asignaturas = data ?? [];
    }

    const { data: franjas, error: horariosError } = await db
      .from('horarios')
      .select('id, profesor_id, asignatura_id, inicio, fin')
      .eq('profesor_id', perfil.id)
      .gte('inicio', desde)
      .lt('inicio', hasta)
      .order('inicio');

    if (horariosError) {
      throw new Error('No fue posible consultar los horarios.');
    }

    if (!franjas?.length) {
      return { asignaturas, horarios: [] };
    }

    const { data: reservas, error: reservasError } = await db
      .from('reservas')
      .select('horario_id, estado')
      .in(
        'horario_id',
        franjas.map((horario) => horario.id),
      );

    if (reservasError) {
      throw new Error(
        'No fue posible comprobar la ocupación de los horarios.',
      );
    }

    const historial = new Set(
      (reservas ?? []).map((reserva) => reserva.horario_id),
    );

    const ocupados = new Set(
      (reservas ?? [])
        .filter((reserva) => reserva.estado !== 'cancelada')
        .map((reserva) => reserva.horario_id),
    );

    return {
      asignaturas,
      horarios: franjas.map((horario) => ({
        ...horario,
        reservado: ocupados.has(horario.id),
        tieneHistorial: historial.has(horario.id),
      })),
    };
  }

  async crearHorario(
    asignaturaId: string,
    inicio: string,
    fin: string,
  ): Promise<void> {
    const perfil = await this.auth.obtenerPerfil();

    if (perfil.rol !== 'profesor') {
      throw new Error('No tienes permisos para crear horarios.');
    }

    const { error } = await this.auth.supabase
      .from('horarios')
      .insert({
        profesor_id: perfil.id,
        asignatura_id: asignaturaId,
        inicio,
        fin,
      });

    if (error) {
      if (error.code === '23P01') {
        throw new Error(
          'Ese horario se cruza con otra franja que ya publicaste.',
        );
      }

      if (error.code === '23503') {
        throw new Error(
          'La asignatura no está asignada a tu perfil.',
        );
      }

      throw new Error(
        'No se pudo publicar. Comprueba los permisos y que la fecha sea futura.',
      );
    }
  }

  async eliminarHorario(id: string): Promise<void> {
    const perfil = await this.auth.obtenerPerfil();

    if (perfil.rol !== 'profesor') {
      throw new Error('No tienes permisos para eliminar horarios.');
    }

    const { data, error } = await this.auth.supabase
      .from('horarios')
      .delete()
      .eq('id', id)
      .eq('profesor_id', perfil.id)
      .select('id')
      .maybeSingle();

    if (error || !data) {
      throw new Error(
        'No se pudo eliminar. La franja debe ser futura, pertenecer a tu cuenta y no tener historial de reservas.',
      );
    }
  }
}