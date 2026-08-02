# MongoDB Database Schema Reference

This document covers the Mongoose models, their relationships, indexes, unique constraints, and validation schemas in the **Student OS** and **Campus OS** backend.

---

## 🏛️ Core Schemas & Fields

### 1. User (`models/User.js`)
Stores all institutional profiles (Students, Faculty, COE, Admins, Super Admins, parents, etc.)
* **Fields**:
  - `fullName`: String (Required, trimmed)
  - `email`: String (Required, Unique, Lowercase, validated format)
  - `username`: String (Unique, Lowercase, alphanumeric/underscores)
  - `password`: String (Required, Bcrypt hashed)
  - `role`: String (Enum: `student`, `faculty`, `hod`, `coe`, `exam`, `accounts`, `hr`, `admissions`, `super_admin`, `parent`, `recruiter`)
  - `collegeCode`: String (Uppercase, matches master `College.collegeCode`)
  - `employeeId`: String (For staff/faculty)
  - `studentId`: String (For students)
  - `avatar`: String (Cloudflare R2 Public URL)
  - `coverPhoto`: String (Cloudflare R2 Public URL)
  - `resumeUrl`: String (Cloudflare R2 Public URL)
  - `isActive`: Boolean (Default: `true`)
  - `visibilitySettings`: Object (toggles profile visibility, mobile visibility, academic stats visibility)
* **Indexes**:
  - `email`: 1 (Unique)
  - `username`: 1 (Unique)
  - `collegeCode`: 1
  - `role`: 1

### 2. College (`models/College.js`)
Verified workspaces that run ERP clusters.
* **Fields**:
  - `collegeCode`: String (Required, Unique, Uppercase, Trimmed, e.g., `IIOTS724`)
  - `name`: String (Required, Trimmed)
  - `address`: String
  - `university`: String
  - `state`: String
  - `district`: String
  - `city`: String
  - `logo`: String (Cloudflare R2 Public URL)
  - `departments`: Array of Strings
  - `aisheCode`: String (Unique verified ID)
  - `collegeType`: String (Enum: `Private`, `Government`, `Autonomous`)
  - `verifiedBadge`: Boolean
  - `status`: String (Enum: `verified`, `pending_verification`, `pending_activation`, `rejected`, `suspended`, `active`)
  - `subscription`: Object (plan, startDate, expiryDate, storageLimit, studentLimit)
* **Indexes**:
  - `collegeCode`: 1 (Unique)
  - `name`: 1
  - `city`: 1
  - `district`: 1
  - `state`: 1
  - `university`: 1
  - `collegeType`: 1
  - `aisheCode`: 1

### 3. CollegeRequest (`models/CollegeRequest.js`)
Onboarding applications submitted by institutions to the Super Admin.
* **Fields**:
  - `collegeName`: String (Required)
  - `aisheCode`: String (Required)
  - `university`: String (Required)
  - `state`: String (Required)
  - `district`: String (Required)
  - `city`: String (Required)
  - `collegeType`: String
  - `website`: String
  - `officialEmail`: String (Required)
  - `officialPhone`: String (Required)
  - `address`: String (Required)
  - `pincode`: String (Required)
  - `principalName`: String (Required)
  - `principalEmail`: String (Required)
  - `status`: String (Enum: `pending`, `approved`, `rejected`; Default: `pending`)

### 4. Post (`models/Post.js`)
Community timeline activities, announcements, notes share, and certificates.
* **Fields**:
  - `author`: ObjectId (Ref: `User`, Required)
  - `type`: String (Enum: `notes`, `project`, `achievement`, `college`, `text`, `image`, `video`)
  - `title`: String
  - `content`: String
  - `images`: Array of Strings (Cloudflare R2 Public URLs)
  - `pdfUrl`: String (Cloudflare R2 Public URL)
  - `pdfName`: String
  - `pdfSize`: String
  - `fileUrl`: String
  - `category`: String (Enum: `project`, `hackathon`, `internship`, `placement`, `notes`, `achievement`, `certificate`, `question`, `announcement`, `text`)
  - `allowLikes`: Boolean (Default: `true`)
  - `allowComments`: Boolean (Default: `true`)
  - `visibility`: String (Enum: `public`, `friends_only`)
* **Indexes**:
  - `author`: 1
  - `category`: 1
  - `createdAt`: -1

### 5. Comment (`models/Comment.js`)
Feed post replies and interactions.
* **Fields**:
  - `post`: ObjectId (Ref: `Post`, Required)
  - `author`: ObjectId (Ref: `User`, Required)
  - `content`: String (Required)
  - `likes`: Array of ObjectIds (Ref: `User`)

---

## 📈 Academic & Operational Schemas

### 6. Timetable (`models/Timetable.js`)
Institution class schedules.
* **Fields**:
  - `collegeCode`: String (Required)
  - `department`: String (Required)
  - `semester`: Number (Required)
  - `section`: String
  - `slots`: [{ day, periodNumber, subject, teacherName, startTime, endTime, room }]

### 7. Attendance (`models/Attendance.js`)
Individual student attendance rosters.
* **Fields**:
  - `student`: ObjectId (Ref: `User`, Required)
  - `subject`: String (Required)
  - `date`: Date (Required)
  - `status`: String (Enum: `Present`, `Absent`, `Late`; Default: `Present`)
  - `markedBy`: ObjectId (Ref: `User`)

### 8. Material / StudyMaterial (`models/Material.js` / `models/StudyMaterial.js`)
Notes, syllabi, and study sheets uploaded by professors and HODs.
* **Fields**:
  - `title`: String (Required)
  - `type`: String (Enum: `Syllabus`, `Handout`, `Assignment`, `QuestionPaper`)
  - `fileUrl`: String (Cloudflare R2 Public URL)
  - `department`: String
  - `collegeCode`: String

### 9. Invoice (`models/Invoice.js`)
Subscription records generated automatically upon workspace verification.
* **Fields**:
  - `invoiceNumber`: String (Required, Unique)
  - `collegeCode`: String (Required)
  - `amount`: Number (Required)
  - `taxAmount`: Number (18% GST standard)
  - `totalAmount`: Number
  - `status`: String (Enum: `Paid`, `Unpaid`, `Overdue`)
  - `paymentGateway`: String (Default: `Razorpay`)

---

## 🔒 Security Constraints & Cascades

1. **Cascade Deletions**:
   - Deleting a `Post` triggers cascading removal of its associated comments (`Comment.deleteMany`), likes (`Like.deleteMany`), and files uploaded to **Cloudflare R2** (`deleteFromR2` on image list and PDFs).
   - Replacing a profile avatar triggers deletion of the old R2 asset automatically to prevent orphan file storage growth.
2. **Unique Identifiers**:
   - `User.email` & `User.username`
   - `College.collegeCode` & `College.aisheCode`
   - `Invoice.invoiceNumber`
