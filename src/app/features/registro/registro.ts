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

const CORREO_DEMO = 'danitoacosta04@gmail.com';

function passwordsIguales(
  control: AbstractControl,
): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmacion = control.get('confirmacion')?.value;

  return password === confirmacion
    ? null
    : { passwordsDiferentes: true };
}

function correoPermitido(
  control: AbstractControl,
): ValidationErrors | null {
  const correo = String(control.value ?? '')
    .trim()
    .toLowerCase();

  if (!correo) {
    return null;
  }

  const esInstitucional =
    /^[^@\s]+@uao\.edu\.co$/.test(correo);

  const esCuentaDemo =
    correo === CORREO_DEMO.toLowerCase();

  return esInstitucional || esCuentaDemo
    ? null
    : { correoNoPermitido: true };
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
          correoPermitido,
        ],
      ],
      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
        ],
      ],
      confirmacion: [
        '',
        Validators.required,
      ],
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


    this.formulario.patchValue({
      nombre: this.formulario.controls.nombre.value.trim(),
      correo: this.formulario.controls.correo.value
        .trim()
        .toLowerCase(),
    });

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
        try {
          const ruta = await this.auth.obtenerRutaInicial();

          await this.router.navigateByUrl(ruta);
        } catch {
          this.error.set(
            'El registro devolvió una sesión activa, pero no fue posible cargar el perfil. Intenta acceder desde Iniciar sesión.',
          );
        }

        return;
      }

      this.mensaje.set(
        'Solicitud procesada. Revisa tu correo para confirmar la cuenta. Si ya tienes una cuenta, puedes iniciar sesión.',
      );

      this.formulario.reset({
        nombre: '',
        correo: '',
        password: '',
        confirmacion: '',
      });
    } catch {
      this.error.set(
        'No fue posible procesar el registro. Comprueba que tu correo esté autorizado también en Supabase y revisa los requisitos de contraseña.',
      );
    } finally {
      this.cargando.set(false);
    }
  }
}