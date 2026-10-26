import { Router } from 'express';
import { getCompanies, getCompanyById, createCompany, updateCompany, toggleCompanyStatus, toggleTiedStatus, deleteCompany } from '../controllers/company.controller';
import { optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/', optionalAuth, getCompanies);
router.post('/', optionalAuth, createCompany);
router.get('/:id', optionalAuth, getCompanyById);
router.put('/:id', optionalAuth, updateCompany);
router.patch('/:id/toggle-status', optionalAuth, toggleCompanyStatus);
router.patch('/:id/toggle-tied', optionalAuth, toggleTiedStatus);
router.delete('/:id', optionalAuth, deleteCompany);

export default router;

