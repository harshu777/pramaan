# 🎯 Step-by-Step Visual Guide - Testing Appeals

## ⚠️ Important: Start from "My Requests", NOT "My Appeals"

---

## 📍 Where You Are Now

You're seeing this:
```
┌────────────────────────────────────┐
│ My Appeals (0)                     │
├────────────────────────────────────┤
│ No Appeals                         │
│ You haven't raised any appeals yet.│
└────────────────────────────────────┘
```

This is correct! You haven't raised any appeals yet.

---

## ✅ What You Need to Do

### Step 1: Close the Appeals Modal

Click the X or click outside to close the "My Appeals" popup.

---

### Step 2: Click "My Requests" Button (GREEN button)

On the athlete dashboard, you should see these buttons:

```
┌──────────────────────────────────────────────┐
│                                              │
│  [Issued Certificates] (Blue)               │
│  [My Requests] (Green) ← CLICK THIS ONE!   │
│  [My Appeals] (Red)                         │
│  [Track Complaint] (Orange)                 │
│                                              │
└──────────────────────────────────────────────┘
```

**Click the GREEN "My Requests" button**

---

### Step 3: You'll See Your Pending Request

After clicking "My Requests", you should see:

```
┌────────────────────────────────────────────────┐
│ My Certificate Requests (1)                    │
├────────────────────────────────────────────────┤
│ The Maharashtra State Rugby Sevens             │
│ Championship 2025 for Senior Men & Women       │
│                                                │
│ Status: PENDING                                │
│ Game/Sport: Rugby                              │
│ Level: State                                   │
│ Requested: 2025-11-05 (0 days ago)            │
│                                                │
│ ⏳ Request Pending for 0 days                 │
│ You can now raise an appeal to expedite       │
│ this request.                                  │
│                                                │
│ [Raise Appeal] ← YOU SHOULD SEE THIS BUTTON   │
└────────────────────────────────────────────────┘
```

---

### Step 4: Click "Raise Appeal" Button

Click the **"Raise Appeal"** button (should be red/pink color).

A prompt will appear asking for your reason.

---

### Step 5: Enter Appeal Reason

Enter something like:
```
First Appeal: I urgently need this certificate for my job application.
The request has been pending and I would appreciate expedited processing.
```

Click OK/Submit.

---

### Step 6: Verify Appeal Was Created

You should see a success message. Then:

1. **Click "My Appeals"** button (red button on dashboard)
2. Now you should see:

```
┌────────────────────────────────────────────────┐
│ My Appeals (1)                                 │
├────────────────────────────────────────────────┤
│ Rugby Championship 2025                        │
│ Status: PENDING                                │
│ Appeal Created: Just now (0 days ago)         │
│                                                │
│ Your Appeal Reason:                            │
│ First Appeal: I urgently need this             │
│ certificate for my job application...          │
│                                                │
│ ⏳ Your appeal is pending admin review.       │
│ You will be notified once it's processed.     │
└────────────────────────────────────────────────┘
```

---

## 🔍 Troubleshooting

### Problem: Don't see "My Requests" button

**Solution:** Look for these buttons on the athlete dashboard:
- Blue: "Issued Certificates"
- Green: "My Requests" ← This one!
- Red: "My Appeals"
- Orange: "Track Complaint"

They should be right below the competition records section.

---

### Problem: Don't see "Raise Appeal" button in My Requests

**Possible causes:**

1. **Request is not pending**
   - Check status says "PENDING" (not "APPROVED" or "REJECTED")

2. **Not using test account**
   - Must be logged in as prasad@gmail.com
   - For other accounts, need to wait 20 days

3. **Browser cache**
   - Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or clear browser cache

---

### Problem: Still don't see the request

**Solution:** Run this script to verify:
```bash
cd /root/pramaan/backend
node check-prasad-status.js
```

If it shows "No certificate requests found", run:
```bash
cd /root/pramaan/backend
node setup-appeal-test.js
```

Then refresh your browser and try again.

---

## 📸 Visual Flow Summary

```
LOGIN (prasad@gmail.com)
    ↓
ATHLETE DASHBOARD
    ↓
Click [My Requests] (GREEN button)
    ↓
SEE: Pending Request
    ↓
Click [Raise Appeal]
    ↓
Enter Reason → Submit
    ↓
SUCCESS! Appeal Created
    ↓
Click [My Appeals] (RED button)
    ↓
SEE: Your appeal with PENDING status
```

---

## ⚡ Quick Test Commands

**Check if everything is set up:**
```bash
cd /root/pramaan/backend
node check-prasad-status.js
```

**Reset if needed:**
```bash
cd /root/pramaan/backend
node setup-appeal-test.js
```

---

## 🎯 Current Status

Based on the check:
- ✅ Athlete account exists
- ✅ Competition records exist
- ✅ Certificate request exists (PENDING)
- ⏳ No appeals yet - READY TO CREATE!

**Next action:** Click "My Requests" button (GREEN) on the athlete dashboard!

---

*If you're still having issues, please share a screenshot of what you're seeing.*
