# Project Structure

This document outlines the file and folder layout of the **Student OS** and **Campus OS** backend service.

```text
student-os-backend-main/
├── config/                     # Core configurations
│   └── r2.js                   # Cloudflare R2 / AWS S3 client config
├── controllers/                # Business logic controllers
│   ├── adminController.js      # General admin dashboard controls
│   ├── attendanceController.js # Academic attendance tracking
│   ├── authController.js       # Main OAuth & JWT authentication handlers
│   ├── bookmarkController.js   # PDF & resource bookmarking
│   ├── campusAuthController.js # Role-based portal validations
│   ├── coeController.js        # Controller of Examinations tasks
│   ├── collegeController.js    # Master college directory operations & Smart Search
│   ├── collegeRequestController.js # Onboarding request collection
│   ├── communityController.js  # Chat, stories, calls, and suggestions
│   ├── erpController.js        # College ERP cluster config API
│   ├── facultyController.js    # Teacher & class grading controls
│   ├── groupController.js      # Peer group chat and category management
│   ├── hodController.js        # Department leave & materials approval
│   ├── noteController.js       # Student quick-notes API
│   ├── notificationController.js # Notification dispatcher
│   ├── officialController.js   # Institution admins (Accounts, HR, Transport)
│   ├── parentController.js     # Parent portal access
│   ├── postController.js       # Community posts, likes, comments, and R2 deletion cleanups
│   ├── principalController.js  # Principal institutional dashboard
│   ├── recruiterController.js  # Recruiter job drive controls
│   ├── studyController.js      # Student academic goals and timetables
│   ├── subjectFolderController.js # Notes categorizer
│   ├── superAdminController.js # Global platform controls
│   ├── superAdminRequestController.js # College request verification & billing audits
│   └── taskController.js       # Todo list API
├── middleware/                 # Express route interceptors
│   ├── authMiddleware.js       # JWT & session verification guard
│   └── uploadMiddleware.js     # Cloudflare R2 multer buffer uploader
├── models/                     # Mongoose database models
│   ├── AcademicCalendar.js
│   ├── Assignment.js
│   ├── Attendance.js
│   ├── AuditLog.js
│   ├── Book.js
│   ├── Bookmark.js
│   ├── BusRoute.js
│   ├── Call.js
│   ├── College.js              # College schemas, cities, and indexes
│   ├── CollegeRequest.js       # Onboarding request parameters
│   ├── Comment.js
│   ├── Company.js
│   ├── Department.js
│   ├── Event.js
│   ├── Exam.js
│   ├── ExamMark.js
│   ├── ExamResult.js
│   ├── ExamSchedule.js
│   ├── FavouritePDF.js
│   ├── FeeLedger.js
│   ├── FocusSession.js
│   ├── Group.js
│   ├── GroupCall.js
│   ├── GroupCategory.js
│   ├── GroupMember.js
│   ├── GroupMessage.js
│   ├── HallTicket.js
│   ├── HostelAllocation.js
│   ├── Inventory.js
│   ├── Invoice.js              # Subscription billing details
│   ├── JobApplication.js
│   ├── JobDrive.js
│   ├── LeaveRequest.js
│   ├── Like.js
│   ├── LoginSession.js
│   ├── Malpractice.js
│   ├── Material.js
│   ├── Message.js
│   ├── Note.js
│   ├── Notice.js
│   ├── Notification.js
│   ├── OrganizationSettings.js
│   ├── PageNote.js
│   ├── Permission.js
│   ├── PlacementDrive.js
│   ├── Post.js                 # Post schema holding images and attachment links
│   ├── Quiz.js
│   ├── QuizResult.js
│   ├── RefreshToken.js
│   ├── Report.js
│   ├── Role.js
│   ├── SavedPost.js
│   ├── Story.js
│   ├── StudyMaterial.js
│   ├── Subject.js
│   ├── SubjectFolder.js
│   ├── Subscription.js
│   ├── SubscriptionPlan.js
│   ├── Task.js
│   ├── Timetable.js
│   └── User.js                 # User records, roles, codes, and avatars
├── routes/                     # Express API endpoint declarations
│   ├── aiRoutes.js
│   ├── attendanceRoutes.js
│   ├── authRoutes.js
│   ├── bookmarkRoutes.js
│   ├── campusAuthRoutes.js
│   ├── collegeRequestRoutes.js
│   ├── collegeRoutes.js
│   ├── communityRoutes.js
│   ├── erpRoutes.js
│   ├── erpRoutes.js
│   ├── focusRoutes.js
│   ├── noteRoutes.js
│   ├── notificationRoutes.js
│   ├── studyRoutes.js
│   ├── superAdminRequestRoutes.js
│   ├── superAdminRoutes.js
│   ├── taskRoutes.js
│   └── timetableRoutes.js
├── scratch/                    # Test files and utilities
│   ├── createTestCollege.js    # Onboarding test runner
│   ├── registerPrincipal.js    # Principal credentials validator
│   ├── resetSuperAdmin.js      # Credentials manager
│   ├── testApiUpload.js        # Multipart post uploader test
│   ├── testR2Upload.js         # Cloudflare R2 bucket test
│   └── testSmartSearch.js      # Typos and multi-field query validator
├── scripts/                    # Database seeding and compiler logic
│   ├── generateAllApColleges.js # Seeding 450+ colleges with cities and indexes
│   └── seedApColleges.js       # Master directory compiler
├── services/                   # High-level service adapters
│   ├── auditLogService.js      # System logger
│   └── r2Storage.js            # Object storage service (Cloudflare R2 S3-Compatible)
├── utils/                      # Helper utilities
│   ├── apCollegesData.js       # Hardcoded dataset compilation
│   ├── deleteFromR2.js         # R2 object delete script
│   ├── seedMasterData.js       # Database master record compiler
│   └── uploadToR2.js           # R2 object upload helper
├── .env                        # Private environment keys
├── db.js                       # Mongo Database connection initializer
├── firebase.js                 # Firebase messaging initializer
├── index.js                    # Core App entrypoint (Express + WebSockets)
├── package.json                # Project dependencies and configurations
├── socket.js                   # WebSocket handler
└── test_backend_local.js       # Dependency integrity checker
```
