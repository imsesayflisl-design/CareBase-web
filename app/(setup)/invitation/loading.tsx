export default function InvitationLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] px-5 py-12">
      <div className="w-full max-w-md animate-pulse rounded-3xl border border-slate-200 bg-white p-8">
        <div className="mx-auto size-14 rounded-xl bg-slate-100" />
        <div className="mx-auto mt-5 size-12 rounded-full bg-slate-100" />
        <div className="mx-auto mt-4 h-5 w-2/3 rounded bg-slate-100" />
        <div className="mx-auto mt-3 h-4 w-5/6 rounded bg-slate-100" />
        <div className="mt-6 space-y-2 rounded-2xl bg-slate-50 p-4">
          <div className="h-4 w-full rounded bg-slate-100" />
          <div className="h-4 w-5/6 rounded bg-slate-100" />
          <div className="h-4 w-4/6 rounded bg-slate-100" />
        </div>
        <div className="mt-6 h-11 w-full rounded-xl bg-slate-100" />
      </div>
    </main>
  );
}
