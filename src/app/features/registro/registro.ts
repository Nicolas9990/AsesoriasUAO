import { Component, inject, signal } from '@angular/core';

import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

function passwordsIguales(
  control: AbstractControl,
): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmacion = control.get('confirmacion')?.value;

  return password === confirmacion
    ? null
    : { passwordsDiferentes: true };
}

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.scss',
})
export class Registro {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly formulario = this.fb.nonNullable.group(
    {
      nombre: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.pattern(/\S/),
        ],
      ],
      correo: [
  '',
  [
    Validators.required,
    Validators.email,
    Validators.pattern(/^[^@\s]+@uao\.edu\.co$/i),
  ],
],
      password: [
        '',
        [Validators.required, Validators.minLength(8)],
      ],
      confirmacion: ['', Validators.required],
    },
    {
      validators: passwordsIguales,
    },
  );

  async crearCuenta(): Promise<void> {
    if (this.cargando()) {
      return;
    }

    this.error.set('');
    this.mensaje.set('');

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);

    try {
      const { nombre, correo, password } =
        this.formulario.getRawValue();

      const resultado = await this.auth.registrarUsuario(
        nombre,
        correo,
        password,
      );

      if (resultado.session) {
        await this.router.navigateByUrl('/panel');
        return;
      }

      this.mensaje.set(
        'Solicitud procesada. Revisa tu correo para confirmar la cuenta. Si ya tienes una cuenta, puedes iniciar sesión.',
      );

      this.formulario.reset();
    } catch {
      this.error.set(
        'No fue posible procesar el registro. Revisa los datos y los requisitos de contraseña e intenta nuevamente.',
      );
    } finally {
      this.cargando.set(false);
    }
  }
}