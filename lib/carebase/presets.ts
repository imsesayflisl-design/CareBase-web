/**
 * Pure constant lists shared by client components (pickers) and server code.
 *
 * Deliberately free of `server-only` so browser components can import it.
 */

/**
 * Standard hospital departments offered when creating a department.
 * A custom name can always be typed instead (§1 Department Management).
 */
export const DEPARTMENT_PRESETS: string[] = [
  "Emergency / Casualty",
  "Outpatient Department (OPD)",
  "Inpatient / Wards",
  "Pediatrics",
  "Obstetrics & Gynecology",
  "General Medicine",
  "General Surgery",
  "Orthopedics",
  "Cardiology",
  "Neurology",
  "Psychiatry / Mental Health",
  "Dental",
  "Ophthalmology",
  "ENT",
  "Dermatology",
  "Urology",
  "Nephrology",
  "Oncology",
  "Radiology / Imaging",
  "Laboratory",
  "Pharmacy",
  "Physiotherapy",
  "Nutrition & Dietetics",
  "ICU / Critical Care",
  "Operating Theatre",
  "Maternity",
  "Blood Bank",
  "Mortuary",
  "Administration",
  "Medical Records",
  "Nursing",
  "Ambulance / Emergency Transport",
];

/** Diagnostic departments / modalities offered when creating a service. */
export const DIAGNOSTIC_DEPARTMENT_PRESETS: string[] = [
  "Laboratory",
  "Radiology / Imaging",
  "Ultrasound",
  "X-Ray",
  "CT Scan",
  "MRI",
  "ECG / Cardiology",
];

/**
 * Standard test & scan services offered when creating a diagnostic service.
 * `kind` mirrors the `DiagnosticKind` enum.
 */
export const DIAGNOSTIC_SERVICE_PRESETS: { name: string; kind: "TEST" | "SCAN" }[] = [
  { name: "Complete Blood Count (CBC)", kind: "TEST" },
  { name: "Blood Glucose", kind: "TEST" },
  { name: "Urinalysis", kind: "TEST" },
  { name: "Malaria RDT", kind: "TEST" },
  { name: "Culture & Sensitivity", kind: "TEST" },
  { name: "Lipid Profile", kind: "TEST" },
  { name: "Liver Function Test", kind: "TEST" },
  { name: "Kidney Function Test", kind: "TEST" },
  { name: "X-Ray", kind: "SCAN" },
  { name: "Ultrasound", kind: "SCAN" },
  { name: "CT Scan", kind: "SCAN" },
  { name: "MRI", kind: "SCAN" },
  { name: "ECG", kind: "SCAN" },
];