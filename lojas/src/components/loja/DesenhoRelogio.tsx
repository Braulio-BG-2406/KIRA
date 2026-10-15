/** relógio desenhado em traço fino (sem marca), usado quando ainda não há foto */
export function DesenhoRelogio({ className = "", traco = 1.6 }: { className?: string; traco?: number }) {
  const marcas = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg viewBox="0 0 120 200" fill="none" stroke="currentColor" strokeWidth={traco} className={className} aria-hidden>
      <path d="M44 8h32l4 46H40l4-46ZM44 192h32l4-46H40l4 46Z" strokeLinejoin="round" />
      <circle cx="60" cy="100" r="46" />
      <circle cx="60" cy="100" r="38" strokeWidth={traco * 0.6} opacity=".7" />
      {marcas.map((g) => (
        <line key={g} x1="60" y1={g % 90 === 0 ? 66 : 64} x2="60" y2="70" strokeWidth={g % 90 === 0 ? traco * 1.5 : traco * 0.75} transform={`rotate(${g} 60 100)`} />
      ))}
      <line x1="60" y1="100" x2="60" y2="76" strokeWidth={traco * 1.6} strokeLinecap="round" transform="rotate(305 60 100)" />
      <line x1="60" y1="100" x2="60" y2="70" strokeWidth={traco * 1.1} strokeLinecap="round" transform="rotate(60 60 100)" />
      <circle cx="60" cy="100" r={traco * 1.5} fill="currentColor" />
      <rect x="105" y="95" width="6" height="10" rx="1.5" />
    </svg>
  );
}
