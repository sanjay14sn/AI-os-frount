import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { PlacementDrive } from '../models/PlacementDrive';
import { Application } from '../models/Application';
import { Interview } from '../models/Interview';
import { createError } from '../middleware/errorHandler';

export const getDrives = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const mapDrive = (d: any) => ({
    ...d,
    id: d._id?.toString(),
    company: d.companyId ? { id: d.companyId._id?.toString(), name: d.companyId.name, logo: d.companyId.logo, industry: d.companyId.industry } : undefined,
    companyId: d.companyId?._id?.toString() || d.companyId,
    job: d.jobId ? { id: d.jobId._id?.toString(), title: d.jobId.title, salaryMin: d.jobId.salaryMin, salaryMax: d.jobId.salaryMax, type: d.jobId.type } : undefined,
    jobId: d.jobId?._id?.toString() || d.jobId,
  });

  try {
    const filter: Record<string, unknown> = {};
    const { status } = req.query;

    const isCampusOS = req.query.campusos === 'true' || req.query.isPlatform === 'true';

    if (isCampusOS) {
      // Fetch drives tied to platform companies or flagged as platform/CampusOS
      const platformCompanies = await mongoose.model('Company').find({
        $or: [{ isPlatform: true }, { createdByRole: 'SUPER_ADMIN' }],
      }).select('_id').lean();
      const platformCompanyIds = platformCompanies.map((c: any) => c._id);

      filter.$or = [
        { isPlatform: true },
        { isCampusOS: true },
        { companyId: { $in: platformCompanyIds } },
      ];
    } else if (req.user?.role === 'RECRUITER') {
      const companyId = req.user.tenantId;
      if (companyId && mongoose.isValidObjectId(companyId)) {
        filter.companyId = new mongoose.Types.ObjectId(companyId);
      }
    } else {
      const effectiveCollegeId =
        ((req.user?.role === 'COLLEGE_ADMIN' || req.user?.role === 'TPO') && req.user?.tenantId) ||
        (typeof req.query.collegeId === 'string' ? req.query.collegeId : undefined);

      if (effectiveCollegeId) {
        if (mongoose.isValidObjectId(effectiveCollegeId)) {
          filter.collegeId = new mongoose.Types.ObjectId(effectiveCollegeId);
        } else {
          filter.collegeId = new mongoose.Types.ObjectId('000000000000000000000000');
        }
      }
    }
    if (status) filter.status = status;

    const drives = await PlacementDrive.find(filter)
      .populate('companyId', 'name logo industry')
      .populate('jobId', 'title salaryMin salaryMax type')
      .sort({ date: 1 })
      .lean();

    res.json({ success: true, data: drives.map(mapDrive) });
  } catch (error) { next(error); }
};

export const getDriveById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw createError('Drive not found', 404);
    const drive = await PlacementDrive.findById(req.params.id)
      .populate('companyId', 'name logo industry')
      .populate('jobId', 'title salaryMin salaryMax type')
      .lean();
    if (!drive) throw createError('Drive not found', 404);
    
    const mapDrive = (d: any) => ({
      ...d,
      id: d._id?.toString(),
      company: d.companyId ? { id: d.companyId._id?.toString(), name: d.companyId.name, logo: d.companyId.logo, industry: d.companyId.industry } : undefined,
      companyId: d.companyId?._id?.toString() || d.companyId,
      job: d.jobId ? { id: d.jobId._id?.toString(), title: d.jobId.title, salaryMin: d.jobId.salaryMin, salaryMax: d.jobId.salaryMax, type: d.jobId.type } : undefined,
      jobId: d.jobId?._id?.toString() || d.jobId,
    });

    res.json({ success: true, data: mapDrive(drive) });
  } catch (error) { next(error); }
};

export const createDrive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let collegeId = req.body.collegeId;
    let companyId = req.body.companyId;

    if (req.user?.role === 'RECRUITER') {
      companyId = companyId || req.user.tenantId;
    } else if (req.user?.role === 'COLLEGE_ADMIN' || req.user?.role === 'TPO') {
      collegeId = collegeId || req.user.tenantId;
    }

    const drive = await PlacementDrive.create({
      ...req.body,
      ...(collegeId ? { collegeId } : {}),
      ...(companyId ? { companyId } : {}),
    });
    
    // Inject the frontend-provided company and job objects back into the response
    // so the UI doesn't crash when immediately rendering the new drive
    const driveData = {
      ...drive.toObject(),
      id: drive._id.toString(),
      company: req.body.company,
      job: req.body.job
    };
    
    res.status(201).json({ success: true, data: driveData, message: 'Placement drive created' });
  } catch (error) { next(error); }
};

export const deleteDrive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw createError('Drive not found', 404);
    const drive = await PlacementDrive.findById(req.params.id).select('collegeId title');
    if (!drive) throw createError('Drive not found', 404);
    if (req.user?.role !== 'SUPER_ADMIN' && String(drive.collegeId) !== req.user?.tenantId) {
      throw createError('You can only delete drives of your own college', 403);
    }

    const [applications, interviews] = await Promise.all([
      Application.deleteMany({ driveId: drive._id }),
      Interview.deleteMany({ driveId: drive._id }),
    ]);
    await drive.deleteOne();

    res.json({
      success: true,
      message: `${drive.title} deleted`,
      data: { removedApplications: applications.deletedCount, removedInterviews: interviews.deletedCount },
    });
  } catch (error) { next(error); }
};

const EDITABLE_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];

export const updateDrive = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw createError('Drive not found', 404);
    const drive = await PlacementDrive.findById(req.params.id);
    if (!drive) throw createError('Drive not found', 404);
    if (req.user?.role !== 'SUPER_ADMIN' && String(drive.collegeId) !== req.user?.tenantId) {
      throw createError('You can only edit drives of your own college', 403);
    }

    const { title, description, date, venue, status, openings, companyId, eligibility } = req.body || {};
    if (typeof title === 'string') {
      if (!title.trim()) throw createError('Drive title is required', 400);
      drive.title = title.trim();
    }
    if (typeof description === 'string') drive.description = description;
    if (typeof venue === 'string') {
      if (!venue.trim()) throw createError('Venue is required', 400);
      drive.venue = venue.trim();
    }
    if (date) {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) throw createError('Invalid drive date', 400);
      drive.date = parsed;
    }
    if (status) {
      if (!EDITABLE_STATUSES.includes(status)) throw createError('Invalid drive status', 400);
      drive.status = status;
    }
    if (openings !== undefined) {
      const n = Number(openings);
      if (!Number.isFinite(n) || n < 1) throw createError('Openings must be at least 1', 400);
      drive.openings = Math.round(n);
    }
    if (companyId) {
      if (!mongoose.isValidObjectId(companyId)) throw createError('Invalid company', 400);
      drive.companyId = new mongoose.Types.ObjectId(companyId);
    }
    if (eligibility && typeof eligibility === 'object') {
      if (eligibility.minCgpa !== undefined) drive.eligibility.minCgpa = Number(eligibility.minCgpa);
      if (Array.isArray(eligibility.branches)) {
        drive.eligibility.branches = eligibility.branches.map(String);
        drive.eligibleDepartments = eligibility.branches.map(String);
      }
    }

    await drive.save();
    const saved = await PlacementDrive.findById(drive._id)
      .populate('companyId', 'name logo industry')
      .populate('jobId', 'title salaryMin salaryMax type')
      .lean<any>();

    res.json({
      success: true,
      message: 'Drive updated',
      data: {
        ...saved,
        id: saved._id?.toString(),
        company: saved.companyId?._id ? { id: saved.companyId._id.toString(), name: saved.companyId.name, logo: saved.companyId.logo, industry: saved.companyId.industry } : undefined,
        companyId: saved.companyId?._id?.toString() || saved.companyId,
        job: saved.jobId?._id ? { id: saved.jobId._id.toString(), title: saved.jobId.title, salaryMin: saved.jobId.salaryMin, salaryMax: saved.jobId.salaryMax, type: saved.jobId.type } : undefined,
        jobId: saved.jobId?._id?.toString() || saved.jobId,
      },
    });
  } catch (error) { next(error); }
};
