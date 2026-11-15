# Asesorías UAO

Aplicación móvil y web para conectar estudiantes y profesores de la Universidad Autónoma de Occidente. Está construida con React, Ionic, Capacitor y Firebase Authentication/Cloud Firestore. El proyecto no incluye servidor propio ni Cloud Functions.

## Estructura de la aplicación

```
apps/client/src/
├── components/
│   ├── advisory/       # tarjetas de horarios y reservas
│   └── shared/         # layout y estados compartidos
├── context/            # contexto y proveedor de autenticación
├── helpers/            # formato de fechas y errores
├── hooks/              # autenticación y consultas de Firestore
├── pages/
│   ├── auth/
│   ├── professor/
│   ├── student/
│   └── system/
├── routes/             # rutas y control de acceso por rol
├── theme/              # estilos globales Ionic y de la app
├── types/
├── App.tsx
├── firebase.ts
└── main.tsx
```

## Requisitos

- Node.js 20.19+ o 22.12+.
- npm.
- Proyecto Firebase con Authentication (correo y contraseña) y Cloud Firestore en Native mode.
- Android Studio para compilar Android; macOS y Xcode para compilar iOS.

## Desarrollo

1. Copia `apps/client/.env.example` como `apps/client/.env.local` y completa los datos de la aplicación web Firebase.
2. En Firebase Authentication, activa correo y contraseña. La app requiere una cuenta `@uao.edu.co` con correo verificado.
3. Despliega las reglas e índices de Firestore y crea asignaturas; asigna rol y materias a profesores desde Firebase Console. Consulta [el modelo de datos](docs/firebase-data-model.md).
4. Instala las dependencias y ejecuta la app:

```bash
npm install --prefix apps/client --workspaces=false
npm run dev
```

Compila para producción con `npm run build`. Publica las reglas e índices con:

```bash
npx -y firebase-tools@latest deploy --only firestore --project asesoriasuao
```

## App móvil

```bash
npx cap add android
npx cap add ios
npm run cap:sync
npm run cap:android
npm run cap:ios
```

iOS solo se puede compilar desde macOS con Xcode. La misma app Ionic React sirve para web y dispositivos móviles.
