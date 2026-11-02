import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const estudianteGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  try {
    const perfil = await auth.obtenerPerfil();

    if (perfil.rol === 'estudiante') {
      return true;
    }

    return router.createUrlTree(['/profesor']);
  } catch {
    return router.createUrlTree(['/login']);
  }
};