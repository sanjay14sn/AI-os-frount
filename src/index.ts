import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import path from 'path';
import { connectDB } from './config/db';
import { env } from './config/env';
import { errorHandler, notFound } from './middleware/errorHandler';

// ─── Route Imports ────────────────────────────────────────────────────────────
import authRoutes from './routes/auth.routes';
import studentRoutes from './routes/student.routes';
import jobRoutes from './routes/job.routes';
import applicationRoutes from './routes/application.routes';
import interviewRoutes from './routes/interview.routes';
import companyRoutes from './routes/company.routes';
import collegeRoutes from './routes/college.routes';
import departmentRoutes from './routes/department.routes';
import driveRoutes from './routes/drive.routes';
import notificationRoutes from './routes/notification.routes';
import analyticsRoutes from './routes/analytics.routes';
import programRoutes from './routes/program.routes';
import announcementRoutes from './routes/announcement.routes';
import uploadRoutes from './routes/upload.routes';
import atsRoutes from './routes/ats.routes';
import recruiterRoutes from './routes/recruiter.routes';
import userRoutes from './routes/user.routes';
import communityRoutes from './routes/community.routes';
import aiRoutes from './routes/ai.routes';

// ─── App Init ─────────────────────────────────────────────────────────────────
const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or server-to-server) or any frontend origin
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 204,
}));
app.options('*', cors());

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const globalRateLimit = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  message: { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalRateLimit);

// ─── Parsing Middleware ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (env.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    service: 'AI PlacementOS API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/colleges', collegeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/drives', driveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/ats', atsRoutes);
app.use('/api/recruiter', recruiterRoutes);
app.use('/api/users', userRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/ai', aiRoutes);

// ─── 404 & Error Handling ─────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

import http from 'http';
import { initSocket } from './config/socket';

// ─── Start Server ─────────────────────────────────────────────────────────────
const start = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
    initSocket(server);

    server.listen(env.port, () => {
      console.log('');
      console.log('╔═══════════════════════════════════════════════╗');
      console.log('║     🚀  AI PlacementOS API  —  Running        ║');
      console.log('╠═══════════════════════════════════════════════╣');
      console.log(`║  Port    : http://localhost:${env.port}              ║`);
      console.log(`║  Mode    : ${env.nodeEnv.padEnd(35)}║`);
      console.log(`║  Health  : http://localhost:${env.port}/api/health   ║`);
      console.log('╚═══════════════════════════════════════════════╝');
      console.log('');
      console.log('  API Routes:');
      console.log('  POST   /api/auth/login');
      console.log('  POST   /api/auth/register/student');
      console.log('  POST   /api/auth/register/college');
      console.log('  POST   /api/auth/verify-otp');
      console.log('  GET    /api/students');
      console.log('  GET    /api/jobs');
      console.log('  GET    /api/applications');
      console.log('  GET    /api/interviews');
      console.log('  GET    /api/companies');
      console.log('  GET    /api/colleges');
      console.log('  GET    /api/analytics/college');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received. Shutting down...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] Unhandled Rejection:', reason);
  process.exit(1);
});

start();

export default app;
