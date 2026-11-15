import { initializeApp } from 'firebase-admin/app';
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Transaction,
} from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();

type Role = 'estudiante' | 'profesor';
type CallableData = Record<string, unknown>;

function requireUniversityUser(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  const token = request.auth?.token;
  const email = typeof token?.email === 'string' ? token.email : '';
  if (!uid || token?.email_verified !== true || !/^[A-Za-z0-9._%+-]+@uao\.edu\.co$/.test(email)) {
    throw new HttpsError('unauthenticated', 'Inicia sesión con un correo UAO verificado.');
  }
  return uid;
}

function readId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 150 || value.includes('/')) {
    throw new HttpsError('invalid-argument', `${label} no es válido.`);
  }
  return value;
}

function readMillis(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new HttpsError('invalid-argument', `${label} debe ser una fecha válida.`);
  }
  return value;
}

function validName(value: unknown, minLength = 3, maxLength = 100): value is string {
  return typeof value === 'string' && value.trim().length >= minLength && value.length <= maxLength;
}

function colombiaDate(milliseconds: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(milliseconds));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

async function getRoleInTransaction(
  transaction: Transaction,
  uid: string,
): Promise<Role> {
  const profile = await transaction.get(db.collection('perfiles').doc(uid));
  if (!profile.exists || (profile.get('rol') !== 'estudiante' && profile.get('rol') !== 'profesor')) {
    throw new HttpsError('permission-denied', 'El perfil no tiene un rol habilitado.');
  }
  return profile.get('rol') as Role;
}

export const crearHorario = onCall(async (request) => {
  const uid = requireUniversityUser(request);
  const data = (request.data ?? {}) as CallableData;
  const asignaturaId = readId(data.asignaturaId, 'La asignatura');
  const inicioMs = readMillis(data.inicioMs, 'La hora inicial');
  const finMs = readMillis(data.finMs, 'La hora final');
  const ahora = Date.now();

  if (inicioMs <= ahora || finMs <= inicioMs || colombiaDate(inicioMs) !== colombiaDate(finMs)) {
    throw new HttpsError('invalid-argument', 'El horario debe ser futuro, ocurrir el mismo día y terminar después de comenzar.');
  }

  const inicio = Timestamp.fromMillis(inicioMs);
  const fin = Timestamp.fromMillis(finMs);
  const profileRef = db.collection('perfiles').doc(uid);
  const publicProfileRef = db.collection('perfilesPublicos').doc(uid);
  const subjectRef = db.collection('asignaturas').doc(asignaturaId);
  const assignmentRef = profileRef.collection('asignaturas').doc(asignaturaId);
  const schedulingLockRef = profileRef.collection('locks').doc('horarios');
  const slotRef = db.collection('horarios').doc();
  const overlapsQuery = db.collection('horarios')
    .where('profesorId', '==', uid)
    .where('activo', '==', true)
    .where('inicio', '<', fin)
    .where('fin', '>', inicio);

  await db.runTransaction(async (transaction) => {
    await transaction.get(schedulingLockRef);
    const [profile, publicProfile, subject, assignment, overlaps] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(publicProfileRef),
      transaction.get(subjectRef),
      transaction.get(assignmentRef),
      transaction.get(overlapsQuery),
    ]);

    if (!profile.exists || profile.get('rol') !== 'profesor') {
      throw new HttpsError('permission-denied', 'Solo un profesor puede publicar horarios.');
    }
    if (!publicProfile.exists || !validName(publicProfile.get('nombre'))
      || !subject.exists || subject.get('activa') !== true
      || !validName(subject.get('nombre'), 1, 120) || !assignment.exists) {
      throw new HttpsError('failed-precondition', 'La asignatura no está activa o no está asignada a tu perfil.');
    }
    if (!overlaps.empty) {
      throw new HttpsError('already-exists', 'El horario se cruza con otra franja publicada.');
    }

    transaction.create(slotRef, {
      profesorId: uid,
      profesorNombre: publicProfile.get('nombre'),
      asignaturaId,
      asignaturaNombre: subject.get('nombre'),
      inicio,
      fin,
      reservado: false,
      tieneHistorial: false,
      activo: true,
      creadoEn: FieldValue.serverTimestamp(),
    });
    // The per-professor lock serializes concurrent schedule creations so two
    // overlapping queries cannot both observe an empty result and commit.
    transaction.set(schedulingLockRef, { actualizadoEn: FieldValue.serverTimestamp() }, { merge: true });
  });

  return { horarioId: slotRef.id };
});

export const eliminarHorario = onCall(async (request) => {
  const uid = requireUniversityUser(request);
  const data = (request.data ?? {}) as CallableData;
  const horarioId = readId(data.horarioId, 'El horario');
  const slotRef = db.collection('horarios').doc(horarioId);
  const profileRef = db.collection('perfiles').doc(uid);

  await db.runTransaction(async (transaction) => {
    const [profile, slot] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(slotRef),
    ]);
    if (!profile.exists || profile.get('rol') !== 'profesor') {
      throw new HttpsError('permission-denied', 'Solo un profesor puede eliminar horarios.');
    }
    if (!slot.exists || slot.get('profesorId') !== uid) {
      throw new HttpsError('not-found', 'No se encontró un horario tuyo con ese identificador.');
    }
    const inicio = slot.get('inicio');
    if (!(inicio instanceof Timestamp)) {
      throw new HttpsError('failed-precondition', 'El horario no tiene una fecha válida.');
    }
    if (inicio.toMillis() <= Date.now() || slot.get('tieneHistorial') === true || slot.get('reservado') === true) {
      throw new HttpsError('failed-precondition', 'Solo se puede eliminar un horario futuro sin historial de reservas.');
    }
    transaction.delete(slotRef);
  });

  return { horarioId };
});

export const reservarHorario = onCall(async (request) => {
  const estudianteId = requireUniversityUser(request);
  const data = (request.data ?? {}) as CallableData;
  const horarioId = readId(data.horarioId, 'El horario');
  const publicProfileRef = db.collection('perfilesPublicos').doc(estudianteId);
  const slotRef = db.collection('horarios').doc(horarioId);
  const reservationRef = db.collection('reservas').doc();

  await db.runTransaction(async (transaction) => {
    const [role, publicProfile, slot] = await Promise.all([
      getRoleInTransaction(transaction, estudianteId),
      transaction.get(publicProfileRef),
      transaction.get(slotRef),
    ]);
    if (role !== 'estudiante') {
      throw new HttpsError('permission-denied', 'Solo los estudiantes pueden reservar asesorías.');
    }
    if (!publicProfile.exists || !validName(publicProfile.get('nombre')) || !slot.exists) {
      throw new HttpsError('not-found', 'No se encontró el estudiante o el horario.');
    }
    const inicio = slot.get('inicio');
    const fin = slot.get('fin');
    const profesorId = slot.get('profesorId');
    const profesorNombre = slot.get('profesorNombre');
    const asignaturaId = slot.get('asignaturaId');
    const asignaturaNombre = slot.get('asignaturaNombre');
    if (!(inicio instanceof Timestamp) || !(fin instanceof Timestamp)
      || fin.toMillis() <= inicio.toMillis()
      || typeof profesorId !== 'string' || typeof asignaturaId !== 'string'
      || !validName(profesorNombre) || !validName(asignaturaNombre, 1, 120)) {
      throw new HttpsError('failed-precondition', 'El horario tiene datos incompletos o inválidos.');
    }
    if (slot.get('activo') !== true || slot.get('reservado') === true || inicio.toMillis() <= Date.now()) {
      throw new HttpsError('failed-precondition', 'El horario ya no está disponible. Actualiza los resultados.');
    }

    transaction.create(reservationRef, {
      horarioId,
      estudianteId,
      estudianteNombre: publicProfile.get('nombre'),
      profesorId,
      profesorNombre,
      asignaturaId,
      asignaturaNombre,
      inicio,
      fin,
      estado: 'pendiente',
      creadaEn: FieldValue.serverTimestamp(),
      actualizadaEn: FieldValue.serverTimestamp(),
    });
    transaction.update(slotRef, {
      reservado: true,
      tieneHistorial: true,
      reservaId: reservationRef.id,
    });
  });

  return { reservaId: reservationRef.id };
});

export const cambiarEstadoReserva = onCall(async (request) => {
  const uid = requireUniversityUser(request);
  const data = (request.data ?? {}) as CallableData;
  const reservaId = readId(data.reservaId, 'La reserva');
  const nuevoEstado = data.nuevoEstado;
  if (nuevoEstado !== 'confirmada' && nuevoEstado !== 'cancelada' && nuevoEstado !== 'realizada') {
    throw new HttpsError('invalid-argument', 'El nuevo estado no está permitido.');
  }

  const reservationRef = db.collection('reservas').doc(reservaId);

  await db.runTransaction(async (transaction) => {
    const [role, reservation] = await Promise.all([
      getRoleInTransaction(transaction, uid),
      transaction.get(reservationRef),
    ]);
    if (!reservation.exists) throw new HttpsError('not-found', 'No se encontró la reserva.');

    const state = reservation.get('estado');
    const start = reservation.get('inicio');
    const end = reservation.get('fin');
    if ((state !== 'pendiente' && state !== 'confirmada' && state !== 'realizada' && state !== 'cancelada')
      || !(start instanceof Timestamp) || !(end instanceof Timestamp)
      || end.toMillis() <= start.toMillis()) {
      throw new HttpsError('failed-precondition', 'La reserva tiene datos incompletos o inválidos.');
    }
    const studentOwns = role === 'estudiante' && reservation.get('estudianteId') === uid;
    const professorOwns = role === 'profesor' && reservation.get('profesorId') === uid;
    const now = Date.now();
    let valid = false;

    if (nuevoEstado === 'confirmada') {
      valid = professorOwns && state === 'pendiente' && start.toMillis() > now;
    } else if (nuevoEstado === 'cancelada') {
      valid = (studentOwns || professorOwns)
        && (state === 'pendiente' || state === 'confirmada')
        && start.toMillis() > now;
    } else {
      valid = professorOwns && state === 'confirmada' && end.toMillis() <= now;
    }

    if (!valid) {
      throw new HttpsError('failed-precondition', 'La acción no está permitida para este rol, estado o momento.');
    }

    let slotRef: DocumentReference | undefined;
    let slot: DocumentSnapshot | undefined;
    if (nuevoEstado === 'cancelada') {
      const horarioId = readId(reservation.get('horarioId'), 'El horario');
      slotRef = db.collection('horarios').doc(horarioId);
      slot = await transaction.get(slotRef);
      if (!slot.exists || slot.get('reservaId') !== reservaId) {
        throw new HttpsError('failed-precondition', 'El horario ya no corresponde a esta reserva. Actualiza el listado.');
      }
    }

    transaction.update(reservationRef, {
      estado: nuevoEstado,
      actualizadaEn: FieldValue.serverTimestamp(),
    });
    if (slotRef && slot?.exists) {
      transaction.update(slotRef, {
        reservado: false,
        reservaId: FieldValue.delete(),
      });
    }
  });

  return { reservaId, estado: nuevoEstado };
});
