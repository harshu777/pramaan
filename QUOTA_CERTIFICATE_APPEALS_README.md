# 5% Quota Certificate & Appeals System

## Overview

This system implements the 5% quota certificate issuance process for athletes along with a two-level appeal system for rejected applications.

## Features Implemented

### 1. 5% Quota Certificate Request System

**Prerequisites:**
- Athlete must be signed in to the portal
- Athlete must have competition data in the system

**Features:**
- Athlete validates credentials using Unique ID and Aadhar number
- System retrieves competition records from database
- Competition data displayed in tabular format
- Athlete can select multiple records for certificate issuance
- System automatically issues certificate upon submission
- If data not found: displays message "The application to issue the certificate is being received and will receive the update in 15 days"

### 2. Two-Level Appeal System

#### First Appeal
- Filed with: **Joint Director, Sports and Youth Services**
- Athlete can file when certificate request is rejected
- Admin can:
  - View all first appeals
  - Approve appeal (allows athlete to reapply)
  - Reject appeal with reason (athlete can file second appeal)

#### Second Appeal
- Filed with: **Commissioner, Sports and Youth Services, Pune**
- Athlete can file only if first appeal was rejected
- Admin can:
  - View all second appeals
  - Approve appeal (allows athlete to reapply)
  - Reject appeal with reason (final decision)

## Database Schema

### New Tables Created

#### `athlete_competitions`
Stores competition records for athletes:
- `id`: Primary key
- `athlete_id`: Foreign key to athletes table
- `unique_id`: Athlete's unique ID
- `aadhar_number`: Athlete's Aadhar number
- `competition_name`: Name of competition
- `competition_type`: Type (Athletics, Swimming, etc.)
- `event_name`: Specific event
- `position`: Position achieved
- `medal_type`: Gold/Silver/Bronze
- `competition_date`: Date of competition
- `competition_level`: State/National/International
- `organizing_body`: Organizing authority
- `location`: Competition location
- `certificate_issued`: Boolean flag

#### `quota_certificate_requests`
Stores 5% quota certificate requests:
- `id`: Primary key
- `athlete_id`: Foreign key to athletes
- `unique_id`: Validated unique ID
- `aadhar_number`: Validated Aadhar number
- `selected_records`: JSON array of selected competition IDs
- `status`: pending/approved/rejected/appeal_approved
- `certificate_id`: Generated certificate reference
- `admin_notes`: Admin remarks
- `requested_at`: Request timestamp
- `processed_at`: Processing timestamp
- `processed_by`: Admin who processed

#### `certificate_appeals`
Stores appeal records:
- `id`: Primary key
- `request_id`: Foreign key to quota_certificate_requests
- `athlete_id`: Foreign key to athletes
- `appeal_type`: first_appeal/second_appeal
- `appeal_level`: 1 or 2
- `reason`: Athlete's reason for appeal
- `supporting_documents`: Optional documents
- `status`: pending/approved/rejected
- `resolution`: Admin's decision reason
- `resolved_by`: Admin who resolved
- `resolved_at`: Resolution timestamp

## API Endpoints

### Quota Certificate Endpoints

#### Validate Athlete & Retrieve Records
```http
POST /api/quota-certificates/validate
Authorization: Bearer <token>

{
  "uniqueId": "ATH2024001",
  "aadharNumber": "123456789012"
}
```

#### Submit Certificate Request
```http
POST /api/quota-certificates/request
Authorization: Bearer <token>

{
  "uniqueId": "ATH2024001",
  "aadharNumber": "123456789012",
  "selectedRecords": ["uuid1", "uuid2", "uuid3"]
}
```

#### Get Athlete's Requests
```http
GET /api/quota-certificates/my-requests
Authorization: Bearer <token>
```

#### Admin: Get All Requests
```http
GET /api/quota-certificates/admin/all?status=pending
Authorization: Bearer <token>
```

#### Admin: Update Request Status
```http
PUT /api/quota-certificates/admin/:requestId/status
Authorization: Bearer <token>

{
  "status": "approved|rejected",
  "adminNotes": "Reason for decision",
  "certificateId": "cert-uuid"
}
```

### Appeal Endpoints

#### Create New Appeal
```http
POST /api/appeals/create
Authorization: Bearer <token>

{
  "requestId": "optional-request-uuid",
  "appealLevel": 1,  // 1 for first appeal, 2 for second
  "reason": "Reason for appeal",
  "supportingDocuments": "optional-docs"
}
```

#### Get Athlete's Appeals
```http
GET /api/appeals/my-appeals
Authorization: Bearer <token>
```

#### Admin: Get All Appeals
```http
GET /api/appeals/admin/all?status=pending&appealLevel=1
Authorization: Bearer <token>
```

#### Admin: Get Appeal Details
```http
GET /api/appeals/admin/:appealId
Authorization: Bearer <token>
```

#### Admin: Resolve Appeal
```http
PUT /api/appeals/admin/:appealId/resolve
Authorization: Bearer <token>

{
  "status": "approved|rejected",
  "resolution": "Reason for decision"
}
```

#### Admin: Get Appeal Statistics
```http
GET /api/appeals/admin/stats/summary
Authorization: Bearer <token>
```

## Frontend Pages

### For Athletes

1. **Quota Certificate Request** (`/static/quota-certificate-request.html`)
   - Validate credentials (Unique ID + Aadhar)
   - View competition records
   - Select records for certificate
   - Submit request

2. **My Appeals** (`/static/athlete-appeals.html`)
   - View all filed appeals
   - File new first/second appeal
   - View appeal status and resolution

### For Admins

1. **Appeal Management Dashboard** (`/static/admin-appeals.html`)
   - View all appeals with filters
   - View appeal details
   - Approve/Reject appeals with reason
   - View appeal statistics

## Sample Data

### Sample Athletes (for testing)

```
Email: rajesh.kumar@example.com
Password: athlete123
Unique ID: ATH2024001
Aadhar: 123456789012

Email: priya.sharma@example.com
Password: athlete123
Unique ID: ATH2024002
Aadhar: 234567890123

Email: amit.patel@example.com
Password: athlete123
Unique ID: ATH2024003
Aadhar: 345678901234
```

Each athlete has 2-3 competition records pre-loaded for testing.

## Setup Instructions

### 1. Enable Sample Data Seeding

Add to backend `.env`:
```
SEED_COMPETITION_DATA=true
```

### 2. Restart Backend

```bash
cd backend
npm run dev
```

This will:
- Create new database tables
- Insert sample athletes with competition data
- Make the system ready for testing

### 3. Test the Flow

#### Testing Certificate Request:
1. Login as athlete (use sample credentials above)
2. Navigate to "Request 5% Quota Certificate"
3. Enter Unique ID and Aadhar number
4. View retrieved competition records
5. Select records and submit

#### Testing Appeal Flow:
1. Admin rejects a certificate request
2. Athlete navigates to "My Appeals"
3. Files first appeal with Joint Director
4. Admin reviews and rejects first appeal
5. Athlete files second appeal with Commissioner
6. Admin reviews and approves/rejects second appeal

## Workflow Diagrams

### Certificate Request Flow
```
Athlete Login
  ↓
Enter Unique ID + Aadhar
  ↓
System Validates
  ↓
┌─────────────────┬──────────────────┐
│ Data Found      │ Data Not Found   │
│   ↓             │   ↓              │
│ Display Records │ Show Message     │
│   ↓             │ (15 days wait)   │
│ Select Records  │                  │
│   ↓             │                  │
│ Submit Request  │                  │
│   ↓             │                  │
│ Auto-Approve    │                  │
│   ↓             │                  │
│ Issue Cert      │                  │
└─────────────────┴──────────────────┘
```

### Appeal Flow
```
Certificate Request Rejected
  ↓
File First Appeal (Joint Director)
  ↓
┌──────────────┬────────────────┐
│ Approved     │ Rejected       │
│   ↓          │   ↓            │
│ Can Reapply  │ File Second    │
│              │ Appeal         │
│              │ (Commissioner) │
│              │   ↓            │
│              │ ┌───────┬──────┐
│              │ │Approve│Reject│
│              │ │  ↓    │  ↓   │
│              │ │Reapply│Final │
└──────────────┴─┴───────┴──────┘
```

## Business Rules

1. **Aadhar Validation**: Must be exactly 12 digits
2. **Unique ID**: Must match athlete's registered ID
3. **Certificate Auto-Issuance**: Approved requests automatically trigger certificate generation
4. **Appeal Sequence**: Second appeal only after first appeal rejection
5. **Data Not Found**: 15-day processing message for missing data
6. **Competition Records**: Can only use records where `certificate_issued = false`

## Security Considerations

- JWT authentication required for all endpoints
- Athletes can only access their own data
- Admin authentication required for admin endpoints
- Aadhar numbers are stored securely (consider encryption in production)
- Input validation on all forms
- SQL injection prevention via parameterized queries

## Future Enhancements

1. Email notifications for appeal status changes
2. SMS notifications via Aadhar-linked mobile
3. Document upload support for appeals
4. Certificate PDF generation integration
5. Blockchain integration for appeal audit trail
6. Analytics dashboard for appeal trends
7. Auto-escalation for pending appeals
8. Integration with Sports Authority databases

## Support

For issues or questions:
1. Check API response error messages
2. Review backend logs in `backend/error.log`
3. Verify database schema is up-to-date
4. Ensure sample data is seeded properly

## Testing Checklist

- [ ] Athlete can login successfully
- [ ] Validation with correct Unique ID + Aadhar works
- [ ] Validation with incorrect credentials shows 15-day message
- [ ] Competition records display correctly
- [ ] Certificate request submission works
- [ ] Athlete can view request history
- [ ] Admin can view all requests
- [ ] Admin can reject request
- [ ] Athlete can file first appeal
- [ ] Admin can approve/reject first appeal
- [ ] Athlete can file second appeal (after first rejection)
- [ ] Admin can approve/reject second appeal
- [ ] Appeal statistics display correctly
- [ ] All filters work properly
