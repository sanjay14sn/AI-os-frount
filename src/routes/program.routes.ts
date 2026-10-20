import { Router } from 'express';
import {
  getAllPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
  togglePublishProgram,
} from '../controllers/program.controller';

const router = Router();

router.get('/', getAllPrograms);
router.get('/:id', getProgramById);
router.post('/', createProgram);
router.put('/:id', updateProgram);
router.delete('/:id', deleteProgram);
router.patch('/:id/publish', togglePublishProgram);

export default router;
