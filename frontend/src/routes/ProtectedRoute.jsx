import { Navigate } from 'react-router-dom';
import { getToken, isTokenExpired } from '../utils/auth';

export default function ProtectedRoute({ children }) {
  const token = getToken();
  if (!token || isTokenExpired(token)) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}
