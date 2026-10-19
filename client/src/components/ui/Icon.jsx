const paths = {
  overview: 'M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-12h8V3h-8v6Z',
  request: 'M12 5v14m7-7H5',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5M12 7v5l3 2',
  profile: 'M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87m-1-12a4 4 0 0 1 0 7.75',
  template: 'M6 2h9l5 5v15H6V2Zm8 0v6h6M9 13h8M9 17h6',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-13v2m0 15v2m9.5-9.5h-2m-15 0h-2m16.2-6.2-1.4 1.4M6.7 17.3l-1.4 1.4m13.4 0-1.4-1.4M6.7 6.7 5.3 5.3',
  integration: 'M8 12h8m-5-3 3 3-3 3M5 5h3v14H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Zm14 0h-3v14h3a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3Z',
  logout: 'M10 17l5-5-5-5m5 5H3m10-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  arrow: 'm9 18 6-6-6-6',
  download: 'M12 3v12m-5-5 5 5 5-5M5 21h14',
  check: 'm5 12 4 4L19 6',
  alert: 'M12 9v4m0 4h.01M10.3 3.8 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z',
  refresh: 'M20 6v6h-6M4 18v-6h6m9.1-5A8 8 0 0 0 5.3 8M4.9 17A8 8 0 0 0 18.7 16',
  edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z',
  trash: 'M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 11v5m4-5v5',
  search: 'm21 21-4.4-4.4m2.4-5.6a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  external: 'M14 3h7v7m0-7-9 9M5 7H3v14h14v-2',
  file: 'M6 2h9l5 5v15H6V2Zm8 0v6h6',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm-3-10 2 2 4-4',
};

export function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill={['overview'].includes(name) ? 'currentColor' : 'none'}
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d={paths[name] || paths.file}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
