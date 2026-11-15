import { useState, type FormEvent, type ReactNode } from 'react';
import {
  IonApp,
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLoading,
  IonPage,
  IonRouterOutlet,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Link, Navigate, Route } from 'react-router-dom';
import { AuthProvider, firebaseConfigured, useAuth } from './auth/AuthProvider';
import { DefaultPortalRoute, ProfessorRequests, ProfessorSchedule, StudentBookings, StudentSearch } from './features/AdvisorPortal';

function AuthScreen({ register = false }: { register?: boolean }) {
  const { signIn, register: createAccount, error: authError, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    clearError();
    const normalizedEmail = email.trim().toLowerCase();
    if (register && name.trim().length < 3) {
      setError('Escribe tu nombre completo (al menos 3 caracteres).');
      return;
    }
    if (register && !/^[^@\s]+@uao\.edu\.co$/.test(normalizedEmail)) {
      setError('Regístrate con tu correo institucional @uao.edu.co.');
      return;
    }
    setBusy(true);
    try {
      if (register) {
        await createAccount(name, normalizedEmail, password);
        setMessage('Te enviamos un enlace para confirmar tu correo institucional.');
      }
      else await signIn(normalizedEmail, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <IonPage>
      <IonContent fullscreen className="auth-content">
        <main className="auth-layout">
          <section className="auth-brand">
            <div className="brand-mark">UAO</div>
            <p className="eyebrow">Universidad Autónoma de Occidente</p>
            <h1>Asesorías entre estudiantes y profesores.</h1>
            <p className="brand-copy">Encuentra acompañamiento académico y organiza tus espacios de asesoría desde cualquier dispositivo.</p>
          </section>
          <section className="auth-card">
            <div className="auth-card-heading">
              <p className="eyebrow">PLATAFORMA ACADÉMICA</p>
              <h2>{register ? 'Crea tu cuenta' : 'Bienvenido de nuevo'}</h2>
              <p>{register ? 'Regístrate como estudiante para comenzar.' : 'Ingresa para gestionar tus asesorías.'}</p>
            </div>
            <form onSubmit={submit}>
              {register && <IonItem className="form-item"><IonInput label="Nombre completo" labelPlacement="stacked" autocomplete="name" value={name} onIonInput={(e) => setName(e.detail.value ?? '')} required minlength={3} maxlength={100} /></IonItem>}
              <IonItem className="form-item"><IonInput label="Correo institucional" labelPlacement="stacked" type="email" autocomplete="email" value={email} onIonInput={(e) => setEmail(e.detail.value ?? '')} required /></IonItem>
              <IonItem className="form-item"><IonInput label="Contraseña" labelPlacement="stacked" type="password" autocomplete={register ? 'new-password' : 'current-password'} value={password} onIonInput={(e) => setPassword(e.detail.value ?? '')} required minlength={8} /></IonItem>
              {(error || authError) && <IonText color="danger"><p className="form-error">{error || authError}</p></IonText>}
              {message && <IonText color="success"><p className="form-error">{message}</p></IonText>}
              <IonButton expand="block" type="submit" disabled={busy} className="primary-action">{register ? 'Crear cuenta' : 'Iniciar sesión'}</IonButton>
            </form>
            <p className="auth-switch">{register ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'} <Link to={register ? '/login' : '/registro'}>{register ? 'Inicia sesión' : 'Regístrate'}</Link></p>
          </section>
        </main>
      </IonContent>
      <IonLoading isOpen={busy} message="Un momento…" />
    </IonPage>
  );
}

function Home() {
  const { profile, user, loading } = useAuth();
  if (loading) return <IonPage><IonContent><IonLoading isOpen message="Cargando tu perfil…" /></IonContent></IonPage>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfilePending />;
  return <DefaultPortalRoute />;
}

function PortalGate({ role, children }: { role: 'estudiante' | 'profesor'; children: ReactNode }) {
  const { profile, user, loading } = useAuth();
  if (loading) return <IonPage><IonContent><IonLoading isOpen message="Cargando…" /></IonContent></IonPage>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) return <ProfilePending />;
  if (profile.rol !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ProfilePending() {
  const { signOutUser, error, verificationPending, resendVerification, refreshProfile } = useAuth();
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');
  async function run(action: () => Promise<void>, confirmation: string) {
    setMessage('');
    setActionError('');
    try {
      await action();
      setMessage(confirmation);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'No se pudo completar la solicitud.');
    }
  }
  return <IonPage><IonToolbar><IonTitle>Asesorías UAO</IonTitle></IonToolbar><IonContent className="home-content"><main className="pending-card"><p className="eyebrow">PERFIL PENDIENTE</p><h1>{verificationPending ? 'Confirma tu correo institucional.' : 'Tu cuenta aún no tiene un perfil habilitado.'}</h1><p>{error || 'Pide al equipo administrador que revise tu perfil en Firestore. Los roles de profesor se asignan desde el entorno administrativo.'}</p>{verificationPending && <><IonButton onClick={() => void run(resendVerification, 'Enviamos otro enlace de confirmación.')}>Reenviar correo</IonButton><IonButton fill="outline" onClick={() => void run(refreshProfile, 'Revisamos tu cuenta.')}>Ya confirmé mi correo</IonButton></>}{message && <p>{message}</p>}{actionError && <IonText color="danger"><p>{actionError}</p></IonText>}<IonButton fill="clear" onClick={() => void signOutUser()}>Cerrar sesión</IonButton></main></IonContent></IonPage>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <IonApp><IonLoading isOpen message="Cargando…" /></IonApp>;
  return <IonApp><IonReactRouter><IonRouterOutlet>
    <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthScreen />} />
    <Route path="/registro" element={user ? <Navigate to="/" replace /> : <AuthScreen register />} />
    <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
    <Route path="/buscar" element={<PortalGate role="estudiante"><StudentSearch /></PortalGate>} />
    <Route path="/reservas" element={<PortalGate role="estudiante"><StudentBookings /></PortalGate>} />
    <Route path="/horarios" element={<PortalGate role="profesor"><ProfessorSchedule /></PortalGate>} />
    <Route path="/solicitudes" element={<PortalGate role="profesor"><ProfessorRequests /></PortalGate>} />
    <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
  </IonRouterOutlet></IonReactRouter></IonApp>;
}

export default function App() {
  if (!firebaseConfigured) {
    return <IonApp><IonPage><IonContent className="setup-content"><div className="setup-card"><p className="eyebrow">CONFIGURACIÓN INICIAL</p><IonTitle>Conecta el proyecto con Firebase</IonTitle><p>Copia <code>.env.example</code> como <code>.env.local</code>, completa la configuración de tu aplicación web Firebase y activa Authentication con correo y contraseña.</p><p>Los datos de Firebase se leen desde variables de entorno y no se guardan en el repositorio.</p></div></IonContent></IonPage></IonApp>;
  }
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
