"use client";

import { useState } from "react";
import { DEPARTMENT_PRESETS } from "@/lib/carebase/presets";

const CUSTOM = "__custom__";

const inputClass =
  "h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-cyan-500";

/**
 * Choose one of the standard hospital departments, or type a custom one.
 * Always submits a single `name` field so it drops straight into the existing
 * `createDepartment` server action.
 */
export function DepartmentPresetPicker() {
  const [selected, setSelected] = useState("");
  const isCustom = selected === CUSTOM;

  return (
    <>
      <label className="block text-xs font-semibold text-slate-700">
        Department
        <select
          required
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          className={inputClass + " mt-1"}
        >
          <option value="" disabled>
            Select a department…
          </option>
          {DEPARTMENT_PRESETS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          <option value={CUSTOM}>+ Custom department…</option>
        </select>
      </label>

      {isCustom ? (
        <label className="block text-xs font-semibold text-slate-700">
          Custom department name
          <input
            name="name"
            required
            minLength={2}
            autoFocus
            placeholder="Type the department name"
            className={inputClass + " mt-1"}
          />
        </label>
      ) : (
        <input type="hidden" name="name" value={selected} />
      )}
    </>
  );
}