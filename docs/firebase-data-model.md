# Modelo Firebase para Asesorías UAO

La app usa Firebase Authentication y Cloud Firestore directamente desde React/Ionic. No hay API propia, servidor Node ni Cloud Functions. Firestore Security Rules protege los documentos y las operaciones relacionadas se hacen con transacciones del SDK cliente.

## Colecciones

| Ruta | Campos principales | Acceso |
| --- | --- | --- |
| `perfiles/{uid}` | `uid`, `nombre`, `correo`, `rol`, `creadoEn` | El usuario lee su perfil; el registro solo puede crear estudiantes; cada usuario solo puede cambiar su nombre. |
| `perfilesPublicos/{uid}` | `uid`, `nombre`, `creadoEn` | Miembros UAO verificados pueden leerlo. No contiene correo ni rol. |
| `perfiles/{uid}/asignaturas/{asignaturaId}` | `asignadaEn` opcional | El profesor lee sus asignaturas; se configuran manualmente en la consola de Firebase. |
| `perfiles/{uid}/locks/horarios` | `actualizadoEn`, `intervalos[]` | El profesor puede leer y actualizar el calendario transaccional de sus horarios. Cada intervalo contiene `horarioId`, `inicio` y `fin`. |
| `asignaturas/{asignaturaId}` | `nombre`, `activa` | Miembros UAO verificados leen asignaturas activas. Se crean desde la consola. |
| `horarios/{horarioId}` | profesor, asignatura, `inicio`, `fin`, `reservado`, `tieneHistorial`, `activo`, `creadoEn`, `reservaId` opcional | Miembros verificados leen horarios. Profesores publican y eliminan sus propios horarios. Reservas actualizan el estado en una transacción. |
| `reservas/{reservaId}` | IDs y nombres de participantes, horario, asignatura, fechas y `estado` | Solo el estudiante y el profesor participantes pueden leer. Los cambios usan transacciones validadas por reglas. |

Todos los perfiles deben tener correo `@uao.edu.co` verificado. El usuario nuevo solo se puede registrar como estudiante; nunca se puede asignar a sí mismo el rol de profesor. Para habilitar docentes se crean en Firebase Console el perfil con `rol: "profesor"`, su perfil público y los documentos de asignaturas asignadas.

## Escrituras y seguridad

- Publicar un horario actualiza en una transacción el calendario del profesor y crea el horario. El calendario serializa las publicaciones concurrentes de la app y permite detectar cruces entre franjas.
- Reservar cambia `reservado` en el horario y crea la reserva pendiente en la misma transacción. Las reglas exigen ambas escrituras juntas para que dos estudiantes no tomen la misma franja.
- Confirmar y marcar como realizada validan rol, participante, estado y momento permitido.
- Cancelar actualiza la reserva y libera el horario en una transacción, conservando la reserva como historial.
- El horario solo se elimina si es futuro, no está reservado y nunca tuvo una reserva.
- La asignación de profesores y la creación de asignaturas son tareas administrativas de consola; la app pública no las modifica.

Las validaciones de cruces usan el documento de calendario actualizado por el cliente y protegido por reglas. Para el prototipo de la materia no se despliega un servidor. Si se requiere una garantía de integridad contra un profesor que altere deliberadamente sus propias escrituras desde un cliente modificado, esa validación debe trasladarse a un servicio confiable del lado servidor.

## Consultas e índices

Los índices de `apps/client/firestore.indexes.json` cubren la búsqueda de horarios libres por fechas, con o sin asignatura, el calendario docente y las reservas ordenadas para cada participante. Las consultas de reservas siempre filtran por `estudianteId == auth.uid` o `profesorId == auth.uid`, ya que las reglas no filtran resultados.

## Publicar en Firebase

El proyecto Firebase requiere Authentication con correo/contraseña y Firestore en Native mode. Completa `apps/client/.env.local` (no se sube a Git) y despliega únicamente reglas e índices:

```bash
npx -y firebase-tools@latest deploy --only firestore --project asesoriasuao
```

Authentication y Firestore tienen cuotas gratuitas en Spark; consulta la página de [planes y cuotas de Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans). No despliegues Functions: esta versión no las utiliza.

