import { Router } from 'express';
import { getCompanies, getCompanyById, createCompany, updateCompany, toggleCompanyStatus, toggleTiedStatus, deleteCompany } from '../controllers/company.controller';

const router = Router();

router.get('/', getCompanies);
router.post('/', createCompany);
router.get('/:id', getCompanyById);
router.put('/:id', updateCompany);
router.patch('/:id/toggle-status', toggleCompanyStatus);
router.patch('/:id/toggle-tied', toggleTiedStatus);
router.delete('/:id', deleteCompany);

export default router;

