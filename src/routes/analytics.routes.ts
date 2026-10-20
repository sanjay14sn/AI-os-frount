import { Router } from 'express';
import { getCollegeAnalytics, getPlatformStats, getPlatformCharts } from '../controllers/analytics.controller';

const router = Router();

router.get('/college/:collegeId', getCollegeAnalytics);
router.get('/college', getCollegeAnalytics);
router.get('/platform/charts', getPlatformCharts);
router.get('/platform', getPlatformStats);

export default router;
