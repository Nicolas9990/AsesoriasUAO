# Asesorías UAO

Plataforma de acompañamiento académico para conectar estudiantes y profesores de la Universidad Autónoma de Occidente.

## Estructura

- `apps/client`: aplicación React + Ionic + Capacitor para web, Android e iOS.
- `apps/client/src/auth`: autenticación Firebase y carga de perfiles.
- `apps/client/firestore.rules`: reglas de acceso y validación para perfiles y datos académicos.
- `functions`: operaciones transaccionales para publicar/eliminar horarios, reservar y cambiar el estado de reservas.
- `docs/firebase-data-model.md`: colecciones, campos, permisos y reglas derivadas de la versión anterior.
- `legacy/angular`: versión Angular + Supabase existente, conservada como referencia durante la migración.

La nueva app usa Ionic React como interfaz adaptable y Capacitor como runtime nativo. Esto mantiene una sola interfaz React para web y dispositivos móviles.

## Requisitos

- Node.js 20.19+ o 22.12+.
- npm.
- Un proyecto Firebase con Authentication (correo y contraseña) y Cloud Firestore Native mode.
- Android Studio para compilar Android; macOS y Xcode para compilar iOS.

## Desarrollo

1. Copia `apps/client/.env.example` a `apps/client/.env.local` y completa la configuración de la aplicación web Firebase.
2. En Firebase Authentication, habilita **Correo electrónico/Contraseña** y la verificación del correo. El registro acepta solo cuentas `@uao.edu.co` verificadas.
3. Crea la base de datos de Firestore en Native mode. Configura materias y asignaciones de profesores con Admin SDK o la consola; los pasos están en [firebase-data-model.md](docs/firebase-data-model.md).
4. Desde la raíz del repositorio:

```bash
npm install
npm run dev
```

Para compilar cliente y Functions, ejecuta `npm run build`. Publica reglas, índices y callables con `npx firebase-tools deploy --only firestore,functions --project <firebase-project-id>`. La publicación de Functions requiere el plan Blaze y puede generar cargos por uso.

## Aplicación móvil

```bash
npx cap add android
npx cap add ios
npm run cap:sync
npm run cap:android
npm run cap:ios
```

El proyecto iOS solo se puede compilar desde macOS con Xcode.

## Migración funcional

La versión Angular de referencia está en `legacy/angular`. La app React/Ionic ya contiene registro e inicio de sesión, búsqueda de horarios por asignatura y fecha, solicitud y cancelación de reservas, publicación y eliminación de horarios docentes, y gestión de solicitudes (confirmar, cancelar y marcar como realizada). Las consultas de disponibilidad y reservas se actualizan en tiempo real; las mutaciones pasan por las callables transaccionales de Firestore. Para usar estos flujos hay que configurar y desplegar Firebase según los pasos anteriores. El rol de profesor y sus asignaturas se asignan desde un entorno administrativo confiable, nunca desde el formulario público.

El plan inicial de modelo Firestore y migración de datos está en [`docs/firebase-data-model.md`](docs/firebase-data-model.md). No se copian credenciales del cliente Supabase al nuevo cliente Firebase.
