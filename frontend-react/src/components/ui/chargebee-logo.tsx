export default function ChargebeeLogo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="48" height="48" rx="10" fill="#FF6633" />
      <path
        d="M24 10c-7.732 0-14 6.268-14 14s6.268 14 14 14c3.064 0 5.898-0.985 8.2-2.656a1 1 0 00-1.2-1.6A11.94 11.94 0 0124 36c-6.627 0-12-5.373-12-12S17.373 12 24 12s12 5.373 12 12a11.94 11.94 0 01-2.744 7.6 1 1 0 001.6 1.2A13.94 13.94 0 0038 24c0-7.732-6.268-14-14-14z"
        fill="white"
      />
      <path
        d="M24 17a7 7 0 100 14 7 7 0 000-14zm0 2a5 5 0 110 10 5 5 0 010-10z"
        fill="white"
      />
      <circle cx="24" cy="24" r="2.5" fill="white" />
    </svg>
  );
}
