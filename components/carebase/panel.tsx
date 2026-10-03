import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={"rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.025)] " + className}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 md:px-6">
          <div>{title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}{description && <p className="mt-1 text-xs text-slate-500">{description}</p>}</div>
          {action}
        </div>
      )}
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-white text-cyan-700 shadow-sm ring-1 ring-slate-200">+</span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

export function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  defaultValue,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  min?: string | number;
  step?: string | number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} defaultValue={defaultValue} min={min} step={step} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
    </label>
  );
}

export function SelectField({
  label,
  name,
  options,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { label: string; value: string }[];
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>
      <select name={name} required={required} defaultValue={defaultValue ?? ""} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10">
        <option value="" disabled>Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function TextAreaField({
  label,
  name,
  placeholder,
  rows = 3,
  required,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  defaultValue?: string | null;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span>
      <textarea name={name} rows={rows} required={required} placeholder={placeholder} defaultValue={defaultValue ?? ""} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
    </label>
  );
}

export function FormSubmit({ children = "Save changes" }: { children?: string }) {
  return <button className="inline-flex h-10 items-center justify-center rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white transition hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-700/15">{children}</button>;
}
