# Campus OS — Roles & Permissions Reference

> **Multi-Tenant SaaS Architecture**  
> Every request is scoped by `collegeCode`. Cross-college operations are blocked at the middleware layer.

---

## Roles Overview

| Role | Scope | Description |
|------|-------|-------------|
| `super_admin` | Platform-wide | ISR Web Design operations team. Full control over all colleges, subscriptions, and platform settings. |
| `principal` | Per-college | College head. Manages departments, staff, students, and configurations for their college. |
| `hod` | Per-department | Head of Department. Manages faculty, subjects, timetables, and students in their department. |
| `faculty` | Per-department | Teaching staff. Manages attendance, assignments, marks, lab records, and announcements. |
| `coe` | Per-college | Controller of Examinations. Manages all exam operations: schedules, hall tickets, marks, results. |
| `exam_cell` | Per-college | Exam cell operator (read-write access to COE routes, scoped to their college). |
| `admin` | Per-college | College admin/office staff. Manages ERP records, student data, and official documents. |
| `official` | Per-college | Official staff role for specific operational tasks. |
| `student` | Per-student | Student account. Access to personal academic data, community, tasks, notes, and timetable. |
| `parent` | Per-student | Parent/guardian account. Read-only access to their child's attendance, marks, and notices. |
| `recruiter` | External | Recruiter account for campus placement operations. |

---

## Middleware Security Chain

```
Request → protect (JWT Auth) → requireRole ([...roles]) → tenantIsolation (college/dept scoping) → Controller
```

- **`protect`** — Validates JWT, checks `isActive`, distinguishes `TokenExpiredError`.
- **`requireRole`** — Verifies `req.user.role` is in the allowed set.
- **`tenantIsolation`** — Injects `req.collegeCode` and `req.assignedDepartment`; blocks cross-college requests.

---

## Permission Matrix

### Student OS Routes (`/api/*`)

| Route | Methods | Roles | Notes |
|-------|---------|-------|-------|
| `/api/auth/login` | POST | Public | Rate-limited: 30/15min |
| `/api/auth/profile` | GET, PUT | `student`, all campus roles | Protected |
| `/api/auth/dashboard` | GET | All authenticated | |
| `/api/attendance` | GET, POST | `student`, `faculty` | |
| `/api/tasks` | CRUD | `student` | |
| `/api/notes` | CRUD | `student` | |
| `/api/timetable` | CRUD | `student` | |
| `/api/focus` | CRUD | `student` | |
| `/api/notifications` | GET | `student` | |
| `/api/ai` | POST | `student` | AI context service |
| `/api/study` | CRUD | `student` | Study resources |
| `/api/community` | CRUD | `student` | Posts, groups |
| `/api/bookmarks` | CRUD | `student` | |
| `/api/pagenotes` | CRUD | `student` | |
| `/api/favourites` | CRUD | `student` | Favourite PDFs |
| `/api/folders` | CRUD | `student` | Subject folders |

### Campus OS Routes

| Route | Methods | Roles | Notes |
|-------|---------|-------|-------|
| `/api/auth/campus/login` | POST | Public | Campus login flow |
| `/api/super-admin/*` | All | `super_admin` | Platform management |
| `/api/super-admin/requests/*` | All | `super_admin` | Onboarding, billing |
| `/api/college/*` | GET/POST/PUT | `super_admin`, `principal` | College config |
| `/api/principal/*` | All | `principal` | College management |
| `/api/principal/config` | GET | `principal`, `hod`, `faculty`, `student` | ERP config read |
| `/api/hod/timetable*` | All | `hod`, `faculty` | Shared timetable |
| `/api/hod/*` | All | `hod` | Department management |
| `/api/faculty/*` | All | `faculty` | Teaching operations |
| `/api/coe/*` | All | `coe`, `exam_cell`, `super_admin` | Exam management |
| `/api/admin/*` | All | `admin` | Office operations |
| `/api/official/*` | All | `official` | Official documents |
| `/api/erp/*` | All | `student`, `faculty`, `hod`, `admin` | ERP data access |
| `/api/parent/*` | GET | `parent` | Child's data |
| `/api/recruiter/*` | All | `recruiter` | Placement |
| `/api/student/*` | GET | `student` | Student-specific data |

### College Request Routes

| Route | Methods | Roles | Notes |
|-------|---------|-------|-------|
| `/api/college-requests` | POST | Public | New college onboarding request |
| `/api/super-admin/requests/*` | All | `super_admin` | Approve/reject requests |

---

## Tenant Isolation Rules

1. **All campus roles** have their `collegeCode` injected into `req.collegeCode`.
2. **HOD and Faculty** additionally have `req.assignedDepartment` injected.
3. Any request where the submitted `collegeCode` mismatches the authenticated user's college is **blocked with HTTP 403**.
4. **super_admin** bypasses all tenant isolation checks.

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | Success |
| `201` | Resource created |
| `400` | Bad request / validation error |
| `401` | Not authenticated (no/invalid/expired token) |
| `403` | Authenticated but not authorized (wrong role, wrong tenant) |
| `404` | Resource not found |
| `422` | Input validation failure (field-level errors returned) |
| `429` | Rate limit exceeded |
| `500` | Internal server error (details hidden in production) |
