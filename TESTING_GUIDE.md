# Testing Guide - 5% Quota Certificate & Appeals System

## System Status

✅ Backend is running on port 3000
✅ Database recreated with new schema
✅ Sample data seeded successfully
✅ All new API endpoints are working

## Sample Test Accounts

### Athlete 1 - Rajesh Kumar (Athletics)
- **Email:** rajesh.kumar@example.com
- **Password:** athlete123
- **Unique ID:** ATH2024001
- **Aadhar:** 123456789012
- **Competitions:** 3 records (State Gold, National Silver, District Gold)

### Athlete 2 - Priya Sharma (Swimming)
- **Email:** priya.sharma@example.com
- **Password:** athlete123
- **Unique ID:** ATH2024002
- **Aadhar:** 234567890123
- **Competitions:** 2 records (State Gold, National Bronze)

### Athlete 3 - Amit Patel (Wrestling)
- **Email:** amit.patel@example.com
- **Password:** athlete123
- **Unique ID:** ATH2024003
- **Aadhar:** 345678901234
- **Competitions:** 2 records (State Silver, Zonal Gold)

## Testing Steps

### 1. Test Certificate Request Flow

1. **Login as Athlete:**
   - Navigate to: http://localhost:3000/static/athlete-login.html
   - Use credentials: `rajesh.kumar@example.com` / `athlete123`

2. **Request Certificate:**
   - Click "Request 5% Quota Certificate" (or navigate to `/static/quota-certificate-request.html`)
   - Enter:
     - Unique ID: `ATH2024001`
     - Aadhar: `123456789012`
   - Click "Validate & Retrieve Records"

3. **Expected Result:**
   - Should display 3 competition records in a table
   - Gold medals in Maharashtra State Athletics Championship
   - Silver medal in National Junior Athletics Meet
   - Gold medal in Inter-District Athletics Championship

4. **Select and Submit:**
   - Check one or more competition records
   - Click "Submit Certificate Request"
   - Should show success message and auto-approve

### 2. Test Data Not Found Scenario

1. **Login as any athlete**

2. **Request with wrong credentials:**
   - Unique ID: `ATH9999999`
   - Aadhar: `999999999999`
   - Click "Validate & Retrieve Records"

3. **Expected Result:**
   - Should display message: "The application to issue the certificate is being received and will receive the update in 15 days"

### 3. Test First Appeal Flow

1. **Admin rejects a request first:**
   - Login as admin/issuer (use default issuer account)
   - Navigate to quota requests management
   - Reject an athlete's request

2. **Athlete files first appeal:**
   - Login as affected athlete
   - Navigate to: `/static/athlete-appeals.html`
   - Click "File New Appeal"
   - Select "First Appeal (Joint Director)"
   - Enter reason
   - Submit

3. **Admin reviews first appeal:**
   - Login as admin
   - Navigate to: `/static/admin-appeals.html`
   - Filter by "Pending" and "First Appeal"
   - Click "View" to see details
   - Click "Approve" or "Reject" with reason

### 4. Test Second Appeal Flow

1. **Admin rejects first appeal:**
   - Follow step 3 above and reject the first appeal

2. **Athlete files second appeal:**
   - Login as athlete
   - Navigate to appeals page
   - File "Second Appeal (Commissioner)"
   - Enter detailed reason

3. **Admin reviews second appeal:**
   - Admin navigates to appeals dashboard
   - Filter by "Second Appeal"
   - Review and approve/reject

### 5. Test Admin Appeal Dashboard

1. **Navigate to:** `/static/admin-appeals.html`

2. **Verify functionality:**
   - Statistics cards show correct counts
   - Filter by status (Pending/Approved/Rejected)
   - Filter by level (First/Second Appeal)
   - View appeal details
   - Resolve appeals with reasons

## API Testing with cURL

### Login
```bash
curl -X POST http://localhost:3000/api/athletes/login \
  -H "Content-Type: application/json" \
  -d '{"email":"rajesh.kumar@example.com","password":"athlete123"}'
```

### Validate & Retrieve Competition Data
```bash
TOKEN="your_token_from_login"

curl -X POST http://localhost:3000/api/quota-certificates/validate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"uniqueId":"ATH2024001","aadharNumber":"123456789012"}'
```

### Submit Certificate Request
```bash
curl -X POST http://localhost:3000/api/quota-certificates/request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "uniqueId":"ATH2024001",
    "aadharNumber":"123456789012",
    "selectedRecords":["competition-id-1","competition-id-2"]
  }'
```

### File Appeal
```bash
curl -X POST http://localhost:3000/api/appeals/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "appealLevel":1,
    "reason":"My certificate was rejected unfairly..."
  }'
```

### View My Appeals
```bash
curl -X GET http://localhost:3000/api/appeals/my-appeals \
  -H "Authorization: Bearer $TOKEN"
```

## Database Verification

Check if data exists:
```bash
cd /root/pramaan/backend
sqlite3 certificates.db "SELECT * FROM athletes WHERE email LIKE '%example.com%'"
sqlite3 certificates.db "SELECT * FROM athlete_competitions"
sqlite3 certificates.db "SELECT * FROM quota_certificate_requests"
sqlite3 certificates.db "SELECT * FROM certificate_appeals"
```

## Troubleshooting

### If you get 502 Bad Gateway:
1. Check backend logs: `tail -f /root/pramaan/backend.log`
2. Verify backend is running: `ps aux | grep tsx`
3. Check health endpoint: `curl http://localhost:3000/health`

### If database errors occur:
1. Remove old database: `rm /root/pramaan/backend/certificates.db`
2. Restart backend (it will auto-create new DB)
3. Re-run seeding script (shown above)

### If sample data is missing:
```bash
cd /root/pramaan/backend
node -e "
const { seedCompetitionData } = require('./dist/utils/seedCompetitionData');
const { initializeDatabase } = require('./dist/config/database-sqlite');
(async () => {
  await initializeDatabase();
  await seedCompetitionData();
  process.exit(0);
})();
"
```

## Expected Behaviors

✅ **Certificate Request:**
- Validates Aadhar (exactly 12 digits)
- Validates Unique ID matches athlete record
- Returns competition data in table format
- Allows multiple record selection
- Auto-approves on submission

✅ **Appeals:**
- First appeal only after request rejection
- Second appeal only after first appeal rejection
- Admin can approve (athlete can reapply)
- Admin can reject with reason
- Appeal statistics update in real-time

✅ **Security:**
- All endpoints require JWT authentication
- Athletes can only access their own data
- Admin endpoints check for admin role
- Input validation on all forms

## Success Metrics

- ✅ Athlete can login
- ✅ Certificate validation works with correct credentials
- ✅ 15-day message displays for invalid credentials
- ✅ Competition records display in table
- ✅ Certificate requests can be submitted
- ✅ Appeals can be filed (first and second level)
- ✅ Admin can view all appeals
- ✅ Admin can approve/reject appeals
- ✅ Statistics display correctly

## Next Steps for Production

1. **Security Enhancements:**
   - Encrypt Aadhar numbers in database
   - Add rate limiting per user
   - Implement 2FA for admin actions
   - Add audit logs for all appeal actions

2. **Notifications:**
   - Email on appeal status change
   - SMS via Aadhar-linked mobile
   - In-app notifications

3. **Integration:**
   - Real-time Sports Authority database sync
   - Automated certificate PDF generation
   - Blockchain integration for appeals

4. **UI/UX:**
   - Add progress indicators
   - Implement file upload for supporting documents
   - Mobile-responsive improvements
   - Accessibility enhancements

All systems are operational and ready for testing! 🎉
