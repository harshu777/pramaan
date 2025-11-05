import express, { Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, AuthRequest } from '../middleware/auth';
import { requirePermission, auditLog } from '../middleware/rbac';
import { query } from '../config/database-sqlite';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/documents');

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: uuid-originalname
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allowed file types
        const allowedMimes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/gif'
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, Word, Excel, and images are allowed.'));
        }
    }
});

// Upload document
router.post('/upload',
    authenticate,
    requirePermission('documents.upload'),
    upload.single('document'),
    auditLog('Upload Document', 'documents', 'document'),
    async (req: AuthRequest, res: Response) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const { filename, description, category } = req.body;
            const user = req.user;

            if (!filename) {
                // Delete uploaded file if validation fails
                fs.unlinkSync(req.file.path);
                return res.status(400).json({
                    success: false,
                    message: 'Filename is required'
                });
            }

            const documentId = uuidv4();
            const filePath = req.file.path;
            const relativePath = path.relative(path.join(__dirname, '../../'), filePath);

            // Insert document record
            await query(`
                INSERT INTO documents (
                    id, filename, original_filename, file_path, file_type,
                    file_size, mime_type, description, category,
                    uploaded_by, uploader_name, uploader_role, is_active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [
                documentId,
                filename,
                req.file.originalname,
                relativePath,
                path.extname(req.file.originalname).substring(1).toUpperCase(),
                req.file.size,
                req.file.mimetype,
                description || null,
                category || 'Other',
                user!.id,
                user!.username,
                user!.role
            ]);

            res.json({
                success: true,
                message: 'Document uploaded successfully',
                document: {
                    id: documentId,
                    filename: filename,
                    originalFilename: req.file.originalname,
                    fileType: path.extname(req.file.originalname).substring(1).toUpperCase(),
                    fileSize: req.file.size,
                    category: category || 'Other'
                }
            });

        } catch (error: any) {
            console.error('Error uploading document:', error);

            // Clean up uploaded file on error
            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({
                success: false,
                message: error.message || 'Failed to upload document'
            });
        }
    }
);

// Get all documents
router.get('/list',
    authenticate,
    requirePermission('documents.view'),
    async (req: AuthRequest, res: Response) => {
        try {
            const { category, uploaded_by } = req.query;

            let sql = `
                SELECT
                    id, filename, original_filename, file_type, file_size,
                    mime_type, description, category, uploaded_by,
                    uploader_name, uploader_role, is_active, created_at
                FROM documents
                WHERE is_active = 1
            `;

            const params: any[] = [];

            if (category && category !== 'All') {
                sql += ` AND category = ?`;
                params.push(category);
            }

            if (uploaded_by) {
                sql += ` AND uploaded_by = ?`;
                params.push(uploaded_by);
            }

            sql += ` ORDER BY created_at DESC`;

            const documents = await query(sql, params);

            res.json({
                success: true,
                documents: documents || []
            });

        } catch (error: any) {
            console.error('Error fetching documents:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch documents'
            });
        }
    }
);

// Download document
router.get('/download/:documentId',
    authenticate,
    requirePermission('documents.view'),
    async (req: AuthRequest, res: Response) => {
        try {
            const { documentId } = req.params;

            const result = await query(
                'SELECT * FROM documents WHERE id = ? AND is_active = 1',
                [documentId]
            );

            if (!result || result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Document not found'
                });
            }

            const document = result[0];
            const filePath = path.join(__dirname, '../../', document.file_path);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found on server'
                });
            }

            // Set headers for download
            res.setHeader('Content-Type', document.mime_type);
            res.setHeader('Content-Disposition', `attachment; filename="${document.original_filename}"`);

            // Stream the file
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);

        } catch (error: any) {
            console.error('Error downloading document:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to download document'
            });
        }
    }
);

// Delete document
router.delete('/:documentId',
    authenticate,
    requirePermission('documents.delete'),
    auditLog('Delete Document', 'documents', 'document'),
    async (req: AuthRequest, res: Response) => {
        try {
            const { documentId } = req.params;

            // Get document info
            const result = await query(
                'SELECT * FROM documents WHERE id = ?',
                [documentId]
            );

            if (!result || result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Document not found'
                });
            }

            const document = result[0];

            // Soft delete (mark as inactive)
            await query(
                'UPDATE documents SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [documentId]
            );

            // Optionally delete physical file (commented out for safety - soft delete preferred)
            // const filePath = path.join(__dirname, '../../', document.file_path);
            // if (fs.existsSync(filePath)) {
            //     fs.unlinkSync(filePath);
            // }

            res.json({
                success: true,
                message: 'Document deleted successfully'
            });

        } catch (error: any) {
            console.error('Error deleting document:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to delete document'
            });
        }
    }
);

// Get document statistics
router.get('/stats',
    authenticate,
    requirePermission('documents.view'),
    async (req: AuthRequest, res: Response) => {
        try {
            const stats = await query(`
                SELECT
                    COUNT(*) as total,
                    COUNT(CASE WHEN category = 'Guidelines' THEN 1 END) as guidelines,
                    COUNT(CASE WHEN category = 'Forms' THEN 1 END) as forms,
                    COUNT(CASE WHEN category = 'Policies' THEN 1 END) as policies,
                    COUNT(CASE WHEN category = 'Other' THEN 1 END) as other,
                    SUM(file_size) as total_size
                FROM documents
                WHERE is_active = 1
            `);

            res.json({
                success: true,
                stats: stats[0] || { total: 0, guidelines: 0, forms: 0, policies: 0, other: 0, total_size: 0 }
            });

        } catch (error: any) {
            console.error('Error fetching document stats:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch statistics'
            });
        }
    }
);

export default router;
