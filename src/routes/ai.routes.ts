import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { analyzeResume, chat, getChat, interviewQuestion, matchScore, readiness, skillGap, optimizeProfile } from '../controllers/ai.controller';
import { completeInterview, listInterviews, refreshInterviewToken, startInterview } from '../controllers/interviewLive.controller';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/interview/sessions', authenticate, startInterview);
router.get('/interview/sessions', authenticate, listInterviews);
router.post('/interview/sessions/:id/token', authenticate, refreshInterviewToken);
router.post('/interview/sessions/:id/complete', authenticate, completeInterview);
router.get('/chat', authenticate, getChat);
router.post('/chat', authenticate, chat);
router.get('/readiness', authenticate, readiness);
router.post('/skill-gap', authenticate, skillGap);
router.post('/match', authenticate, matchScore);
router.post('/interview-question', authenticate, interviewQuestion);
router.post('/analyze-resume', authenticate, upload.single('resume'), analyzeResume);
router.post('/optimize-profile', authenticate, optimizeProfile);

export default router;
