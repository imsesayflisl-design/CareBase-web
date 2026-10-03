export default function HospitalLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-7 space-y-3">
        <div className="h-3 w-28 rounded-full bg-slate-200/80" />
        <div className="h-7 w-64 rounded-lg bg-slate-200/80" />
        <div className="h-4 w-full max-w-xl rounded bg-slate-200/60" />
      </div>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-20 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-3 w-24 rounded bg-slate-200/80" />
            <div className="mt-3 h-5 w-12 rounded bg-slate-200/80" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="h-4 w-40 rounded bg-slate-200/80" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="h-9 w-full rounded-lg bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}