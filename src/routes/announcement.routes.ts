import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePin,
  toggleLike,
  incrementViews
} from '../controllers/announcement.controller';

const router = Router();

router.use(authenticate);

router.get('/', getAnnouncements);
router.get('/:id', getAnnouncementById);
router.post('/', createAnnouncement);
router.put('/:id', updateAnnouncement);
router.delete('/:id', deleteAnnouncement);
router.patch('/:id/pin', togglePin);
router.patch('/:id/like', toggleLike);
router.patch('/:id/view', incrementViews);

export default router;
