import { Routes } from '@angular/router';

import { profesorGuard } from './core/guards/profesor.guard';
import { estudianteGuard } from './core/guards/estudiante.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login').then(
        (m) => m.Login,
      ),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./features/registro/registro').then(
        (m) => m.Registro,
      ),
  },

  // Rutas del profesor
  {
    path: 'profesor/horarios',
    canActivate: [profesorGuard],
    loadComponent: () =>
      import('./features/horarios/horarios').then(
        (m) => m.Horarios,
      ),
  },
  {
    path: 'profesor/reservas',
    canActivate: [profesorGuard],
    loadComponent: () =>
      import('./features/reservas/reservas').then(
        (m) => m.Reservas,
      ),
  },
  {
    path: 'profesor/perfil',
    canActivate: [profesorGuard],
    loadComponent: () =>
      import('./pages/mi-perfil.component').then(
        (m) => m.MiPerfilComponent,
      ),
  },
  {
    path: 'profesor',
    canActivate: [profesorGuard],
    loadComponent: () =>
      import('./features/profesor/profesor').then(
        (m) => m.Profesor,
      ),
  },

  // Rutas del estudiante
  {
    path: 'panel/reservas',
    canActivate: [estudianteGuard],
    loadComponent: () =>
      import('./features/reservas/reservas').then(
        (m) => m.Reservas,
      ),
  },
  {
    path: 'panel/perfil',
    canActivate: [estudianteGuard],
    loadComponent: () =>
      import('./pages/mi-perfil.component').then(
        (m) => m.MiPerfilComponent,
      ),
  },
  {
    path: 'panel',
    canActivate: [estudianteGuard],
    loadComponent: () =>
      import('./features/estudiante/estudiante').then(
        (m) => m.Estudiante,
      ),
  },

  // Cualquier ruta no definida vuelve al login
  {
    path: '**',
    redirectTo: 'login',
  },
];