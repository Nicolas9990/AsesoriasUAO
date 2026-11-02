import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export interface Perfil {
  id: string;
  nombre: string;
  rol: 'estudiante' | 'profesor';
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly client = createClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
  );

  get supabase() {
    return this.client;
  }

  async iniciarSesion(
    correo: string,
    password: string,
  ): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({
      email: correo.trim(),
      password,
    });

    if (error) {
      throw error;
    }
  }

  async registrarUsuario(
    nombre: string,
    correo: string,
    password: string,
  ) {
    const { data, error } = await this.client.auth.signUp({
      email: correo.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          nombre: nombre.trim(),
        },
      },
    });

    if (error) {
      throw error;
    }

    return data;
  }

  async obtenerSesion() {
    const { data, error } = await this.client.auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;
  }

  async obtenerPerfil(): Promise<Perfil> {
    const {
      data: { user },
      error: userError,
    } = await this.client.auth.getUser();

    if (userError || !user) {
      throw new Error('No fue posible verificar el usuario actual.');
    }

    const { data, error } = await this.client
      .from('perfiles')
      .select('id, nombre, rol')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      throw new Error(
        'No fue posible cargar tu perfil. Revisa que exista en Supabase.',
      );
    }

    if (data.rol !== 'profesor' && data.rol !== 'estudiante') {
      throw new Error('El perfil tiene un rol no válido.');
    }

    return {
      id: data.id,
      nombre: data.nombre,
      rol: data.rol,
    };
  }

  async obtenerCorreoActual(): Promise<string> {
    const {
      data: { user },
      error,
    } = await this.client.auth.getUser();

    if (error || !user) {
      throw new Error('No fue posible obtener el correo del usuario.');
    }

    return user.email ?? '';
  }

  async actualizarNombre(nombre: string): Promise<Perfil> {
    const nombreLimpio = nombre.trim();

    if (nombreLimpio.length < 2) {
      throw new Error('El nombre debe tener al menos 2 caracteres.');
    }

    if (nombreLimpio.length > 100) {
      throw new Error('El nombre no puede superar los 100 caracteres.');
    }

    const {
      data: { user },
      error: userError,
    } = await this.client.auth.getUser();

    if (userError || !user) {
      throw new Error(
        'Tu sesión no está disponible. Inicia sesión nuevamente.',
      );
    }

    const { data, error } = await this.client
      .from('perfiles')
      .update({
        nombre: nombreLimpio,
      })
      .eq('id', user.id)
      .select('id, nombre, rol')
      .single();

    if (error || !data) {
      throw new Error(
        'No fue posible guardar el nombre. Revisa los permisos del perfil.',
      );
    }

    if (data.rol !== 'profesor' && data.rol !== 'estudiante') {
      throw new Error('El perfil tiene un rol no válido.');
    }

    return {
      id: data.id,
      nombre: data.nombre,
      rol: data.rol,
    };
  }

  async obtenerRutaInicial(): Promise<string> {
    const perfil = await this.obtenerPerfil();

    return perfil.rol === 'profesor'
      ? '/profesor'
      : '/panel';
  }

  async cerrarSesion(): Promise<void> {
    const { error } = await this.client.auth.signOut();

    if (error) {
      throw error;
    }
  }
}