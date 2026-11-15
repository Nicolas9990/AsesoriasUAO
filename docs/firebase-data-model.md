# Modelo Firebase para Asesorías UAO

El modelo se derivó de los servicios Angular/Supabase preservados en `legacy/angular`: perfiles con roles, asignaturas, asignaturas asignadas a profesores, franjas horarias, reservas y sus estados. Firebase no necesita un esquema SQL; Firestore usa documentos y colecciones.

## Suposiciones de plataforma

- La app usa Firebase Authentication con correo y contraseña, y exige correo `@uao.edu.co` verificado.
- Se requiere Cloud Firestore en Native mode con SDK web/móvil y Firebase Security Rules. El proyecto Firebase no está conectado a este checkout, así que no se pudo consultar la edición o región existentes ni desplegar la configuración.
- Todas las fechas del dominio son Firestore `Timestamp` en UTC; la UI las muestra en la zona local.
- Las colecciones de dominio solo admiten escrituras desde Cloud Functions / Firebase Admin. El Admin SDK omite Security Rules, por lo que cada callable valida usuario, rol, propiedad, estado y tiempo antes de escribir.

## Colecciones y documentos

| Ruta | Campos requeridos | Acceso cliente |
| --- | --- | --- |
| `perfiles/{uid}` | `uid: string`, `nombre: string (3–100)`, `correo: string (email autenticado)`, `rol: estudiante \| profesor`, `creadoEn: Timestamp` | El dueño puede leer su documento. Solo puede crear su perfil como estudiante. Puede cambiar su nombre en un batch que también actualiza el perfil público. No puede cambiar correo, rol, UID ni fecha de creación. |
| `perfilesPublicos/{uid}` | `uid: string`, `nombre: string (3–100)`, `creadoEn: Timestamp` | Lectura para miembros UAO verificados. El dueño puede crear y actualizar el nombre en el mismo batch que `perfiles/{uid}`. No incluye correo ni rol. |
| `perfiles/{uid}/asignaturas/{asignaturaId}` | El ID de documento es el ID de asignatura; `asignadaEn: Timestamp` opcional | El profesor puede leer las suyas. Solo administración confiable puede escribirlas. Su existencia autoriza al profesor a publicar horarios para esa asignatura. |
| `asignaturas/{asignaturaId}` | `nombre: string (1–120)`, `activa: boolean` | Miembros UAO verificados pueden leer asignaturas activas. Solo administración confiable escribe. |
| `horarios/{horarioId}` | `profesorId`, `profesorNombre`, `asignaturaId`, `asignaturaNombre`, `inicio`, `fin`, `reservado: boolean`, `tieneHistorial: boolean`, `activo: boolean`, `creadoEn`; `reservaId` solo mientras esté reservado | Miembros UAO verificados pueden consultar disponibilidad. Ningún cliente crea, modifica o elimina directamente. |
| `reservas/{reservaId}` | `horarioId`, `estudianteId`, `estudianteNombre`, `profesorId`, `profesorNombre`, `asignaturaId`, `asignaturaNombre`, `inicio`, `fin`, `estado`, `creadaEn`, `actualizadaEn` | Solo los dos participantes pueden leer. No incluye correos. Ningún cliente escribe directamente. |

`perfiles` es privado porque contiene correo y rol. `perfilesPublicos` solo expone nombres necesarios para mostrar profesores y estudiantes en el flujo académico. Los IDs de perfil son los UID de Firebase Auth.

La creación de horarios también escribe `perfiles/{uid}/locks/horarios` dentro de la transacción. Este documento de control evita que dos publicaciones simultáneas del mismo profesor validen el calendario contra una vista vacía al mismo tiempo.

## Reglas de negocio modeladas

Las siguientes reglas salen de los servicios y pantallas existentes:

1. El formulario público crea estudiantes; los profesores se habilitan de forma administrativa. El perfil requiere correo institucional verificado.
2. Un profesor publica un horario futuro, dentro del mismo día de Colombia y solo para una asignatura activa asignada a su perfil.
3. Un profesor no puede publicar franjas que se crucen con otra franja activa suya.
4. Solo un estudiante reserva un horario activo, futuro y libre. La reserva empieza como `pendiente`.
5. Solo el profesor dueño confirma una reserva pendiente antes del inicio.
6. El estudiante o profesor participante puede cancelar una reserva pendiente o confirmada antes del inicio. La cancelación libera el horario, pero conserva la reserva como historial.
7. Solo el profesor dueño marca como `realizada` una reserva confirmada después de la hora de fin.
8. Un horario solo se elimina si es futuro, pertenece al profesor autenticado y nunca tuvo una reserva.

Estas mutaciones están en `functions/src/index.ts` como callables transaccionales: `crearHorario`, `eliminarHorario`, `reservarHorario` y `cambiarEstadoReserva`. La reserva actualiza atómicamente el horario y crea el registro; así no pueden reservar el mismo cupo dos estudiantes concurrentemente.

## Consultas e índices

Los índices compuestos declarados en `apps/client/firestore.indexes.json` cubren:

- cruces de horarios de un profesor al publicar una franja;
- búsqueda de horarios libres por fechas, con y sin filtro de asignatura;
- calendario semanal de un profesor;
- reservas ordenadas por creación para el estudiante o profesor participante.

Para listar reservas, el cliente debe consultar por separado con `estudianteId == auth.uid` o `profesorId == auth.uid`; las reglas de Firestore no filtran resultados, exigen que la consulta ya esté acotada al usuario.

## Datos iniciales

1. Crea las asignaturas como `asignaturas/{asignaturaId}` con `nombre` y `activa: true`.
2. Para habilitar un profesor, usa una cuenta ya verificada de Authentication y crea con un proceso administrativo:
   - `perfiles/{uid}` con `uid`, `nombre`, `correo`, `rol: "profesor"`, `creadoEn`;
   - `perfilesPublicos/{uid}` con `uid`, el mismo `nombre` y `creadoEn`;
   - `perfiles/{uid}/asignaturas/{asignaturaId}` para cada asignatura habilitada, con `asignadaEn`.
3. Los estudiantes crean sus propios perfiles privados y públicos al entrar por primera vez después de verificar el correo.

Nunca asignes roles de profesor desde el formulario cliente. La consola Firebase y Admin SDK omiten reglas; limita ese acceso a administradores del proyecto.

## Despliegue y migración

El checkout no tiene `.firebaserc`, credenciales de aplicación ni acceso al proyecto Firebase. Define un proyecto Firebase con Firestore Native mode, configura `apps/client/.env.local`, habilita Email/Password, instala dependencias y despliega con:

```bash
npm install
npm run build
npx firebase-tools deploy --only firestore,functions --project <firebase-project-id>
```

La publicación de Cloud Functions requiere el plan Blaze y configura facturación en Google Cloud; Functions tiene cuotas sin costo, pero el uso superior puede generar cargos. [Requisitos y precios de Cloud Functions](https://firebase.google.com/docs/functions/get-started).

No se escribió esquema SQL ni políticas RLS porque el destino acordado es Firebase. Tampoco se incluye importador de datos Supabase: el repositorio no contiene DDL, RLS ni export de filas. Este modelo constituye la base nueva; importar datos existentes requiere exportarlos, remapear Auth a UID de Firebase y revisar relaciones y restricciones antes de ejecutar una carga administrativa.
