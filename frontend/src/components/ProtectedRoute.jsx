import { Navigate, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function MobileNavigation() {
  return (
    <nav className="mobile-navigation" aria-label="Main navigation">
      <NavLink to="/" end>
        <span aria-hidden="true">✎</span><span>Journal</span>
      </NavLink>
      <NavLink to="/insights">
        <span aria-hidden="true">◒</span><span>Insights</span>
      </NavLink>
      <NavLink to="/photos">
        <span aria-hidden="true">▧</span><span>Photos</span>
      </NavLink>
    </nav>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="centered">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}<MobileNavigation /></>;
}
