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
        await this.router.navigateByUrl('/panel');
      }
    } catch {
      this.error.set('No fue posible comprobar la sesión.');
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

      await this.auth.iniciarSesion(correo, password);
      await this.router.navigateByUrl('/panel');
    } catch {
      this.error.set(
        'No pudimos iniciar sesión. Revisa tus datos, confirma tu correo si está pendiente e intenta nuevamente.',
      );
    } finally {
      this.cargando.set(false);
    }
  }
}