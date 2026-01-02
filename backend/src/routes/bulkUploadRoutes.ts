import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { bulkUploadService } from '../services/bulkUploadService';
import { asyncHandler } from '../middleware/asyncHandler';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `bulk-upload-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Validate Excel file
router.post('/validate',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;

    try {
      const validation = await bulkUploadService.validateExcelFile(filePath);

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json({
        success: true,
        validation
      });
    } catch (error) {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      throw error;
    }
  })
);

// Process bulk upload
router.post('/process',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;

    // Extract issuer data from request body
    const {
      issuerDid,
      issuerName,
      certificateType,
      expiryDate
    } = req.body;

    if (!issuerDid || !issuerName || !certificateType) {
      // Clean up uploaded file
      fs.unlinkSync(filePath);

      return res.status(400).json({
        success: false,
        message: 'Missing required fields: issuerDid, issuerName, certificateType'
      });
    }

    try {
      // First validate the file
      const validation = await bulkUploadService.validateExcelFile(filePath);

      if (!validation.isValid) {
        // Clean up uploaded file
        fs.unlinkSync(filePath);

        return res.status(400).json({
          success: false,
          message: 'Invalid Excel file',
          errors: validation.errors
        });
      }

      // Process the bulk upload
      const result = await bulkUploadService.processExcelFile(filePath, {
        issuerDid,
        issuerName,
        certificateType,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined
      });

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json({
        success: true,
        message: `Processed ${result.totalProcessed} certificates`,
        data: result
      });
    } catch (error) {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      logger.error('Bulk upload processing error:', error);
      throw error;
    }
  })
);

// Download bulk upload template
router.get('/template',
  asyncHandler(async (req: Request, res: Response) => {
    const templatePath = path.join(__dirname, '../../templates/bulk-upload-template.xlsx');

    // Check if template exists, if not create it
    if (!fs.existsSync(templatePath)) {
      // Create a sample template
      const XLSX = require('xlsx');
      const wb = XLSX.utils.book_new();

      const templateData = [
        {
          'Name of the Sports Person': 'John Doe',
          'Son/Daughter/Wife of': 'James Doe',
          'Date of Birth': '01/01/1990',
          'Resident of District': 'Mumbai',
          'Representing (District/Division/State/Country)': 'Mumbai / Maharashtra / India',
          'Name of the Game': 'Kho Kho',
          'Name of the Competition': 'National Championship',
          'Period of the Competition': '01/01/2024 - 05/01/2024',
          'Competition Held at': 'Mumbai Stadium',
          'Competition Level (State/National/International)': 'National',
          'Position Obtained': '1st',
          'Certificate No.': 'CERT-001',
          'Applicable Government Resolution': 'GR-123/2024'
        }
      ];

      const ws = XLSX.utils.json_to_sheet(templateData);
      XLSX.utils.book_append_sheet(wb, ws, 'Certificates');

      // Create templates directory if it doesn't exist
      const templatesDir = path.dirname(templatePath);
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
      }

      XLSX.writeFile(wb, templatePath);
    }

    res.download(templatePath, 'bulk-upload-template.xlsx');
  })
);

// Get bulk upload status
router.get('/status/:uploadId',
  asyncHandler(async (req: Request, res: Response) => {
    const { uploadId } = req.params;

    // This would typically fetch from a database or cache
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Upload status feature coming soon',
      uploadId
    });
  })
);

export default router;