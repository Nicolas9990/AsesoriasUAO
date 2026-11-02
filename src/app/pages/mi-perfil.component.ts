import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';


import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-mi-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mi-perfil.component.html',
  styleUrls: ['./mi-perfil.component.scss'],
})
export class MiPerfilComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly exito = signal('');

  readonly nombre = signal('');
  readonly correo = signal('');
  readonly rol = signal<'estudiante' | 'profesor' | null>(null);

  private nombreOriginal = '';

  ngOnInit(): void {
    void this.cargarPerfil();
  }

  async cargarPerfil(): Promise<void> {
    this.cargando.set(true);
    this.error.set('');
    this.exito.set('');

    try {
      const [perfil, correo] = await Promise.all([
        this.auth.obtenerPerfil(),
        this.auth.obtenerCorreoActual(),
      ]);

      this.nombre.set(perfil.nombre);
      this.nombreOriginal = perfil.nombre;
      this.correo.set(correo);
      this.rol.set(perfil.rol);
    } catch (error: unknown) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'No fue posible cargar tu perfil.',
      );
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarNombre(valor: string): void {
    this.nombre.set(valor);
    this.error.set('');
    this.exito.set('');
  }

  get puedeGuardar(): boolean {
    const nombre = this.nombre().trim();

    return (
      !this.cargando() &&
      !this.guardando() &&
      this.rol() !== null &&
      nombre.length >= 2 &&
      nombre.length <= 100 &&
      nombre !== this.nombreOriginal.trim()
    );
  }

  async guardar(): Promise<void> {
    if (!this.puedeGuardar) {
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    this.exito.set('');

    try {
      const perfil = await this.auth.actualizarNombre(this.nombre());

      this.nombre.set(perfil.nombre);
      this.nombreOriginal = perfil.nombre;

      this.exito.set('Tu nombre se actualizó correctamente.');
    } catch (error: unknown) {
      this.error.set(
        error instanceof Error
          ? error.message
          : 'No fue posible guardar los cambios.',
      );
    } finally {
      this.guardando.set(false);
    }
  }

  async volver(): Promise<void> {
    const ruta = this.rol() === 'profesor'
      ? '/profesor'
      : this.rol() === 'estudiante'
        ? '/panel'
        : '/login';

    await this.router.navigateByUrl(ruta);
  }
}