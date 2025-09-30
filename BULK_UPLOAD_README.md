# Bulk Certificate Upload System

## Overview

The bulk upload system allows administrators to issue multiple certificates simultaneously by uploading an Excel file with recipient information. Each certificate is:
- Generated as a PDF matching the Maharashtra State Sports Certificate template
- Stored on IPFS for permanent, tamper-proof storage
- Anchored on blockchain for verification
- Automatically emailed to recipients
- Made searchable and verifiable through public portal

## Features

### 1. Bulk Upload System
- **Excel Upload**: Upload .xlsx or .xls files with multiple certificate recipients
- **Template Generation**: Automatic PDF generation using predefined certificate template
- **Email Delivery**: Automatic email delivery to recipients with PDF attachment
- **Progress Tracking**: Real-time upload progress and results display
- **Validation**: Pre-upload validation to catch errors before processing

### 2. Public Validation Portal
- **Certificate Search**: Search by name, issuer, or certificate type
- **Hash Validation**: Direct validation using certificate hash
- **QR Code Support**: Validate certificates using QR codes
- **Full Details View**: View complete certificate details and metadata
- **Download Option**: Download certificates as PDF or JSON

### 3. Certificate Features
- **Blockchain Anchoring**: Each certificate hash is stored on blockchain
- **IPFS Storage**: Permanent storage on distributed file system
- **QR Code Generation**: Each certificate includes a QR code for quick validation
- **Email Notifications**: Automatic email delivery with validation link

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure:

```env
# Email Configuration (for sending certificates)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-app-specific-password  # Generate from Google Account settings

# Or use test email (development only)
# Leave EMAIL_SERVICE empty to use test account

# Public URL for QR codes
QR_BASE_URL=http://localhost:3000
```

### 3. Start the Server
```bash
npm run dev
```
Server will start at http://localhost:3000

## Using the Bulk Upload System

### Step 1: Prepare Excel File
Download the template from: http://localhost:3000/api/bulk-upload/template

Excel columns:
- **Name**: Recipient's full name (Required)
- **Father Name**: Father/Guardian name
- **DOB**: Date of birth
- **District**: Resident district
- **Game Name**: Sport/Game name
- **Competition Period**: Competition date range
- **Competition Name**: Name of competition
- **Competition Held At**: Venue
- **Competition Level**: STATE/NATIONAL/INTERNATIONAL
- **Certificate No**: Unique certificate number
- **Representing District**: District represented
- **Division/State/Country**: Division/State/Country
- **Position Obtained**: Position/Rank achieved
- **Valid For Employment Group**: Employment group validity
- **Applicable Govt Resolutions**: Government resolution references
- **Email**: Recipient's email address (for automatic delivery)

### Step 2: Access Bulk Upload Page
Navigate to: http://localhost:3000/static/bulk-upload.html

### Step 3: Fill Issuer Information
- **Issuer DID**: Decentralized identifier (e.g., did:example:123)
- **Issuer Name**: Organization name
- **Certificate Type**: Type of certificate
- **Expiry Date**: Optional expiry date

### Step 4: Upload and Process
1. Click "Validate File" to check for errors
2. Review validation results
3. Click "Process Upload" to issue certificates
4. Monitor progress and results

### Step 5: Email Delivery
Certificates are automatically emailed to recipients with:
- PDF attachment of the certificate
- Validation link
- QR code for verification
- Certificate hash for blockchain verification

## Public Validation Portal

### Access the Portal
Navigate to: http://localhost:3000/static/validation.html

### Validation Methods

#### 1. By Certificate Hash
- Enter the certificate hash
- Click "Validate"
- View full certificate details

#### 2. Search Certificates
- Enter recipient name, issuer, or certificate type
- Browse search results
- Click on any certificate to validate

#### 3. QR Code Scan
- Upload QR code image
- Automatic extraction and validation

### Validation Results Include
- Certificate status (Valid/Expired/Revoked)
- Subject and issuer details
- Issue and expiry dates
- Blockchain verification status
- IPFS verification status
- Metadata (competition details, position, etc.)
- Download options (PDF/JSON)

## API Endpoints

### Bulk Upload
- `POST /api/bulk-upload/validate` - Validate Excel file
- `POST /api/bulk-upload/process` - Process bulk upload
- `GET /api/bulk-upload/template` - Download Excel template

### Certificate Operations
- `POST /api/certificates/issue` - Issue single certificate
- `GET /api/certificates/search?q=query` - Search certificates
- `GET /api/certificates/validate/:hash` - Validate by hash (JSON)
- `GET /api/certificates/verify/:hash` - Validate by hash (HTML)
- `GET /api/certificates/download/:hash` - Download certificate
- `GET /api/certificates/qr/:hash` - Get QR code

## Testing the System

### Test Email Configuration
The system uses Ethereal Email for testing when no email service is configured:
1. Check console logs for test email credentials
2. Visit https://ethereal.email/messages
3. Login with provided credentials to view sent emails

### Test Bulk Upload
1. Use the provided template with sample data
2. Add test email addresses
3. Upload and process
4. Check results and email delivery

### Test Validation
1. Copy a certificate hash from issued certificates
2. Visit validation portal
3. Test all three validation methods
4. Verify download functionality

## Security Considerations

### Email Security
- Use app-specific passwords for Gmail
- Never commit credentials to version control
- Use environment variables for sensitive data

### Certificate Security
- Certificates are hashed using SHA-256
- Hashes are stored on blockchain
- Original data stored on IPFS
- QR codes point to validation endpoints

### Access Control
- Admin functions require authentication
- Public validation is read-only
- Rate limiting prevents abuse

## Troubleshooting

### Email Not Sending
1. Check EMAIL_SERVICE configuration
2. For Gmail: Enable 2FA and generate app password
3. Check console for Ethereal test account details

### Excel Upload Errors
1. Ensure Excel format matches template
2. Check for required fields (Name)
3. Validate email addresses format
4. Check file size (< 10MB)

### Blockchain Errors
- Blockchain connection is optional
- System continues without blockchain if not configured
- Check BLOCKCHAIN_RPC and PRIVATE_KEY in .env

### IPFS Errors
- Uses mock storage in development
- Configure Pinata or Web3.Storage for production
- Check IPFS_SERVICE configuration

## Production Deployment

### Prerequisites
1. PostgreSQL database
2. Blockchain node (Ethereum/Polygon)
3. IPFS service (Pinata/Web3.Storage)
4. SMTP service for emails

### Configuration
1. Set NODE_ENV=production
2. Configure all services in .env
3. Deploy smart contract
4. Set CONTRACT_ADDRESS
5. Configure proper QR_BASE_URL

### Deployment Steps
```bash
# Build the application
npm run build

# Start with PM2
pm2 start dist/server.js --name cert-management

# Or use Docker
docker-compose up -d
```

## Support

For issues or questions:
1. Check error logs in console
2. Verify .env configuration
3. Test with sample data first
4. Check network connectivity

## License

This system is provided as-is for educational and development purposes.