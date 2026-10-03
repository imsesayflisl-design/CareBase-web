"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MonthlyAppointmentPoint = {
  month: string;
  requests: number;
  completed: number;
};

export function AppointmentsChart({ data }: { data: MonthlyAppointmentPoint[] }) {
  return (
    <div className="h-[245px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={5} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#eef2f6" vertical={false} />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} dy={8} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} allowDecimals={false} />
          <Tooltip cursor={{ fill: "#f8fafc" }} contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 12, fontSize: 12, boxShadow: "0 8px 24px #0f172a12" }} />
          <Bar dataKey="requests" name="Appointments" fill="#a5e9f1" radius={[5, 5, 0, 0]} maxBarSize={25} />
          <Bar dataKey="completed" name="Completed" fill="#087f8c" radius={[5, 5, 0, 0]} maxBarSize={25} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
