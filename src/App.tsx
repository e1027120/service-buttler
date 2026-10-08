import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PageLoader } from './components/ui';
import { RequireAuth } from './lib/auth';
import LivePage from './pages/live/LivePage';

// Admin is code-split so attendees scanning the QR code download only the landing page.
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const ChurchPicker = lazy(() => import('./pages/admin/ChurchPicker'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Services = lazy(() => import('./pages/admin/Services'));
const Actions = lazy(() => import('./pages/admin/Actions'));
const SlidesLibrary = lazy(() => import('./pages/admin/SlidesLibrary'));
const AppDeeplinks = lazy(() => import('./pages/admin/AppDeeplinks'));
const Responses = lazy(() => import('./pages/admin/Responses'));
const Branding = lazy(() => import('./pages/admin/Branding'));
const Team = lazy(() => import('./pages/admin/Team'));
const Share = lazy(() => import('./pages/admin/Share'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* Public attendee landing page (QR / NFC target) */}
        <Route path="/c/:churchSlug" element={<LivePage />} />
        <Route path="/c/:churchSlug/:serviceSlug" element={<LivePage />} />

        {/* Management backend */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <ChurchPicker />
            </RequireAuth>
          }
        />
        <Route
          path="/admin/:churchId"
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="services" element={<Services />} />
          <Route path="actions" element={<Actions />} />
          <Route path="slides" element={<SlidesLibrary />} />
          <Route path="deeplinks" element={<AppDeeplinks />} />
          <Route path="responses" element={<Responses />} />
          <Route path="branding" element={<Branding />} />
          <Route path="team" element={<Team />} />
          <Route path="share" element={<Share />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
