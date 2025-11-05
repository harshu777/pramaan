# Application Name Change: Certificate Management System → E-Pramaan

## Change Summary

Changed the application name from "Certificate Management System" to "E-Pramaan" throughout the entire system.

## Files Updated

### Backend HTML Files (/root/pramaan/backend/public/)

1. **dashboard.html**
   - Page title: `<title>E-Pramaan Dashboard</title>` (line 6)
   - Header logo: `📜 E-Pramaan` (line 522)

2. **landing.html**
   - Page title: `<title>E-Pramaan</title>` (line 6)
   - Main heading: `🏆 E-Pramaan` (line 158)
   - Footer: `© 2024 E-Pramaan | Powered by Blockchain & IPFS` (line 213)

3. **All other HTML files** - Updated any references to "Certificate Management System"

### Public HTML Files (/root/pramaan/public/)

1. **index.html**
   - Page title: `<title>E-Pramaan</title>`
   - Main heading: `🔐 E-Pramaan`

2. **validation.html** - Updated references if any

## Commands Used

```bash
cd /root/pramaan/backend/public

# Replace in all backend HTML files
for file in *.html; do
    sed -i 's/Certificate Management System/E-Pramaan/g' "$file"
done

# Update dashboard specific title
sed -i 's/Certificate Management Dashboard/E-Pramaan Dashboard/g' dashboard.html

# Replace in public HTML files
cd /root/pramaan/public
for file in *.html; do
    sed -i 's/Certificate Management System/E-Pramaan/g' "$file"
done

# Update blockchain certificate text
sed -i 's/Blockchain Certificate Management System/E-Pramaan/g' index.html
```

## Verification

```bash
# Check no old name remains
grep -r "Certificate Management System" /root/pramaan/backend/public/*.html /root/pramaan/public/*.html
# Result: No output (all replaced)

# Verify new name is present
grep -r "E-Pramaan" /root/pramaan/backend/public/*.html | wc -l
# Result: 5+ occurrences
```

## Where Users Will See "E-Pramaan"

1. **Browser tabs** - Page titles now show "E-Pramaan" or "E-Pramaan Dashboard"
2. **Dashboard header** - Top-left logo displays "📜 E-Pramaan"
3. **Landing page** - Main heading shows "🏆 E-Pramaan"
4. **Public pages** - All public-facing pages show "E-Pramaan"
5. **Footer** - Copyright notice shows "© 2024 E-Pramaan"

## Brand Identity

**E-Pramaan** = Electronic Proof/Certificate (in Hindi/Sanskrit context)
- "E-" prefix indicates electronic/digital
- "Pramaan" means proof, certificate, or evidence
- Perfect fit for a blockchain-based certificate management system

## Status: ✅ COMPLETE

All instances of "Certificate Management System" have been replaced with "E-Pramaan".

**Updated:** November 5, 2025
**Files affected:** All HTML files in backend/public and public directories
**Server restart:** Not required (static HTML files)

## How to See Changes

Simply refresh any page:
- Admin dashboard: `http://localhost:3000/static/dashboard.html`
- Landing page: `http://localhost:3000/static/landing.html`
- Public page: Check browser tab titles

The changes are immediately visible after a simple page refresh.
