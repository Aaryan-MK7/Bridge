import { Link } from 'react-router-dom';

import { Icon } from '../../components/ui/Icon.jsx';

export default function AuthLayout({ children, eyebrow, title, description }) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="Bridge product information">
        <Link aria-label="Bridge home" className="auth-brand" to="/">
          <span className="brand__mark brand__mark--light" aria-hidden="true">B</span>
          <span>Bridge</span>
        </Link>
        <div className="auth-brand-panel__content">
          <p className="eyebrow eyebrow--light">Employee documents, connected</p>
          <h1>A clearer path from request to signed letter.</h1>
          <p>
            Request, review, and deliver employment letters through one secure workspace.
          </p>
          <ul className="auth-benefits">
            <li><Icon name="check" /> Track every request in one place</li>
            <li><Icon name="check" /> Keep employee information protected</li>
            <li><Icon name="check" /> Move approvals forward with confidence</li>
          </ul>
        </div>
        <p className="auth-brand-panel__footer">Bridge HR Operations</p>
      </section>

      <section className="auth-form-panel">
        <div className="auth-mobile-brand">
          <span className="brand__mark" aria-hidden="true">B</span>
          <strong>Bridge</strong>
        </div>
        <div className="auth-form-wrap">
          <div className="auth-heading">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
