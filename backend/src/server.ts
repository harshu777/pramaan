import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import certificateRoutes from './routes/certificateRoutes';
import issuerRoutes from './routes/issuerRoutes';
import athleteRoutes from './routes/athleteRoutes';
import bulkUploadRoutes from './routes/bulkUploadRoutes';
import testEmailRoute from './routes/testEmailRoute';
import complaintRoutes from './routes/complaintRoutes';
import quotaCertificateRoutes from './routes/quotaCertificateRoutes';
import appealRoutes from './routes/appealRoutes';
import { initializeDatabase } from './config/database-sqlite';
import { initializeBlockchain } from './services/blockchainService';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later.'
});

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors());
app.use(compression());
// Increase payload size limit to 50MB for PDF uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(limiter);

app.use('/static', express.static('public'));

// Root route - redirect to login
app.get('/', (req, res) => {
  res.redirect('/static/login.html');
});

app.use('/api/certificates', certificateRoutes);
app.use('/api/issuers', issuerRoutes);
app.use('/api/athletes', athleteRoutes);
app.use('/api/bulk-upload', bulkUploadRoutes);
app.use('/api/test', testEmailRoute);
app.use('/api/complaints', complaintRoutes);
app.use('/api/quota-certificates', quotaCertificateRoutes);
app.use('/api/appeals', appealRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

async function startServer() {
  try {
    await initializeDatabase();
    logger.info('Database connected successfully');

    await initializeBlockchain();
    logger.info('Blockchain service initialized');

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;