export default function CountryFlag({ code, className = "" }: { code: string; className?: string }) {
  return <span className={`country-flag fi fi-${code.toLowerCase()} ${className}`} aria-hidden="true" />;
}
