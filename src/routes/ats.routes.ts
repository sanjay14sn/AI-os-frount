import express from 'express';
import multer from 'multer';
import { parseResume } from '../services/affinda.service';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

router.post('/parse-resume', upload.single('resume'), async (req, res): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Resume file is required',
      });
    }

    const result = await parseResume(req.file);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error(
      'Affinda error:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: 'Resume parsing failed',
      error: error.response?.data || error.message,
    });
  }
});

export default router;
