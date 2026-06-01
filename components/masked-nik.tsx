"use client";

export function MaskedNik({ nik, className = "" }: { nik: string; className?: string }) {
  return (
    <span className={`group inline-block min-w-[156px] whitespace-nowrap font-semibold text-primary ${className}`}>
      <span className="group-hover:hidden">{maskNik(nik)}</span>
      <span className="hidden group-hover:inline">{nik}</span>
    </span>
  );
}

export function maskNik(nik: string) {
  if (!nik) return "";
  if (nik.length <= 6) return "*".repeat(nik.length);
  return `${nik.slice(0, -6)}******`;
}
