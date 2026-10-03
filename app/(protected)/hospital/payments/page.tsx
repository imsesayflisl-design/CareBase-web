import { createHospitalPayment, updatePaymentStatus } from "@/app/actions/carebase-operations";
import { canAccess, requireCarebasePermission } from "@/lib/carebase/context";
import db from "@/lib/db";
import { PageHeader } from "@/components/carebase/page-header";
import { EmptyState, Field, FormSubmit, Panel, SelectField, TextAreaField } from "@/components/carebase/panel";
import { StatusBadge } from "@/components/carebase/status-badge";
import { format } from "date-fns";
import { CreditCard, ReceiptText, Wallet } from "lucide-react";
import Link from "next/link";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const context = await requireCarebasePermission("payments.read");
  const canManage = await canAccess("payments.manage");
  const { q = "" } = await searchParams;
  const search = q.trim();
  const where = {
    hospitalId: context.hospital.id,
    ...(search ? { OR: [
      { receiptNumber: { contains: search, mode: "insensitive" as const } },
      { patient: { firstName: { contains: search, mode: "insensitive" as const } } },
      { patient: { lastName: { contains: search, mode: "insensitive" as const } } },
    ] } : {}),
  };
  const [payments, patients, totalCount, pending, paid, paidSum] = await Promise.all([
    db.hospitalPayment.findMany({
      where,
      include: { patient: true, transactions: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    canManage ? db.carePatient.findMany({ where: { hospitalId: context.hospital.id }, select: { id: true, firstName: true, lastName: true, patientCode: true }, orderBy: { lastName: "asc" }, take: 200 }) : Promise.resolve([]),
    db.hospitalPayment.count({ where: { hospitalId: context.hospital.id } }),
    db.hospitalPayment.count({ where: { hospitalId: context.hospital.id, status: "PENDING" } }),
    db.hospitalPayment.count({ where: { hospitalId: context.hospital.id, status: "PAID" } }),
    db.hospitalPayment.aggregate({ where: { hospitalId: context.hospital.id, status: { in: ["PAID", "PARTIAL"] } }, _sum: { amount: true } }),
  ]);

  return (
    <div>
      <PageHeader title="Payments & receipts" description="Track hospital charges, payment status and receipt history." action={<div className="flex items-center gap-2 text-xs text-slate-500"><ReceiptText className="size-4 text-cyan-700" /> Currency: {context.hospital.currency}</div>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Payment records" value={totalCount} icon={ReceiptText} /><Metric label="Pending" value={pending} icon={Wallet} /><Metric label="Paid" value={paid} icon={CreditCard} /><Metric label="Collected" value={context.hospital.currency + " " + (paidSum._sum.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} icon={Wallet} /></div>

      {canManage && <details className="mb-5 rounded-2xl border border-cyan-100 bg-cyan-50/50">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-cyan-900">+ Record a payment</summary>
        <form action={createHospitalPayment} className="grid gap-4 border-t border-cyan-100 bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
          <SelectField label="Patient" name="patientId" required options={patients.map((patient) => ({ value: patient.id, label: patient.firstName + " " + patient.lastName + " · " + patient.patientCode }))} />
          <Field label="Service / charge" name="serviceName" required placeholder="Consultation, scan, bed..." />
          <Field label={"Amount (" + context.hospital.currency + ")"} name="amount" type="number" min="0.01" step="0.01" required />
          <SelectField label="Payment method" name="method" defaultValue="CASH" options={[{ label: "Cash", value: "CASH" }, { label: "Card", value: "CARD" }, { label: "Mobile money", value: "MOBILE_MONEY" }, { label: "Bank transfer", value: "BANK_TRANSFER" }]} />
          <SelectField label="Status" name="status" defaultValue="PAID" required options={[{ label: "Paid", value: "PAID" }, { label: "Pending", value: "PENDING" }, { label: "Partial", value: "PARTIAL" }]} />
          <TextAreaField label="Note" name="notes" rows={2} />
          <div className="md:col-span-2 xl:col-span-4"><FormSubmit>Save payment and receipt</FormSubmit></div>
        </form>
      </details>}

      <Panel title="Payment records" description="Receipt IDs are unique within your hospital." action={<form action="/hospital/payments" className="flex gap-2"><input name="q" defaultValue={search} placeholder="Search receipt or patient" className="h-9 w-52 rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-cyan-500" /><button className="rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white">Search</button></form>}>
        {payments.length ? <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left">
            <thead><tr className="text-[10px] font-semibold uppercase tracking-wider text-slate-400"><th className="pb-3">Receipt</th><th className="pb-3">Patient</th><th className="pb-3">Service</th><th className="pb-3">Amount</th><th className="pb-3">Method</th><th className="pb-3">Date</th><th className="pb-3">Status</th><th className="pb-3">Update</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{payments.map((payment) => <tr key={payment.id} className="text-xs"><td className="py-3.5 font-mono text-[10px] text-cyan-800">{payment.receiptNumber}</td><td className="py-3.5"><Link href={"/hospital/patients/" + payment.patientId} className="font-semibold text-slate-800 hover:text-cyan-700">{payment.patient.firstName} {payment.patient.lastName}</Link><p className="mt-1 text-[10px] text-slate-400">{payment.patient.patientCode}</p></td><td className="py-3.5 text-slate-600">{payment.serviceName}</td><td className="py-3.5 font-semibold text-slate-800">{payment.currency} {payment.amount.toFixed(2)}</td><td className="py-3.5 text-slate-500">{payment.method?.replaceAll("_", " ") ?? "—"}</td><td className="py-3.5 text-slate-500">{format(payment.createdAt, "MMM d, yyyy")}</td><td className="py-3.5"><StatusBadge status={payment.status} /></td><td className="py-3.5">{canManage && <form action={updatePaymentStatus} className="flex items-center gap-1"><input type="hidden" name="paymentId" value={payment.id} /><select name="status" defaultValue={payment.status} className="h-8 max-w-28 rounded-md border border-slate-200 bg-white px-1.5 text-[10px]"><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="PARTIAL">Partial</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option></select><button className="rounded-md bg-cyan-700 px-2 py-1.5 text-[10px] font-semibold text-white">Save</button></form>}</td></tr>)}</tbody>
          </table>
          {payments.map((payment) => payment.transactions.length > 1 ? <details key={payment.id + "-transactions"} className="mt-3 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-[11px] font-semibold text-slate-500">Receipt {payment.receiptNumber} · {payment.transactions.length} transactions</summary><div className="mt-2 space-y-1 pl-2">{payment.transactions.map((transaction) => <p key={transaction.id} className="text-[10px] text-slate-500">{format(transaction.createdAt, "MMM d, h:mm a")} · {transaction.method} · {payment.currency} {transaction.amount.toFixed(2)} · {transaction.status}</p>)}</div></details> : null)}
        </div> : <EmptyState title="No payment records" description="Payments and receipts recorded by your finance team will show here." />}
      </Panel>
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof ReceiptText }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="rounded-lg bg-cyan-50 p-2.5 text-cyan-700"><Icon className="size-4" /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div></div>;
}
