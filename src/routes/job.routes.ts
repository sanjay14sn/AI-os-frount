import { Router } from 'express';
import multer from 'multer';
import { getJobs, getJobById, createJob, updateJob, deleteJob } from '../controllers/job.controller';
import { searchGoogleJobs, listSavedResumes, uploadSavedResume, downloadSavedResume, deleteSavedResume } from '../controllers/googleJobs.controller';
import { authenticate, optionalAuth } from '../middleware/auth';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post('/google', authenticate, upload.single('resume'), searchGoogleJobs);
router.get('/resumes', authenticate, listSavedResumes);
router.post('/resumes', authenticate, upload.single('resume'), uploadSavedResume);
router.get('/resumes/:id/file', authenticate, downloadSavedResume);
router.delete('/resumes/:id', authenticate, deleteSavedResume);
router.get('/', optionalAuth, getJobs);
router.get('/:id', optionalAuth, getJobById);
router.post('/', optionalAuth, createJob);
router.put('/:id', optionalAuth, updateJob);
router.delete('/:id', optionalAuth, deleteJob);

export default router;
