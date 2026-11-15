import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const profesorGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  try {
    const perfil = await auth.obtenerPerfil();

    if (perfil.rol === 'profesor') {
      return true;
    }

    return router.createUrlTree(['/panel']);
  } catch {
    return router.createUrlTree(['/login']);
  }
};