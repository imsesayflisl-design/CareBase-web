"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; label: string };

export function PatientAppointmentForm({
  hospitalId,
  doctors,
  departments,
}: {
  hospitalId: string;
  doctors: Option[];
  departments: Option[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setMessage("");
    setError(false);
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/patient/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hospitalId,
          doctorId: form.get("doctorId"),
          departmentId: form.get("departmentId"),
          date: form.get("date"),
          time: form.get("time"),
          appointmentType: form.get("appointmentType"),
          reason: form.get("reason"),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(true);
        setMessage(result.error || "The appointment request could not be submitted.");
        return;
      }
      formElement.reset();
      setMessage("Request sent. The hospital will review your appointment.");
      router.refresh();
    } catch {
      setError(true);
      setMessage("The appointment request could not be submitted. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 rounded-xl border border-cyan-100 bg-cyan-50/40 p-4">
      <p className="text-xs font-semibold text-slate-800">Request an appointment</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] font-medium text-slate-600">Department
          <select name="departmentId" className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs">
            <option value="">Any department</option>
            {departments.map((department) => <option value={department.id} key={department.id}>{department.label}</option>)}
          </select>
        </label>
        <label className="block text-[11px] font-medium text-slate-600">Doctor
          <select name="doctorId" className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs">
            <option value="">First available</option>
            {doctors.map((doctor) => <option value={doctor.id} key={doctor.id}>{doctor.label}</option>)}
          </select>
        </label>
        <label className="block text-[11px] font-medium text-slate-600">Date
          <input name="date" type="date" required min={new Date().toISOString().slice(0, 10)} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs" />
        </label>
        <label className="block text-[11px] font-medium text-slate-600">Time
          <input name="time" type="time" required className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs" />
        </label>
        <label className="block text-[11px] font-medium text-slate-600 sm:col-span-2">Reason for visit
          <input name="reason" maxLength={1000} placeholder="What would you like help with?" className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-60">{pending ? "Sending…" : "Send request"}</button>
        {message && <p role="status" className={"text-xs " + (error ? "text-rose-700" : "text-emerald-700")}>{message}</p>}
      </div>
    </form>
  );
}
