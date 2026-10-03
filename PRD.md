# CareBase Hospital Web App

## Product Requirements Document (PRD) & Implementation Plan

**Product:** CareBase
**Application:** CareBase Hospital Web App
**Platform:** Web
**Primary Devices:** Laptop/Desktop
**Framework:** Next.js + React
**Backend:** CareBase Shared Backend
**Database:** PostgreSQL
**ORM:** Prisma
**Authentication:** Firebase Authentication + Firebase Admin SDK
**Primary Users:** Hospital owners, administrators, doctors, nurses, technicians and authorized hospital staff

---

# 1. Product Vision

The CareBase Hospital Web App is the hospital's central digital management system.

It connects the hospital directly to patients using the CareBase Patient App.

When a patient performs an action in the mobile application, the hospital should be able to receive and process that action from the hospital web application.

Examples:

**Patient books appointment**

→ CareBase Backend

→ Hospital Web App

→ Doctor Dashboard

→ Assigned Nurse Dashboard

→ Patient receives confirmation

---

# 2. Hospital System Objectives

CareBase Hospital Web should allow a hospital to manage:

* Hospital information
* Departments
* Staff
* Doctors
* Nurses
* Patients
* Appointments
* Doctor schedules
* Beds
* Bed requests
* Medical records
* Tests
* Scan services
* Scan bookings
* Medical reports
* Prescriptions
* Payments
* Attendance
* Hospital notices
* Notifications
* Reports
* Permissions
* Audit logs

---

# 3. Hospital User Roles

CareBase should use a flexible permissions system rather than assuming every hospital has the same structure.

Core roles:

### Hospital Owner

Full hospital management.

### Hospital Administrator / Lead

Manages daily hospital operations.

### Doctor

Manages clinical work and assigned patients.

### Nurse

Assists doctors and manages authorized nursing workflows.

### Technician

Manages diagnostic services such as laboratory/radiology workflows.

### Receptionist / Front Desk

Handles registration and administrative workflows.

### Accountant / Finance Staff

Handles authorized payment and financial information.

### Other Staff

Additional custom roles can be created later.

---

# 4. Permission Architecture

Do not use only:

```text
role = doctor
```

Use:

```text
User
 ↓
Hospital Membership
 ↓
Department Membership
 ↓
Role
 ↓
Permissions
```

Example:

```text
Hospital
└── Cardiology Department
    ├── Dr. Mohammed
    └── Nurse Mariama
```

The nurse can be explicitly assigned to Dr. Mohammed.

---

# 5. Hospital Dashboard

The dashboard is the main operational screen.

It should provide a quick overview of:

### Today's patients

* New registrations
* Returning patients
* Total patient visits

### Today's appointments

* Pending
* Confirmed
* Completed
* Cancelled

### Doctors

* Available
* Busy
* On leave
* Offline

### Beds

* Available
* Occupied
* Reserved
* Maintenance

### Scans

* Today's scan bookings
* Pending scans
* Completed scans
* Reports awaiting upload

### Payments

* Today's payments
* Pending payments
* Failed payments

### Staff

* Present
* Absent
* On leave

### Notifications

Recent operational alerts.

---

# 6. Dashboard Layout

Example:

```text
CareBase
────────────────────────────────────────

Dashboard

Good morning, Hospital Administrator

[ Patients Today ] [ Appointments ] [ Beds ]
      42                 28             15

[ Doctors Available ] [ Pending Requests ]
        12                    7

Today's Appointments
────────────────────────────────────────
09:00  Dr. Mohammed     John Sesay     Confirmed
10:00  Dr. Mariama      Fatmata K.     Pending
11:00  Dr. Ibrahim      Sorie B.       Completed

Recent Requests
────────────────────────────────────────
New Appointment
Bed Request
Scan Booking

Recent Notifications
────────────────────────────────────────
...
```

---

# 7. Hospital Registration

A hospital can register on CareBase.

Required information:

* Hospital name
* Hospital type
* Address
* County/region
* City/town
* GPS location
* Phone
* Email
* Emergency contact
* Operating hours
* Services
* Initial administrator information

After registration:

```text
Hospital
↓
Hospital Account
↓
Administrator
↓
Dashboard
```

The hospital becomes its own tenant.

---

# 8. Hospital Profile

Hospital administrators can manage:

* Hospital name
* Logo
* Photos
* Address
* Location
* Phone
* Email
* Website
* Emergency contact
* Opening hours
* Services
* Departments
* Description

Patients can see appropriate public information through the CareBase Patient App.

Private hospital information must remain private.

---

# 9. Department Management

Hospital administrators can create departments.

Examples:

* Cardiology
* Pediatrics
* Emergency
* Radiology
* Laboratory
* General Medicine
* Surgery
* Maternity
* Pharmacy

Department fields:

* Department name
* Description
* Location
* Contact
* Operating hours
* Services
* Department lead
* Status

---

# 10. Staff Management

Staff management allows administrators to:

* Add staff
* Invite staff
* Assign roles
* Assign departments
* Assign permissions
* Assign doctors
* Deactivate staff
* Reactivate staff
* View staff status

Staff types:

* Doctor
* Nurse
* Technician
* Receptionist
* Accountant
* Other

---

# 11. Staff Invitation System

Hospital administrator enters:

* Staff name
* Email
* Role
* Department
* Assigned doctor where applicable

CareBase sends a secure invitation.

Flow:

```text
Hospital Admin
      ↓
Add Staff
      ↓
Send Invitation
      ↓
Staff Email
      ↓
Secure Invitation
      ↓
Firebase Account Activation
      ↓
Profile Completion
      ↓
Dashboard
```

The invitation must be:

* Unique
* Time-limited
* One-time use
* Hospital-specific
* Role-specific
* Department-specific

The invited user must not be able to change the hospital or assigned role through the invitation.

---

# 12. Doctor Management

Administrators can add doctors.

Doctor information:

* Full name
* Photo
* Qualifications
* Specialty
* Sub-specialty
* Department
* Years of experience
* Biography
* Languages
* Services
* Consultation type
* Consultation fee
* Availability

The doctor can complete or update permitted professional profile information after activating their account.

---

# 13. Doctor Dashboard

When a doctor logs in, they should see a focused clinical dashboard.

Example:

```text
Doctor Dashboard

Good morning, Dr. Mohammed

Today's Overview

[ Appointments ] [ Patients ] [ Pending Tests ]
       12              18              4

Today's Schedule
────────────────────────
09:00 John Sesay
10:00 Fatmata Kamara
11:00 Sorie Bangura

Patient Requests
────────────────────────
New appointment
Scan result available
Test result available

Quick Actions
[ Patients ]
[ Appointments ]
[ Medical Records ]
[ Prescriptions ]
```

---

# 14. Doctor Calendar

Doctors can see:

* Daily schedule
* Weekly schedule
* Monthly schedule
* Appointment duration
* Available slots
* Booked slots
* Breaks
* Leave
* Holidays

Doctor can configure:

* Working days
* Start time
* End time
* Breaks
* Appointment duration
* Availability

---

# 15. Patient Management

Hospital staff with permission can search patients by:

* Patient ID
* Name
* Phone
* Date of birth

Patient ID example:

`PAT-SL-2026-000125`

Patient profile:

* Name
* Date of birth
* Gender
* Phone
* Address
* Emergency contact
* Medical history
* Allergies
* Visits
* Diagnoses
* Prescriptions
* Tests
* Scans
* Reports

---

# 16. Patient Registration

Authorized staff can register patients directly.

Information:

* Full name
* Date of birth
* Gender
* Phone
* Address
* Emergency contact
* Medical information where appropriate

If the patient already exists, staff should search before creating a new record to reduce duplicates.

---

# 17. Patient Visit / Encounter

A patient can have many visits.

Example:

```text
Patient
 ↓
Visit 1
 ↓
Visit 2
 ↓
Visit 3
 ↓
Visit 4
```

Each visit can contain:

* Date/time
* Doctor
* Department
* Reason
* Clinical notes
* Diagnosis
* Prescription
* Tests
* Scans
* Follow-up

---

# 18. Appointment Management

Hospital staff see appointments created through:

**CareBase Patient App**

Appointment information:

* Appointment ID
* Patient
* Doctor
* Nurse
* Department
* Date
* Time
* Reason
* Status
* Payment status

Statuses:

* Requested
* Pending
* Confirmed
* Rejected
* Rescheduled
* Cancelled
* Completed
* No-show

---

# 19. Realtime Appointment Workflow

Example:

Patient books:

**Dr. Mohammed — 2:00 PM**

The hospital receives:

```text
New Appointment
────────────────
Patient: John Sesay
Doctor: Dr. Mohammed
Department: Cardiology
Date: September 20
Time: 2:00 PM

[ Confirm ]
[ Reject ]
[ Reschedule ]
```

If confirmed:

* Doctor dashboard updates.
* Assigned nurse updates.
* Patient receives notification.
* Appointment calendar updates.

No manual page refresh should be necessary.

---

# 20. Nurse Dashboard

Nurses see information according to their permissions.

Example:

```text
Nurse Dashboard

Assigned Doctor
Dr. Mohammed

Today's Appointments
12

Pending Patient Requests
4

Upcoming
09:00 John Sesay
10:00 Fatmata Kamara

Notifications
New appointment
Patient needs assistance
Doctor requested follow-up
```

---

# 21. Doctor-Nurse Assignment

Hospital administrator can assign:

```text
Dr. Mohammed
        ↓
Nurse Mariama
```

The relationship is stored in the database.

The assigned nurse can receive:

* Appointment notifications
* Patient intake tasks
* Doctor requests
* Follow-up tasks

Access to medical information must still follow permissions.

---

# 22. Medical Records

Authorized users can manage:

* Medical history
* Allergies
* Clinical notes
* Diagnoses
* Visits
* Prescriptions
* Tests
* Test results
* Scans
* Medical reports

The system should preserve record history rather than silently overwriting important clinical information.

---

# 23. Clinical Notes

Doctor can create:

* Consultation notes
* Assessment
* Diagnosis
* Treatment plan
* Follow-up instructions

Each entry should record:

* Author
* Date/time
* Patient
* Visit
* Hospital

---

# 24. Prescription Management

Doctor can create a prescription.

Fields:

* Patient
* Doctor
* Hospital
* Medication
* Dosage
* Frequency
* Duration
* Instructions
* Date

The patient receives the prescription through the CareBase mobile application.

---

# 25. Test Management

Hospital can configure tests.

Example:

* Blood test
* Urine test
* Malaria test
* Other laboratory tests

Workflow:

```text
Doctor
 ↓
Request Test
 ↓
Laboratory/Technician
 ↓
Perform Test
 ↓
Enter Result
 ↓
Doctor Review
 ↓
Patient Notification
```

---

# 26. Scan Management

Hospital can manage:

* X-Ray
* Ultrasound
* CT
* MRI
* ECG
* Mammogram
* Echocardiogram
* Other diagnostic services

Each scan service includes:

* Name
* Description
* Department
* Price
* Duration
* Schedule
* Preparation instructions
* Hospital availability
* Home-service availability

---

# 27. Scan Booking Dashboard

Hospital receives patient scan bookings.

Example:

```text
Scan Bookings

Patient: John Sesay
Scan: Ultrasound
Date: September 20
Time: 10:00 AM
Payment: Paid

[ Open ]
```

Technician can process the booking.

---

# 28. Medical Report Upload

Technician or authorized clinician can upload a report.

Workflow:

```text
Scan Completed
      ↓
Report Created
      ↓
Authorized User Uploads
      ↓
Secure Storage
      ↓
Doctor Review where required
      ↓
Patient Notification
      ↓
Patient Views Report
```

---

# 29. Bed Management

Hospital administrators manage:

* Wards
* Rooms
* Beds

Bed statuses:

* Available
* Occupied
* Reserved
* Maintenance
* Unavailable

Dashboard:

```text
Beds

Available       15
Occupied        42
Reserved         4
Maintenance      2
```

---

# 30. Bed Request Management

Patient requests a bed from the CareBase mobile app.

Hospital receives:

```text
New Bed Request

Patient
John Sesay

Requested Ward
General Ward

Requested Date
September 20

[ Approve ]
[ Reject ]
```

If approved:

* Bed is reserved.
* Patient receives notification.
* Hospital bed status updates.

---

# 31. Hospital Notices

Hospital staff with permission can create notices.

Examples:

* Clinic closed
* Doctor unavailable
* Service unavailable
* New service
* Emergency information
* Operating-hour change

Patients receive relevant notices through the mobile app.

---

# 32. Pharmacy Relationship

The hospital can maintain pharmacy-related information where relevant, but pharmacy management should remain a separate provider workflow.

The hospital can:

* Create prescriptions
* Recommend/indicate medication
* Send prescriptions to supported pharmacy workflows

The pharmacy manages:

* Inventory
* Orders
* Medicine availability
* Delivery

---

# 33. Payment Dashboard

Authorized finance staff can view:

* Payments
* Transactions
* Revenue
* Pending payments
* Failed payments
* Refunds
* Receipts

Example:

```text
Today's Payments

Paid           $...
Pending        $...
Failed         $...
Refunded       $...
```

Exact currency/payment provider should be configurable.

---

# 34. Receipt Management

Generate digital receipts.

Example:

`REC-SL-2026-000182`

Receipt includes:

* Receipt ID
* Patient
* Hospital
* Service
* Amount
* Payment method
* Transaction ID
* Date
* Status

---

# 35. Staff Attendance

Hospital staff attendance system.

Fields:

* Staff
* Date
* Shift
* Location
* Status
* Check-in
* Check-out

Statuses:

* Present
* Absent
* Leave

Shifts:

* Morning
* Evening

Historical records must remain available.

---

# 36. Excel Staff Import

Hospital administrator can upload staff through Excel.

Template:

| Name | Role | Department | Location | Shift | Date | Status |
| ---- | ---- | ---------- | -------- | ----- | ---- | ------ |

Workflow:

```text
Download Template
       ↓
Complete Excel
       ↓
Upload
       ↓
Validate
       ↓
Preview
       ↓
Show Errors
       ↓
Confirm
       ↓
Import
```

Use SheetJS (`xlsx`).

The backend must assign the authenticated hospital.

The Excel file must not be trusted to choose a hospital.

---

# 37. Notifications

Hospital web notifications:

* New appointment
* Appointment confirmation
* Bed request
* Scan booking
* Test result
* Patient registration
* Payment
* Staff invitation
* Hospital notice
* Emergency request

Notifications can be:

* In-app
* Push where applicable
* Email
* SMS where required

---

# 38. Emergency Dashboard

Hospital emergency staff can receive emergency requests.

Potential information:

* Patient
* Current location where permission was granted
* Emergency type
* Time
* Contact
* Status

Possible workflow:

```text
Emergency Request
       ↓
Hospital Receives
       ↓
Accept
       ↓
Prepare Emergency Service
       ↓
Patient Notified
```

Future:

**Ambulance → Live tracking → Hospital**

---

# 39. Reports & Analytics

Hospital administrators can view:

### Patient Reports

* New registrations
* Visits
* Patient volume

### Appointment Reports

* Bookings
* Completed
* Cancelled
* No-shows

### Diagnostic Reports

* Tests
* Scans
* Completed scans
* Pending reports

### Bed Reports

* Occupancy
* Availability
* Reservations

### Financial Reports

* Payments
* Revenue
* Refunds

### Staff Reports

* Attendance
* Present
* Absent
* Leave

---

# 40. Search

Global hospital search can search:

* Patients
* Doctors
* Nurses
* Appointments
* Medical records
* Tests
* Scans
* Beds
* Payments

Search must respect permissions.

A receptionist must not automatically be able to search confidential clinical records simply because they can search patients.

---

# 41. Security & Privacy

Because CareBase handles sensitive healthcare data, security must be built into every feature.

Requirements:

* Firebase Authentication
* Firebase Admin SDK
* Server-side authorization
* RBAC
* Permission checks
* Hospital tenant isolation
* Department authorization
* HTTPS
* Input validation
* Rate limiting
* Secure file access
* Audit logs
* Database backups
* Error monitoring

Never trust frontend values for:

* Hospital ID
* User ID
* Role
* Permissions
* Patient ownership

---

# 42. Multi-Tenant Security

CareBase uses one PostgreSQL database.

Every hospital-owned record contains a hospital relationship.

Example:

```text
Hospital A
 ├── Patients
 ├── Doctors
 ├── Nurses
 ├── Appointments
 ├── Beds
 └── Records

Hospital B
 ├── Patients
 ├── Doctors
 ├── Nurses
 ├── Appointments
 ├── Beds
 └── Records
```

Hospital A must never access Hospital B data.

The backend must enforce this on every request.

---

# 43. Audit Logs

Important actions must be recorded.

Example:

```text
User:
Dr. Mohammed

Hospital:
Hospital A

Action:
Viewed Medical Record

Resource:
PatientVisit

Timestamp:
2026-09-20 10:32
```

Audit events:

* Login
* Patient record access
* Record modification
* Prescription creation
* Report upload
* Payment
* Staff creation
* Staff deactivation
* Permission changes
* Hospital settings changes

---

# 44. Recommended Web Technology Stack

## Frontend

**Next.js + React**

## Language

**TypeScript**

## Styling

**Tailwind CSS**

## UI

A reusable component system for:

* Tables
* Forms
* Modals
* Cards
* Charts
* Dashboards
* Notifications

## Backend

**Next.js server-side APIs/server functions**

## Database

**PostgreSQL**

## ORM

**Prisma**

## Authentication

**Firebase Authentication**

## Server Authentication

**Firebase Admin SDK**

## File Storage

**Firebase Storage**

## Realtime

Realtime/WebSocket infrastructure such as **Supabase Realtime** or another compatible service.

## Excel

**SheetJS (`xlsx`)**

## Deployment

**Vercel + PostgreSQL + Firebase**

## Version Control

**Git + GitHub**

---

# 45. Hospital Web Application Navigation

Recommended sidebar:

```text
CareBase
────────────────────

Dashboard

Patients
Appointments
Doctors
Nurses
Departments

Beds
Bed Requests

Medical Records
Tests
Scans

Staff
Attendance

Payments
Reports

Notifications
Hospital Notices

Settings
```

The navigation should automatically adapt based on permissions.

For example, a doctor should not see administration-only menus.

---

# 46. Hospital Web Screens

## Authentication

1. Login
2. Forgot Password
3. Reset Password
4. Email Verification
5. Invitation Activation

## Hospital

6. Dashboard
7. Hospital Profile
8. Hospital Settings
9. Departments
10. Department Details

## Staff

11. Staff
12. Add Staff
13. Staff Details
14. Invitations
15. Roles
16. Permissions
17. Attendance
18. Excel Import

## Doctors

19. Doctors
20. Doctor Profile
21. Doctor Schedule
22. Doctor Availability

## Nurses

23. Nurses
24. Nurse Profile
25. Doctor Assignment

## Patients

26. Patients
27. Register Patient
28. Patient Profile
29. Patient Visits
30. Medical History
31. Clinical Notes
32. Prescriptions
33. Test Results
34. Scan Reports

## Appointments

35. Appointment Dashboard
36. Appointment Details
37. Calendar
38. Appointment Requests

## Beds

39. Wards
40. Rooms
41. Beds
42. Bed Requests

## Diagnostics

43. Tests
44. Test Requests
45. Test Results
46. Scan Services
47. Scan Bookings
48. Scan Reports

## Payments

49. Payments
50. Transactions
51. Receipts

## Communication

52. Notifications
53. Hospital Notices

## Reports

54. Patient Reports
55. Appointment Reports
56. Diagnostic Reports
57. Bed Reports
58. Financial Reports
59. Staff Reports

## Settings

60. Profile
61. Security
62. Permissions
63. Integrations
64. Audit Logs

---

# 47. Technical Project Structure

Recommended structure:

```text
carebase-hospital/
│
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── forgot-password/
│   │   └── invitation/
│   │
│   ├── dashboard/
│   │
│   ├── patients/
│   ├── appointments/
│   ├── doctors/
│   ├── nurses/
│   ├── departments/
│   ├── beds/
│   ├── medical-records/
│   ├── tests/
│   ├── scans/
│   ├── staff/
│   ├── attendance/
│   ├── payments/
│   ├── reports/
│   ├── notifications/
│   ├── notices/
│   └── settings/
│
├── components/
│   ├── ui/
│   ├── dashboard/
│   ├── patients/
│   ├── appointments/
│   ├── doctors/
│   ├── nurses/
│   ├── beds/
│   ├── scans/
│   └── reports/
│
├── lib/
│   ├── firebase/
│   ├── prisma/
│   ├── auth/
│   ├── permissions/
│   ├── realtime/
│   └── validation/
│
├── services/
│   ├── patients/
│   ├── appointments/
│   ├── doctors/
│   ├── scans/
│   ├── beds/
│   ├── payments/
│   └── notifications/
│
├── hooks/
├── types/
├── utils/
└── prisma/
    └── schema.prisma
