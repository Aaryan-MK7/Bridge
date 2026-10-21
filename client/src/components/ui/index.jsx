import { useEffect, useId, useRef } from 'react';
import { Icon } from './Icon.jsx';

export function Button({
  children,
  className = '',
  icon,
  loading = false,
  variant = 'primary',
  type = 'button',
  ...props
}) {
  return (
    <button
      className={`button button--${variant} ${className}`}
      disabled={loading || props.disabled}
      type={type}
      {...props}
    >
      {loading ? <span aria-hidden="true" className="spinner spinner--button" /> : null}
      {!loading && icon ? <Icon name={icon} size={18} /> : null}
      <span>{loading ? 'Working…' : children}</span>
    </button>
  );
}

export function Card({ children, className = '', ...props }) {
  return <section className={`card ${className}`} {...props}>{children}</section>;
}

export function PageHeader({ actions, eyebrow, title, description }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-header__description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}

export function Field({ children, error, hint, label, required, ...props }) {
  const fieldId = props.id || props.name;
  const describedBy = [
    hint ? `${fieldId}-hint` : null,
    error ? `${fieldId}-error` : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <div className="field">
      <label htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children || <input {...props} id={fieldId} aria-describedby={describedBy} aria-invalid={Boolean(error)} />}
      {hint ? <span className="field__hint" id={`${fieldId}-hint`}>{hint}</span> : null}
      {error ? <span className="field__error" id={`${fieldId}-error`} role="alert">{error}</span> : null}
    </div>
  );
}

export function Alert({ children, title, variant = 'info' }) {
  return (
    <div className={`alert alert--${variant}`} role={variant === 'danger' ? 'alert' : 'status'}>
      <Icon name={variant === 'success' ? 'check' : 'alert'} size={19} />
      <div>
        {title ? <strong>{title}</strong> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  const normalized = String(status || 'pending').toLowerCase().replace(/\s+/g, '_');
  return (
    <span className={`status status--${normalized}`}>
      <span aria-hidden="true" className="status__dot" />
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

export function EmptyState({ action, description, icon = 'file', title }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Icon name={icon} size={24} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function LoadingState({ label = 'Loading' }) {
  return (
    <div aria-live="polite" className="loading-state">
      <span aria-hidden="true" className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function Dialog({ children, description, onClose, open, title }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const focusable = () => [...dialog.querySelectorAll(focusableSelector)];
    const frame = window.requestAnimationFrame(() => {
      (focusable()[0] || dialog).focus();
    });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className="dialog"
        ref={dialogRef}
        role="dialog"
        tabIndex="-1"
      >
        <header className="dialog__header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button">
            <Icon name="close" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function StatCard({ accent = 'indigo', icon, label, value, detail }) {
  return (
    <Card className={`stat-card stat-card--${accent}`}>
      <div className="stat-card__top">
        <span className="stat-card__icon"><Icon name={icon} /></span>
        <span className="stat-card__value">{value}</span>
      </div>
      <p className="stat-card__label">{label}</p>
      {detail ? <p className="stat-card__detail">{detail}</p> : null}
    </Card>
  );
}
