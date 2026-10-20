import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { uploadImageToCloudinary } from '../services/cloudinary.service';


const router = Router();

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ 
  storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB max for videos
});

const handleFileUpload = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const isImage = req.file.mimetype.startsWith('image/');
    let fileUrl = `/uploads/${req.file.filename}`;

    if (isImage) {
      try {
        fileUrl = await uploadImageToCloudinary(req.file.path);
        fs.unlink(req.file.path, () => undefined);
      } catch (cloudinaryErr: any) {
        console.warn('Cloudinary upload error/timeout, using local storage fallback:', cloudinaryErr?.message || cloudinaryErr);
        fileUrl = `/uploads/${req.file.filename}`;
      }
    }

    res.status(201).json({
      success: true,
      data: {
        url: fileUrl,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    });
  } catch (error) {
    if (req.file?.path) fs.unlink(req.file.path, () => undefined);
    console.error('Error in file upload:', error);
    res.status(500).json({ success: false, message: 'Failed to upload file' });
  }
};

// Public upload for onboarding registrations (Aadhar cards, KYC docs)
router.post('/public', upload.single('file'), handleFileUpload);

// Authenticated upload for logged in users
router.post('/', authenticate, upload.single('file'), handleFileUpload);

export default router;
