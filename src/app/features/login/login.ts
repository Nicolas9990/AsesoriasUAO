import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly mostrarPassword = signal(false);

  readonly formulario = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  async ngOnInit(): Promise<void> {
  try {
    const session = await this.auth.obtenerSesion();

    if (session) {
      const ruta = await this.auth.obtenerRutaInicial();
      await this.router.navigateByUrl(ruta);
    }
  } catch {
    this.error.set(
      'No fue posible cargar tu perfil. Comprueba tu conexión y que tu perfil exista en Supabase.',
    );
  }
}

  alternarPassword(): void {
    this.mostrarPassword.update((valor) => !valor);
  }

  async iniciarSesion(): Promise<void> {
  if (this.cargando()) {
    return;
  }

  this.error.set('');

  if (this.formulario.invalid) {
    this.formulario.markAllAsTouched();
    return;
  }

  this.cargando.set(true);

  try {
    const { correo, password } = this.formulario.getRawValue();

    try {
      await this.auth.iniciarSesion(correo, password);
    } catch {
      this.error.set(
        'No pudimos iniciar sesión. Revisa tus datos y confirma tu correo si está pendiente.',
      );
      return;
    }

    try {
      const ruta = await this.auth.obtenerRutaInicial();
      await this.router.navigateByUrl(ruta);
    } catch {
      this.error.set(
        'La sesión se inició, pero no pudimos cargar tu perfil. Revisa tu conexión y la tabla perfiles en Supabase.',
      );
    }
  } finally {
    this.cargando.set(false);
  }
  }}
