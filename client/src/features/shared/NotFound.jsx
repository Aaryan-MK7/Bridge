import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth.js';
import { EmptyState } from '../../components/ui/index.jsx';

export default function NotFound() {
  const { employee, isAuthenticated } = useAuth();
  const destination = isAuthenticated
    ? employee.role === 'admin' ? '/admin' : '/employee'
    : '/login';

  return (
    <main className="standalone-state">
      <EmptyState
        action={<Link className="button button--primary" to={destination}>Return to Bridge</Link>}
        description="The page may have moved, or the address may be incorrect."
        title="Page not found"
      />
    </main>
  );
}
