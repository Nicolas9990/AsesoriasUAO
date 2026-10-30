import { Injectable } from '@angular/core';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly client = createClient(
    environment.supabaseUrl,
    environment.supabasePublishableKey,
  );

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

  async cerrarSesion(): Promise<void> {
    const { error } = await this.client.auth.signOut();

    if (error) {
      throw error;
    }
  }
}