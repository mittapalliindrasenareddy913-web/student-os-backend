# Campus OS — API Reference

> **Base URL**: `https://api.your-domain.com`  
> **Authentication**: `Authorization: Bearer <JWT_TOKEN>`  
> **Content-Type**: `application/json`  
> **Rate Limits**: Auth routes — 30 req/15min; API routes — 300 req/min

---

## Authentication (`/api/auth`)

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Student OS login (email + password) |
| POST | `/api/auth/google-login` | Google OAuth login |
| POST | `/api/auth/college-login` | Campus OS login (collegeCode + email + password) |
| POST | `/api/auth/forgot-password` | Request OTP for password reset |
| POST | `/api/auth/reset-password` | Verify OTP and set new password |
| POST | `/api/auth/refresh` | Refresh JWT using refresh token |
| POST | `/api/auth/logout` | Invalidate session |
| GET  | `/api/auth/colleges/search` | Search colleges by name/code |
| POST | `/api/auth/colleges/verify-roll` | Verify student roll number |
| POST | `/api/auth/leads` | Submit contact/demo request |
| POST | `/api/auth/college/forgot-password` | Campus forgot password |
| POST | `/api/auth/college/send-otp` | Send OTP for campus reset |
| POST | `/api/auth/college/verify-otp` | Verify OTP |
| POST | `/api/auth/college/reset-password` | Reset campus password |

### Protected Endpoints (All Roles)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/auth/profile` | Get current user profile |
| PUT  | `/api/auth/profile` | Update profile (multipart: avatar, coverPhoto, resume) |
| GET  | `/api/auth/dashboard` | Get personalised dashboard data |
| POST | `/api/auth/fcm-token` | Register FCM push token |
| POST | `/api/auth/connect-google` | Link Google account |
| GET  | `/api/auth/connected-accounts` | List linked OAuth accounts |
| POST | `/api/auth/colleges/link` | Link roll number to student account |
| PUT  | `/api/auth/change-password` | Change password |

---

## Campus Auth (`/api/auth/campus`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/campus/login` | Campus role login |
| POST | `/api/auth/campus/refresh` | Refresh campus session |
| POST | `/api/auth/campus/logout` | Campus logout |

---

## Super Admin (`/api/super-admin`) — `super_admin` only

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/super-admin/colleges` | List all colleges |
| POST | `/api/super-admin/colleges` | Create master college entry |
| POST | `/api/super-admin/colleges/:code/approve` | Approve college activation |
| POST | `/api/super-admin/colleges/:code/suspend` | Toggle college active status |
| GET  | `/api/super-admin/analytics` | Platform-wide analytics |

### Super Admin Requests (`/api/super-admin/requests`) — `super_admin` only

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/super-admin/requests/stats` | SaaS KPI stats |
| GET  | `/api/super-admin/requests/colleges` | All colleges |
| POST | `/api/super-admin/requests/colleges` | Add college |
| PUT  | `/api/super-admin/requests/colleges/:id` | Update college |
| DELETE | `/api/super-admin/requests/colleges/:id` | Delete college |
| POST | `/api/super-admin/requests/colleges/:code/suspend` | Toggle suspend |
| POST | `/api/super-admin/requests/plans` | Create subscription plan |
| GET  | `/api/super-admin/requests/plans` | List plans |
| POST | `/api/super-admin/requests/subscriptions` | Create college subscription |
| GET  | `/api/super-admin/requests/invoices` | Invoices |
| GET  | `/api/super-admin/requests/users` | All platform users |
| POST | `/api/super-admin/requests/users/:id/reset-password` | Reset user password |
| POST | `/api/super-admin/requests/users/:id/toggle-status` | Enable/disable user |
| POST | `/api/super-admin/requests/users/:id/role` | Assign role |
| POST | `/api/super-admin/requests/:requestId/approve` | Approve onboarding request |
| POST | `/api/super-admin/requests/:requestId/reject` | Reject request |
| GET  | `/api/super-admin/requests/config` | System config |
| POST | `/api/super-admin/requests/config` | Save system config |
| POST | `/api/super-admin/requests/broadcast` | Send global notification |
| GET  | `/api/super-admin/requests/storage` | Storage quota details |
| POST | `/api/super-admin/requests/storage/quota` | Update quota |
| GET  | `/api/super-admin/requests/integrations` | Integration settings |
| POST | `/api/super-admin/requests/integrations` | Update integrations |
| GET  | `/api/super-admin/requests/security` | Security metrics |
| GET  | `/api/super-admin/requests/audit-logs` | Audit log search |
| POST | `/api/super-admin/requests/backup` | Trigger backup |
| GET  | `/api/super-admin/requests/backup` | Backup history |
| GET  | `/api/super-admin/requests/support/tickets` | Support tickets |
| POST | `/api/super-admin/requests/support/tickets/:id/resolve` | Resolve ticket |
| POST | `/api/super-admin/requests/colleges/:code/features` | Update college features |
| POST | `/api/super-admin/requests/maintenance/toggle` | Toggle maintenance mode |
| PUT  | `/api/super-admin/requests/profile` | Update super admin profile |
| GET  | `/api/super-admin/requests/leads` | View demo/contact leads |
| PUT  | `/api/super-admin/requests/leads/:id/status` | Update lead status |

---

## Principal (`/api/principal`) — `principal` only (except config)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/principal/config` | ERP config (all roles) |
| PUT  | `/api/principal/config` | Update ERP config |
| GET  | `/api/principal/dashboard-stats` | Dashboard KPIs |
| POST | `/api/principal/users` | Create user account |
| GET  | `/api/principal/users` | List college users |
| PUT  | `/api/principal/users/:id` | Update user |
| DELETE | `/api/principal/users/:id` | Delete user |
| POST | `/api/principal/users/import` | Bulk import users (CSV/XLSX) |
| GET  | `/api/principal/users/export` | Export users |
| POST | `/api/principal/departments` | Create department |
| GET  | `/api/principal/departments` | List departments |
| PUT  | `/api/principal/departments/:id` | Update department |
| DELETE | `/api/principal/departments/:id` | Delete department |
| POST | `/api/principal/hods` | Create HOD account |
| GET  | `/api/principal/staff` | List staff accounts |
| PATCH | `/api/principal/staff/:id` | Toggle HOD status |
| PATCH | `/api/principal/staff/:id/reset-password` | Reset HOD password |
| POST | `/api/principal/notices` | Publish notice |
| GET  | `/api/principal/notices` | List notices |
| POST | `/api/principal/calendar` | Create calendar item |
| GET  | `/api/principal/calendar` | List calendar items |
| POST | `/api/principal/student-records` | Create student record |
| GET  | `/api/principal/student-records` | List student records |
| PUT  | `/api/principal/student-records/:id` | Update record |
| DELETE | `/api/principal/student-records/:id` | Delete record |
| POST | `/api/principal/student-records/import` | Bulk import records |
| POST | `/api/principal/student-records/bulk-action` | Bulk action records |
| GET  | `/api/principal/student-records/export` | Export records |
| GET  | `/api/principal/approvals` | Approvals queue |
| POST | `/api/principal/approvals/create` | Create approval request |
| GET  | `/api/principal/approvals/history` | Workflow history |
| POST | `/api/principal/approvals/:type/:id` | Action approval |
| GET  | `/api/principal/timetables/pending` | Pending timetables |
| POST | `/api/principal/timetables/:id/approve` | Approve timetable |
| GET  | `/api/principal/audit-logs` | Campus audit logs |

---

## HOD (`/api/hod`)

### Shared with Faculty

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| POST | `/api/hod/timetable/parse-file` | `hod`, `faculty` | Parse timetable file |
| POST | `/api/hod/timetable/bulk-save` | `hod`, `faculty` | Bulk save timetable |
| DELETE | `/api/hod/timetable/all` | `hod`, `faculty` | Clear all timetables |
| DELETE | `/api/hod/timetable/section/:year/:section` | `hod`, `faculty` | Clear section timetable |
| POST | `/api/hod/timetable` | `hod`, `faculty` | Save timetable slot |
| GET  | `/api/hod/timetable` | `hod`, `faculty` | Get timetables |

### HOD Only

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/hod/dashboard-stats` | Department KPIs |
| GET  | `/api/hod/leaves` | Faculty leave requests |
| POST | `/api/hod/leaves/:id/recommend` | Recommend leave |
| POST | `/api/hod/leaves/:id/reject` | Reject leave |
| GET  | `/api/hod/marks` | Internal marks |
| POST | `/api/hod/marks/:id/approve` | Approve marks |
| POST | `/api/hod/marks/:id/reject` | Reject marks |
| GET  | `/api/hod/materials` | Department materials |
| POST | `/api/hod/materials` | Upload material |
| GET  | `/api/hod/students` | Department students |
| POST | `/api/hod/students` | Create student |
| PUT  | `/api/hod/students/:id` | Update student |
| DELETE | `/api/hod/students/:id` | Delete student |
| POST | `/api/hod/students/bulk-action` | Bulk action students |
| POST | `/api/hod/students/import` | Import students |
| GET  | `/api/hod/faculty` | Department faculty |
| POST | `/api/hod/faculty` | Create faculty |
| PUT  | `/api/hod/faculty/:id` | Update faculty |
| DELETE | `/api/hod/faculty/:id` | Delete faculty |
| PUT  | `/api/hod/faculty/:id/assignments` | Update subject assignments |
| GET  | `/api/hod/subjects` | Department subjects |
| POST | `/api/hod/subjects/bulk` | Bulk import subjects |
| POST | `/api/hod/subjects` | Create subject |
| GET  | `/api/hod/notices` | Department notices |
| POST | `/api/hod/notices` | Publish notice |
| POST | `/api/hod/leaves/student/:id/action` | Action student leave |

---

## Faculty (`/api/faculty`) — `faculty` only

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/faculty/dashboard-stats` | Dashboard KPIs |
| GET  | `/api/faculty/timetable` | Assigned timetable |
| GET  | `/api/faculty/attendance/students` | Students for attendance |
| POST | `/api/faculty/attendance` | Save attendance |
| GET  | `/api/faculty/attendance` | Attendance logs |
| GET  | `/api/faculty/materials` | Course materials |
| POST | `/api/faculty/materials` | Upload material |
| PUT  | `/api/faculty/materials/:id` | Update material |
| DELETE | `/api/faculty/materials/:id` | Delete material |
| GET  | `/api/faculty/assignments` | Assignments |
| POST | `/api/faculty/assignments` | Create assignment |
| PUT  | `/api/faculty/assignments/:id` | Update assignment |
| DELETE | `/api/faculty/assignments/:id` | Delete assignment |
| POST | `/api/faculty/assignments/:id/grade` | Grade submission |
| GET  | `/api/faculty/marks` | Published marks |
| POST | `/api/faculty/marks` | Submit exam marks |
| GET  | `/api/faculty/lab` | Lab records |
| POST | `/api/faculty/lab` | Create lab record |
| PUT  | `/api/faculty/lab/:id` | Update record |
| DELETE | `/api/faculty/lab/:id` | Delete record |
| GET  | `/api/faculty/announcements` | Class announcements |
| POST | `/api/faculty/announcements` | Create announcement |
| DELETE | `/api/faculty/announcements/:id` | Delete announcement |
| GET  | `/api/faculty/students` | Assigned students |
| GET  | `/api/faculty/notifications` | System notifications |
| PUT  | `/api/faculty/profile` | Update profile |
| GET  | `/api/faculty/diary` | Class diary |
| POST | `/api/faculty/diary` | Create diary entry |
| PUT  | `/api/faculty/diary/:id` | Update entry |
| DELETE | `/api/faculty/diary/:id` | Delete entry |
| POST | `/api/faculty/leaves` | Apply for leave |
| GET  | `/api/faculty/leaves` | My leave requests |
| GET  | `/api/faculty/doubts` | Student doubts |
| PUT  | `/api/faculty/doubts/:id/answer` | Answer doubt |
| GET  | `/api/faculty/analytics` | Student analytics |
| GET  | `/api/faculty/calendar` | Calendar events |

---

## COE / Exam Cell (`/api/coe`) — `coe`, `exam_cell`, `super_admin`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/coe/dashboard-stats` | Exam operations KPIs |
| POST | `/api/coe/exams` | Create exam |
| GET  | `/api/coe/exams` | List exams |
| PUT  | `/api/coe/exams/:id` | Update exam |
| DELETE | `/api/coe/exams/:id` | Delete exam |
| POST | `/api/coe/exams/:id/publish` | Publish exam |
| POST | `/api/coe/exam-schedules` | Create schedule |
| GET  | `/api/coe/exam-schedules` | List schedules |
| PUT  | `/api/coe/exam-schedules/:id` | Update schedule |
| DELETE | `/api/coe/exam-schedules/:id` | Delete schedule |
| POST | `/api/coe/exam-schedules/publish` | Publish timetable |
| GET  | `/api/coe/hall-tickets` | List hall tickets |
| POST | `/api/coe/hall-tickets/generate` | Generate bulk hall tickets |
| PUT  | `/api/coe/hall-tickets/:id/status` | Update hall ticket status |
| POST | `/api/coe/seating/allocate` | Allocate seating |
| GET  | `/api/coe/seating` | Seating arrangements |
| POST | `/api/coe/invigilation` | Assign invigilation |
| GET  | `/api/coe/invigilation` | Invigilation duties |
| GET  | `/api/coe/internal-marks` | Internal marks |
| PUT  | `/api/coe/internal-marks/:id/verify` | Verify mark |
| GET  | `/api/coe/internal-marks/discrepancies` | Discrepancy report |
| POST | `/api/coe/external-marks` | Upload external marks |
| POST | `/api/coe/external-marks/bulk` | Bulk upload marks |
| POST | `/api/coe/results/process` | Process semester results |
| GET  | `/api/coe/results` | List exam results |
| PUT  | `/api/coe/results/:id/publish` | Publish result |
| POST | `/api/coe/revaluation` | Apply for revaluation |
| GET  | `/api/coe/revaluation` | Revaluation requests |
| PUT  | `/api/coe/revaluation/:id/status` | Update revaluation status |
| PUT  | `/api/coe/malpractices/:id` | Update malpractice |
| DELETE | `/api/coe/malpractices/:id` | Delete malpractice |
| POST | `/api/coe/exam-attendance` | Save exam attendance |
| GET  | `/api/coe/exam-attendance` | Exam attendance records |
| POST | `/api/coe/notifications` | Publish exam notification |
| GET  | `/api/coe/students/search` | Search student exams |
| GET  | `/api/coe/audit-logs` | Audit logs |
| PUT  | `/api/coe/profile` | Update COE profile |

---

## College (`/api/college`)

| Method | Endpoint | Roles | Description |
|--------|----------|-------|-------------|
| GET  | `/api/college` | `super_admin`, `principal` | Get college info |
| POST | `/api/college` | `super_admin` | Create college |
| PUT  | `/api/college/:code` | `super_admin`, `principal` | Update college |

## Admin (`/api/admin`) — `admin`

| Method | Endpoint | Description |
|--------|----------|-------------|
| (see adminRoutes.js for full list) | | College office operations |

## Official (`/api/official`) — `official`

| Method | Endpoint | Description |
|--------|----------|-------------|
| (see officialRoutes.js) | | Official document operations |

## ERP (`/api/erp`) — `student`, `faculty`, `hod`, `admin`

| Method | Endpoint | Description |
|--------|----------|-------------|
| (see erpRoutes.js) | | ERP data access |

## Parent (`/api/parent`) — `parent`

| Method | Endpoint | Description |
|--------|----------|-------------|
| (see parentRoutes.js) | | Child data read-only |

## Recruiter (`/api/recruiter`) — `recruiter`

| Method | Endpoint | Description |
|--------|----------|-------------|
| (see recruiterRoutes.js) | | Placement operations |

---

## Health & Utility

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | None | Health check (`{ status: "OK" }`) |
| GET | `/api` | None | Service info |
| GET | `/privacy` | None | Privacy policy (HTML) |

---

## Error Response Format

```json
{
  "message": "Human-readable error description."
}
```

### Validation Error (422)

```json
{
  "message": "Validation failed. Please check your inputs.",
  "errors": [
    { "field": "email", "message": "Must be a valid email address." },
    { "field": "password", "message": "Must be at least 8 characters." }
  ]
}
```
