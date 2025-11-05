# Appeal System Testing Guide

## Overview
This guide will help you test the 1st and 2nd appeal functionality for the Pramaan certificate system.

## Test User Details
- **Email:** prasad@gmail.com
- **Password:** Prasad@123
- **Special Feature:** Bypasses 20-day waiting period for immediate testing

---

## Test Scenario: Complete Appeal Flow

### ✅ **STEP 1: Login as Athlete (Prasad)**

1. Navigate to athlete login page
2. Login with:
   - Email: `prasad@gmail.com`
   - Password: `Prasad@123`

---

### ✅ **STEP 2: View Pending Request**

1. Once logged in, you'll see the athlete dashboard
2. Click on **"My Requests"** button (green button)
3. You should see:
   - **Competition:** The Maharashtra State Rugby Sevens Championship 2025
   - **Status:** PENDING
   - A message showing how many days since request was made
4. You should see an option to **"Raise Appeal"** button
   - Note: Normally this requires 20 days of waiting
   - For prasad@gmail.com, this appears immediately (bypassed for testing)

---

### ✅ **STEP 3: Submit First Appeal**

1. From the "My Requests" screen, click **"Raise Appeal"** button
2. A prompt will appear asking for the appeal reason
3. Enter a reason, for example:
   ```
   First Appeal: My certificate request has been pending for a long time.
   I need this certificate urgently for my job application.
   Please expedite the process.
   ```
4. Click OK/Submit
5. You should see a success message
6. The system should show that an appeal has been raised

---

### ✅ **STEP 4: Verify First Appeal**

1. Click on **"My Appeals"** button (red button)
2. You should see your appeal with:
   - **Status:** PENDING
   - **Competition:** The Maharashtra State Rugby Sevens Championship 2025
   - **Your Appeal Reason:** The text you entered
   - **Created date:** Current date/time
3. A message showing "Your appeal is pending admin review"

---

### ✅ **STEP 5: Admin Rejects First Appeal**

**Switch to Admin Panel:**

1. Logout from athlete account
2. Login to admin panel with admin credentials:
   - Username: `admin`
   - Password: `admin123`

3. Navigate to **Appeals** section in admin dashboard
4. Find Prasad's appeal in the list
5. Click to view details
6. Choose **"Reject"** status
7. Provide a rejection reason, for example:
   ```
   First Appeal Rejected: We need additional documentation to process
   your request. Please provide proof of participation in the competition.
   ```
8. Click Submit/Save
9. The appeal status should change to REJECTED

---

### ✅ **STEP 6: Logout and Login as Athlete Again**

1. Logout from admin panel
2. Login again as prasad@gmail.com
3. Go to **"My Appeals"**

---

### ✅ **STEP 7: Verify First Appeal Rejection & Submit Second Appeal**

1. In "My Appeals", you should see:
   - First appeal with **Status: REJECTED**
   - Admin's rejection reason
   - A new section saying **"First appeal was rejected"**
   - A button: **"Submit Second Appeal"**

2. Click **"Submit Second Appeal"** button
   - Note: Normally this requires 20 days after first appeal rejection
   - For prasad@gmail.com, this appears immediately (bypassed for testing)

3. Enter second appeal reason, for example:
   ```
   Second Appeal: I have now gathered all required documentation including
   participation certificate and medal photo. I have uploaded these documents.
   Please reconsider my request.
   ```

4. Click OK/Submit
5. You should see a success message

---

### ✅ **STEP 8: Verify Second Appeal**

1. Go to **"My Appeals"** again
2. You should now see **TWO appeals**:
   - **First Appeal:** Status = REJECTED
   - **Second Appeal:** Status = PENDING

3. Try clicking "Submit Second Appeal" again
4. You should get an error message:
   ```
   Maximum number of appeals (2) already submitted for this request
   ```

---

### ✅ **STEP 9: Admin Processes Second Appeal**

**Switch back to Admin Panel:**

1. Login to admin panel
2. Go to Appeals section
3. Find Prasad's second appeal
4. You can either:
   - **ACCEPT** it: Approve the appeal and allow certificate issuance
   - **REJECT** it: Reject the second appeal (this is final)

5. Provide appropriate response
6. Submit

---

## Expected Results Summary

| Action | Expected Result |
|--------|----------------|
| Login as prasad@gmail.com | ✅ Should login successfully |
| View My Requests | ✅ Should see pending request immediately |
| Raise First Appeal | ✅ Can raise immediately (no 20-day wait) |
| View My Appeals | ✅ Should see first appeal as PENDING |
| Admin rejects first appeal | ✅ Status changes to REJECTED |
| Athlete sees rejection | ✅ Sees rejection with reason |
| Raise Second Appeal | ✅ Can raise immediately (no 20-day wait) |
| View My Appeals | ✅ Should see both appeals |
| Try third appeal | ❌ Should be blocked (max 2 appeals) |

---

## Testing Edge Cases

### Test Case 1: Cannot raise 3rd appeal
- After submitting 2 appeals, try to submit another
- **Expected:** Error message about maximum appeals reached

### Test Case 2: Cannot appeal if first appeal is still pending
- If first appeal is pending, try to submit second appeal directly
- **Expected:** Error message that first appeal must be resolved first

### Test Case 3: Cannot appeal if first appeal was accepted
- If admin accepts first appeal, second appeal option should not appear
- **Expected:** No option to submit second appeal

---

## API Endpoints Reference

### Athlete Endpoints
```
POST /api/athletes/create-appeal/:requestId
GET  /api/athletes/my-appeals
GET  /api/athletes/my-requests
```

### Admin Endpoints
```
GET  /api/admin/appeals
POST /api/admin/resolve-appeal/:appealId
```

---

## Database Tables Involved

1. **quota_certificate_requests** - Certificate requests
2. **appeals** - Appeal records (simpler table)
3. **athletes** - Athlete information

---

## Troubleshooting

### Issue: Cannot see "Raise Appeal" button
- Check that request status is 'pending'
- Check that 20 days have passed (or using prasad@gmail.com)
- Check that no appeal exists already for this request

### Issue: Cannot submit second appeal
- Verify first appeal was rejected (not pending or accepted)
- Check using prasad@gmail.com for testing (bypasses 20-day wait)
- Verify only one appeal exists (not two already)

### Issue: Admin cannot see appeals
- Ensure logged in as admin/issuer (not athlete)
- Check admin routes are properly configured
- Verify appeals table has data

---

## Clean Up After Testing

To reset and test again, you can run:
```sql
-- Delete appeals for prasad
DELETE FROM appeals WHERE athlete_id = (
  SELECT id FROM athletes WHERE email = 'prasad@gmail.com'
);

-- Reset request to pending
UPDATE quota_certificate_requests
SET status = 'pending', processed_at = NULL
WHERE athlete_id = (
  SELECT id FROM athletes WHERE email = 'prasad@gmail.com'
);
```

Or simply run the setup script again:
```bash
cd /root/pramaan/backend
node setup-appeal-test.js
```

---

## Success Criteria

✅ **First Appeal Testing:**
- Athlete can submit first appeal without 20-day wait
- Appeal shows in "My Appeals" as PENDING
- Admin can see appeal in admin panel
- Admin can reject appeal with reason
- Athlete can see rejection reason

✅ **Second Appeal Testing:**
- After first appeal rejection, second appeal option appears
- Can submit second appeal immediately (no 20-day wait)
- Both appeals visible in "My Appeals"
- Cannot submit 3rd appeal
- Admin can process second appeal

---

## Notes

- **prasad@gmail.com** is a special test account that bypasses time restrictions
- Normal users must wait 20 days before raising appeals
- Maximum 2 appeals allowed per certificate request
- All appeal actions are logged in the database
- Admin responses are visible to athletes

---

**Last Updated:** $(date)
**Setup Script:** `/root/pramaan/backend/setup-appeal-test.js`
