export default function Loading() {
  return (
    <div className="space-y-5">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl border border-border bg-white shadow-soft">
            <div className="m-5 h-10 w-10 rounded-xl bg-slate-200" />
            <div className="mx-5 mt-6 h-4 w-28 rounded bg-slate-200" />
            <div className="mx-5 mt-3 h-7 w-36 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-border bg-white shadow-soft" />
    </div>
  );
}
