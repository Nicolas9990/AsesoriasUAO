import { useEffect, useMemo, useState, type PropsWithChildren, type ReactNode } from 'react';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLoading,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth, type UserRole } from '../auth/AuthProvider';

type Subject = { id: string; nombre: string };
type Slot = {
  id: string;
  profesorId: string;
  profesorNombre: string;
  asignaturaId: string;
  asignaturaNombre: string;
  inicio: Timestamp;
  fin: Timestamp;
  reservado: boolean;
  activo: boolean;
  tieneHistorial?: boolean;
};
type Booking = {
  id: string;
  horarioId: string;
  estudianteId: string;
  estudianteNombre: string;
  profesorId: string;
  profesorNombre: string;
  asignaturaNombre: string;
  inicio: Timestamp;
  fin: Timestamp;
  estado: 'pendiente' | 'confirmada' | 'cancelada' | 'realizada';
};

const dateFormat = new Intl.DateTimeFormat('es-CO', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota',
});

function todayInBogota() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateTimeInBogota(date: string, time: string) {
  return new Date(`${date}T${time}:00-05:00`);
}

function formatDate(value: Timestamp) {
  return dateFormat.format(value.toDate());
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'No se pudo completar la solicitud.';
}

function callFunction<TInput extends Record<string, unknown>, TOutput>(name: string, data: TInput) {
  if (!db) return Promise.reject(new Error('Completa la configuración de Firebase.'));
  return httpsCallable<TInput, TOutput>(getFunctions(), name)(data).then((result) => result.data);
}

function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!db) return;
    const subjectQuery = query(
      collection(db, 'asignaturas'),
      where('activa', '==', true),
      orderBy('nombre'),
    );
    return onSnapshot(subjectQuery, (snapshot) => {
      setSubjects(snapshot.docs.map((item) => ({ id: item.id, nombre: String(item.get('nombre') ?? '') })));
      setError('');
      setLoading(false);
    }, (cause) => {
      setError(errorMessage(cause));
      setLoading(false);
    });
  }, []);
  return { subjects, loading, error };
}

function useLiveList<T>(path: string, constraints: QueryConstraint[], mapper: (id: string, data: DocumentData) => T) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, path), ...constraints);
    return onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map((item) => mapper(item.id, item.data())));
      setError('');
      setLoading(false);
    }, (cause) => {
      setError(errorMessage(cause));
      setLoading(false);
    });
  // Callers memoize constraints; live snapshots keep availability and booking states current.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, constraints]);
  return { items, loading, error };
}

function toSlot(id: string, data: DocumentData): Slot {
  return {
    id,
    profesorId: String(data.profesorId ?? ''),
    profesorNombre: String(data.profesorNombre ?? 'Profesor'),
    asignaturaId: String(data.asignaturaId ?? ''),
    asignaturaNombre: String(data.asignaturaNombre ?? 'Asignatura'),
    inicio: data.inicio as Timestamp,
    fin: data.fin as Timestamp,
    reservado: data.reservado === true,
    activo: data.activo === true,
    tieneHistorial: data.tieneHistorial === true,
  };
}

function toBooking(id: string, data: DocumentData): Booking {
  return {
    id,
    horarioId: String(data.horarioId ?? ''),
    estudianteId: String(data.estudianteId ?? ''),
    estudianteNombre: String(data.estudianteNombre ?? 'Estudiante'),
    profesorId: String(data.profesorId ?? ''),
    profesorNombre: String(data.profesorNombre ?? 'Profesor'),
    asignaturaNombre: String(data.asignaturaNombre ?? 'Asignatura'),
    inicio: data.inicio as Timestamp,
    fin: data.fin as Timestamp,
    estado: data.estado,
  };
}

function PortalFrame({ title, children }: PropsWithChildren<{ title: string }>) {
  const { profile, signOutUser } = useAuth();
  const location = useLocation();
  const links = profile?.rol === 'estudiante'
    ? [['/buscar', 'Buscar asesorías'], ['/reservas', 'Mis reservas']]
    : [['/horarios', 'Mis horarios'], ['/solicitudes', 'Solicitudes']];
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar className="home-toolbar">
          <IonTitle>Asesorías UAO</IonTitle>
          <IonButtons slot="end"><IonButton onClick={() => void signOutUser()}>Salir</IonButton></IonButtons>
        </IonToolbar>
        <IonToolbar className="portal-nav">
          <IonButtons className="portal-nav-buttons">
            {links.map(([path, label]) => <IonButton key={path} fill={location.pathname === path ? 'solid' : 'clear'} routerLink={path}>{label}</IonButton>)}
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="home-content">
        <main className="portal-shell">
          <p className="eyebrow">{profile?.rol === 'profesor' ? 'ESPACIO DOCENTE' : 'ESPACIO ESTUDIANTIL'}</p>
          <h1 className="portal-title">{title}</h1>
          {children}
        </main>
      </IonContent>
    </IonPage>
  );
}

function InlineState({ children, danger = false }: PropsWithChildren<{ danger?: boolean }>) {
  return <p className={danger ? 'portal-state portal-state-error' : 'portal-state'}>{children}</p>;
}

function SlotCard({ slot, action }: { slot: Slot; action: ReactNode }) {
  return <IonCard className="portal-card"><IonCardHeader>
    <IonCardSubtitle>{slot.asignaturaNombre}</IonCardSubtitle>
    <IonCardTitle>{formatDate(slot.inicio)}</IonCardTitle>
  </IonCardHeader><IonCardContent>
    <p>Profesor: {slot.profesorNombre}</p>
    <p>Duración: {Math.round((slot.fin.toMillis() - slot.inicio.toMillis()) / 60000)} minutos</p>
    {action}
  </IonCardContent></IonCard>;
}

export function StudentSearch() {
  const { user } = useAuth();
  const { subjects, loading: subjectsLoading, error: subjectsError } = useSubjects();
  const [subjectId, setSubjectId] = useState('');
  const [fromDate, setFromDate] = useState(todayInBogota);
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const start = useMemo(() => Timestamp.fromDate(dateTimeInBogota(fromDate, '00:00')), [fromDate]);
  const end = useMemo(() => Timestamp.fromDate(new Date(start.toMillis() + 7 * 24 * 60 * 60 * 1000)), [start]);
  const constraints = useMemo(() => {
    const filters: QueryConstraint[] = [
      where('activo', '==', true), where('reservado', '==', false),
      where('inicio', '>=', start), where('inicio', '<', end), orderBy('inicio'), limit(50),
    ];
    if (subjectId) filters.splice(2, 0, where('asignaturaId', '==', subjectId));
    return filters;
  }, [start, end, subjectId]);
  const { items: slots, loading, error } = useLiveList<Slot>('horarios', constraints, toSlot);

  async function reserve(slot: Slot) {
    if (!user) return;
    setNotice('');
    setBusyId(slot.id);
    try {
      await callFunction<{ horarioId: string }, { reservaId: string }>('reservarHorario', { horarioId: slot.id });
      setNotice('Tu solicitud se envió al profesor. Puedes consultar su estado en Mis reservas.');
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusyId(''); }
  }

  return <PortalFrame title="Encuentra una asesoría">
    <p className="portal-lede">Filtra por asignatura y fecha. Los horarios disponibles se actualizan en tiempo real.</p>
    <section className="filter-card">
      <IonItem><IonSelect label="Asignatura" labelPlacement="stacked" value={subjectId} onIonChange={(e) => setSubjectId(e.detail.value ?? '')} interface="popover">
        <IonSelectOption value="">Todas las asignaturas</IonSelectOption>
        {subjects.map((subject) => <IonSelectOption key={subject.id} value={subject.id}>{subject.nombre}</IonSelectOption>)}
      </IonSelect></IonItem>
      <IonItem><IonInput label="Desde" labelPlacement="stacked" type="date" value={fromDate} min={todayInBogota()} onIonInput={(e) => setFromDate(String(e.detail.value ?? '').slice(0, 10))} /></IonItem>
    </section>
    {notice && <InlineState>{notice}</InlineState>}
    {subjectsLoading && <InlineState>Cargando asignaturas…</InlineState>}
    {subjectsError && <InlineState danger>No se pudieron cargar las asignaturas: {subjectsError}</InlineState>}
    {loading && <IonLoading isOpen message="Buscando horarios…" />}
    {error && <InlineState danger>No se pudieron cargar horarios. Verifica índices y permisos de Firestore. {error}</InlineState>}
    {!loading && !error && slots.length === 0 && <InlineState>No hay horarios disponibles para los filtros seleccionados.</InlineState>}
    <div className="portal-grid">{slots.map((slot) => <SlotCard key={slot.id} slot={slot} action={<IonButton expand="block" disabled={!!busyId} onClick={() => void reserve(slot)}>{busyId === slot.id ? 'Enviando…' : 'Solicitar asesoría'}</IonButton>} />)}</div>
  </PortalFrame>;
}

function StatusBadge({ status }: { status: Booking['estado'] }) {
  const color = status === 'confirmada' || status === 'realizada' ? 'success' : status === 'cancelada' ? 'medium' : 'warning';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <IonBadge color={color}>{label}</IonBadge>;
}

function BookingCard({ booking, role, actions }: { booking: Booking; role: UserRole; actions?: ReactNode }) {
  const counterpart = role === 'estudiante' ? `Profesor: ${booking.profesorNombre}` : `Estudiante: ${booking.estudianteNombre}`;
  return <IonCard className="portal-card"><IonCardHeader>
    <IonCardSubtitle>{booking.asignaturaNombre}</IonCardSubtitle>
    <IonCardTitle>{formatDate(booking.inicio)}</IonCardTitle>
  </IonCardHeader><IonCardContent>
    <p>{counterpart}</p><p>Estado: <StatusBadge status={booking.estado} /></p>{actions}
  </IonCardContent></IonCard>;
}

export function StudentBookings() {
  const { user } = useAuth();
  const constraints = useMemo(() => user ? [where('estudianteId', '==', user.uid), orderBy('creadaEn', 'desc'), limit(100)] : [], [user?.uid]);
  const { items, loading, error } = useLiveList<Booking>('reservas', constraints, toBooking);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  async function cancel(booking: Booking) {
    setBusyId(booking.id); setNotice('');
    try {
      await callFunction<{ reservaId: string; nuevoEstado: string }, { reservaId: string; estado: string }>('cambiarEstadoReserva', { reservaId: booking.id, nuevoEstado: 'cancelada' });
      setNotice('La asesoría fue cancelada.');
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusyId(''); }
  }
  return <PortalFrame title="Mis reservas">
    <p className="portal-lede">Consulta las solicitudes y el estado de tus próximas asesorías.</p>
    {notice && <InlineState>{notice}</InlineState>}{loading && <IonLoading isOpen message="Cargando reservas…" />}
    {error && <InlineState danger>No se pudieron cargar tus reservas: {error}</InlineState>}
    {!loading && !error && items.length === 0 && <InlineState>Aún no tienes reservas. Busca un horario para solicitar tu primera asesoría.</InlineState>}
    <div className="portal-grid">{items.map((booking) => <BookingCard key={booking.id} booking={booking} role="estudiante" actions={booking.estado !== 'cancelada' && booking.estado !== 'realizada' && booking.inicio.toMillis() > Date.now() ? <IonButton fill="outline" color="danger" disabled={!!busyId} onClick={() => void cancel(booking)}>{busyId === booking.id ? 'Cancelando…' : 'Cancelar solicitud'}</IonButton> : null} />)}</div>
  </PortalFrame>;
}

export function ProfessorSchedule() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!db || !user) return;
    let active = true;
    async function loadAssignedSubjects() {
      try {
        const assignmentSnapshot = await getDocs(collection(db!, 'perfiles', user!.uid, 'asignaturas'));
        const assigned = await Promise.all(assignmentSnapshot.docs.map(async (assignment) => {
          const subject = await getDoc(doc(db!, 'asignaturas', assignment.id));
          return subject.exists() && subject.get('activa') === true
            ? { id: subject.id, nombre: String(subject.get('nombre') ?? '') }
            : null;
        }));
        if (active) setSubjects(assigned.filter((item): item is Subject => item !== null));
      } catch (cause) { if (active) setSubjectsError(errorMessage(cause)); }
      finally { if (active) setSubjectsLoading(false); }
    }
    void loadAssignedSubjects();
    return () => { active = false; };
  }, [user?.uid]);

  const constraints = useMemo(() => user ? [where('profesorId', '==', user.uid), where('inicio', '>=', Timestamp.now()), orderBy('inicio'), limit(100)] : [], [user?.uid]);
  const { items: slots, loading, error } = useLiveList<Slot>('horarios', constraints, toSlot);

  async function createSchedule() {
    if (!subjectId || !date || !time) { setNotice('Selecciona una asignatura, fecha y hora.'); return; }
    const start = dateTimeInBogota(date, time);
    const finish = new Date(start.getTime() + duration * 60000);
    if (Number.isNaN(start.getTime()) || finish.toDateString() !== start.toDateString() || start.getTime() <= Date.now()) {
      setNotice('El horario debe ser futuro y terminar el mismo día.'); return;
    }
    setBusy(true); setNotice('');
    try {
      await callFunction<{ asignaturaId: string; inicioMs: number; finMs: number }, { horarioId: string }>('crearHorario', {
        asignaturaId: subjectId, inicioMs: start.getTime(), finMs: finish.getTime(),
      });
      setNotice('Horario publicado. Ya aparece en la búsqueda de asesorías.');
      setDate(''); setTime('');
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function removeSchedule(slot: Slot) {
    setBusy(true); setNotice('');
    try {
      await callFunction<{ horarioId: string }, { horarioId: string }>('eliminarHorario', { horarioId: slot.id });
      setNotice('Horario eliminado.');
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <PortalFrame title="Mis horarios">
    <p className="portal-lede">Publica los espacios disponibles para las asignaturas que tienes asignadas.</p>
    <section className="schedule-form">
      <h2>Publicar un horario</h2>
      {subjectsLoading ? <InlineState>Cargando tus asignaturas…</InlineState> : subjects.length === 0 ? <InlineState danger>No tienes asignaturas activas asignadas. Solicita al administrador que habilite tus materias.</InlineState> : <>
        <div className="filter-card">
          <IonItem><IonSelect label="Asignatura" labelPlacement="stacked" value={subjectId} onIonChange={(e) => setSubjectId(e.detail.value ?? '')} interface="popover">
            {subjects.map((subject) => <IonSelectOption key={subject.id} value={subject.id}>{subject.nombre}</IonSelectOption>)}
          </IonSelect></IonItem>
          <IonItem><IonInput label="Fecha" labelPlacement="stacked" type="date" min={todayInBogota()} value={date} onIonInput={(e) => setDate(String(e.detail.value ?? '').slice(0, 10))} /></IonItem>
          <IonItem><IonInput label="Hora de inicio" labelPlacement="stacked" type="time" value={time} onIonInput={(e) => setTime(String(e.detail.value ?? '').slice(0, 5))} /></IonItem>
          <IonItem><IonSelect label="Duración" labelPlacement="stacked" value={duration} onIonChange={(e) => setDuration(Number(e.detail.value))} interface="popover">
            {[30, 45, 60, 90, 120].map((minutes) => <IonSelectOption key={minutes} value={minutes}>{minutes} minutos</IonSelectOption>)}
          </IonSelect></IonItem>
        </div>
        <IonButton className="form-submit" disabled={busy} onClick={() => void createSchedule()}>{busy ? 'Guardando…' : 'Publicar horario'}</IonButton>
      </>}
      {subjectsError && <InlineState danger>{subjectsError}</InlineState>}
    </section>
    {notice && <InlineState>{notice}</InlineState>}
    <h2 className="section-heading">Próximos horarios</h2>
    {loading && <IonLoading isOpen message="Cargando horarios…" />}{error && <InlineState danger>No se pudieron cargar tus horarios: {error}</InlineState>}
    {!loading && !error && slots.length === 0 && <InlineState>No tienes horarios próximos publicados.</InlineState>}
    <div className="portal-grid">{slots.map((slot) => <SlotCard key={slot.id} slot={slot} action={<>
      {slot.reservado ? <IonBadge color="warning">Reservado</IonBadge> : <IonBadge color="success">Disponible</IonBadge>}
      {!slot.reservado && !slot.tieneHistorial && <IonButton fill="outline" color="danger" disabled={busy} onClick={() => void removeSchedule(slot)}>{busy ? 'Eliminando…' : 'Eliminar horario'}</IonButton>}
    </>} />)}</div>
  </PortalFrame>;
}

export function ProfessorRequests() {
  const { user } = useAuth();
  const constraints = useMemo(() => user ? [where('profesorId', '==', user.uid), orderBy('creadaEn', 'desc'), limit(100)] : [], [user?.uid]);
  const { items, loading, error } = useLiveList<Booking>('reservas', constraints, toBooking);
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  async function update(booking: Booking, state: 'confirmada' | 'cancelada' | 'realizada') {
    setBusyId(booking.id); setNotice('');
    try {
      await callFunction<{ reservaId: string; nuevoEstado: string }, { reservaId: string; estado: string }>('cambiarEstadoReserva', { reservaId: booking.id, nuevoEstado: state });
      setNotice(state === 'confirmada' ? 'Reserva confirmada.' : state === 'cancelada' ? 'Reserva cancelada.' : 'Asesoría marcada como realizada.');
    } catch (cause) { setNotice(errorMessage(cause)); }
    finally { setBusyId(''); }
  }
  return <PortalFrame title="Solicitudes de asesoría">
    <p className="portal-lede">Revisa las solicitudes de tus estudiantes y actualiza su estado.</p>
    {notice && <InlineState>{notice}</InlineState>}{loading && <IonLoading isOpen message="Cargando solicitudes…" />}
    {error && <InlineState danger>No se pudieron cargar las solicitudes: {error}</InlineState>}
    {!loading && !error && items.length === 0 && <InlineState>Aún no tienes solicitudes de asesoría.</InlineState>}
    <div className="portal-grid">{items.map((booking) => {
      const actions = <div className="booking-actions">
        {booking.estado === 'pendiente' && booking.inicio.toMillis() > Date.now() && <>
          <IonButton disabled={!!busyId} onClick={() => void update(booking, 'confirmada')}>{busyId === booking.id ? 'Guardando…' : 'Confirmar'}</IonButton>
          <IonButton fill="outline" color="danger" disabled={!!busyId} onClick={() => void update(booking, 'cancelada')}>Rechazar / cancelar</IonButton>
        </>}
        {booking.estado === 'confirmada' && booking.inicio.toMillis() > Date.now() && <IonButton fill="outline" color="danger" disabled={!!busyId} onClick={() => void update(booking, 'cancelada')}>Cancelar</IonButton>}
        {booking.estado === 'confirmada' && booking.fin.toMillis() <= Date.now() && <IonButton disabled={!!busyId} onClick={() => void update(booking, 'realizada')}>Marcar realizada</IonButton>}
      </div>;
      return <BookingCard key={booking.id} booking={booking} role="profesor" actions={actions} />;
    })}</div>
  </PortalFrame>;
}

export function DefaultPortalRoute() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { navigate(profile?.rol === 'profesor' ? '/horarios' : '/buscar', { replace: true }); }, [navigate, profile?.rol]);
  return <IonPage><IonContent><IonLoading isOpen message="Abriendo tu espacio…" /></IonContent></IonPage>;
}
