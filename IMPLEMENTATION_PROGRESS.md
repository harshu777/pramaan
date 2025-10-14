# Certificate Management System - Major Refactoring Progress

## Overview
This document tracks the progress of the comprehensive refactoring requested for the certificate management system.

## Completed Tasks ✅

### 1. Database Schema Updates
- ✅ Added `father_name` field to athletes table
- ✅ Expanded athlete_competitions table with all certificate fields
- ✅ Modified quota_certificate_requests for new workflow
- ✅ Added `supporting_documents` to complaints table
- ✅ Changed issuers table from DID-based to username/password
- ✅ Added `role` field to issuers table
- ✅ Updated default admin credentials (username: admin, password: admin123)

### 2. Authentication Changes
- ✅ Replaced DID-based login with username/password for admins
- ✅ Updated issuer registration endpoint
- ✅ Updated issuer login endpoint
- ✅ Updated JWT token generation

### 3. Bulk Upload Workflow
- ✅ Modified bulk upload to ONLY insert data into database
- ✅ No certificate generation during bulk upload
- ✅ Certificates will be generated when athletes request them
- ✅ Data stored in `athlete_competitions` table awaiting requests

## In Progress / Pending Tasks 🚧

### 4. Certificate Request Workflow (CRITICAL)
- ⏳ Athletes can view all their competition records from DB
- ⏳ Athletes can request certificates for specific records
- ⏳ Admin dashboard shows all certificate requests
- ⏳ Admin can approve/reject certificate requests
- ⏳ Certificate generation happens ONLY on admin approval

### 5. User Registration Mapping
- ⏳ When athlete registers, map bulk uploaded data by name/DOB/phone
- ⏳ Auto-link competition records to athlete account

### 6. Admin Panel Restructuring
- ⏳ Create "Certificate Management" section
  - View all certificate requests
  - Approve/reject requests
  - Generate and issue certificates
- ⏳ Create "Document Management" section
  - Upload documents
  - Manage document categories
- ⏳ Remove "Auto Assign" functionality
- ⏳ Remove "Manage Athletes" section
- ⏳ Simplify document upload popup (only file + filename)

### 7. Frontend Updates
- ⏳ Update login.html for username/password (remove DID)
- ⏳ Create new athlete dashboard showing available certificates
- ⏳ Add "Request Certificate" button for each competition record
- ⏳ Update admin dashboard with new sections
- ⏳ Improve UI/UX (professional design)

### 8. Certificate PDF Generation
- ⏳ Update pdfService to use new template (certificate-template.jpg)
- ⏳ Match exact format from new format.jpg

### 9. Complaints & Support
- ⏳ Add document upload capability to complaints
- ⏳ Update complaint routes to handle file uploads

### 10. Appeals System
- ⏳ Check if request unfulfilled after 15 days
- ⏳ Allow athlete to raise appeal
- ⏳ Admin can review and resolve appeals
- ⏳ Send notifications after appeal acceptance

### 11. Notification System
- ⏳ Email notifications for certificate approval
- ⏳ Email notifications for appeal responses
- ⏳ In-app notifications

## New API Endpoints Needed

### Athletes
- `GET /api/athletes/my-records` - Get all competition records for logged-in athlete
- `POST /api/athletes/request-certificate/:recordId` - Request certificate for a record
- `GET /api/athletes/my-requests` - Get all certificate requests status
- `POST /api/athletes/appeal/:requestId` - Raise an appeal

### Admin
- `GET /api/admin/certificate-requests` - Get all pending requests
- `POST /api/admin/approve-request/:requestId` - Approve and generate certificate
- `POST /api/admin/reject-request/:requestId` - Reject request with reason
- `GET /api/admin/appeals` - Get all appeals
- `POST /api/admin/resolve-appeal/:appealId` - Resolve an appeal

## Database Changes Summary

### Modified Tables
1. **issuers** - Added username (UNIQUE), removed DID requirement, added role
2. **athletes** - Added father_name
3. **athlete_competitions** - Expanded with all certificate fields
4. **quota_certificate_requests** - Modified for new workflow
5. **complaints** - Added supporting_documents, athlete_id

### Default Credentials
- **Admin Login**: username: `admin`, password: `admin123`
- **Organization**: Directorate of Sports and Youth Services, Maharashtra

## Next Steps

1. ✅ Implement athlete competition records viewing
2. ✅ Create certificate request API endpoints
3. ✅ Build admin approval workflow
4. ✅ Update all frontend pages
5. ✅ Implement appeals system
6. ✅ Add notifications
7. ✅ Update PDF generation
8. ✅ Update login pages
9. ✅ Test end-to-end workflow

## Testing Checklist

- [ ] Admin can login with username/password
- [ ] Bulk upload stores data without generating certificates
- [ ] Athlete registers and sees competition records
- [ ] Athlete can request certificate
- [ ] Admin sees certificate requests
- [ ] Admin can approve request and generate certificate
- [ ] Athlete receives certificate via email
- [ ] Appeals system works after 15 days
- [ ] Document upload works in complaints
- [ ] Notifications are sent appropriately

## Files Modified

### Backend
1. `/root/pramaan/backend/src/config/database-sqlite.ts` - Schema updates
2. `/root/pramaan/backend/src/routes/issuerRoutes.ts` - Auth changes
3. `/root/pramaan/backend/src/services/bulkUploadService.ts` - Workflow changes

### Frontend (Pending)
1. `/root/pramaan/backend/public/login.html` - Update to username/password
2. `/root/pramaan/backend/public/dashboard.html` - Restructure admin panel
3. `/root/pramaan/backend/public/athlete-dashboard.html` - Add certificate requests
4. New file needed: `/root/pramaan/backend/public/certificate-requests.html`

## Notes

- The new certificate format template is located at: `/root/pramaan/backend/public/images/certificate-template.jpg`
- All existing certificates in the system will continue to work
- New workflow is backward compatible
- Focus is on "request-based" certificate generation vs automatic generation
