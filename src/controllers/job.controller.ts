import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Job } from '../models/Job';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';

export const createJobSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  type: z.enum(['fulltime', 'internship', 'contract', 'parttime']).default('fulltime'),
  location: z.string().min(1),
  isRemote: z.boolean().default(false),
  salaryMin: z.number().min(0),
  salaryMax: z.number().min(0),
  experience: z.string().default('Fresher'),
  openings: z.number().min(1).default(1),
  eligibility: z.object({
    minCgpa: z.number().min(0).max(10).default(6.0),
    maxBacklogs: z.number().min(0).default(0),
    branches: z.array(z.string()),
    degree: z.array(z.string()),
    graduationYear: z.array(z.number()),
  }),
  skills: z.array(z.string()).optional(),
  niceToHave: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  applicationDeadline: z.string().transform(v => new Date(v)),
  driveDate: z.string().transform(v => new Date(v)).optional(),
  collegeIds: z.array(z.string()).optional(),
  pipeline: z.array(z.any()).optional(),
});

export const getJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    const { search, status, type, location } = req.query;

    if (req.user?.role === 'STUDENT') {
      filter.status = 'active';
    } else if (status) {
      filter.status = status;
    }

    if (type) filter.type = type;
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (search) {
      filter['$or'] = [
        { title: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by college for college-scoped users
    if (req.user?.tenantId && req.user.role !== 'SUPER_ADMIN') {
      filter.collegeIds = new mongoose.Types.ObjectId(req.user.tenantId);
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Job.find(filter)
        .populate('companyId', 'name logo industry hq')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        data: data.map(j => {
          const populated = j.companyId && typeof j.companyId === 'object' ? j.companyId : null;
          const company = populated && 'name' in populated
            ? populated
            : { _id: j._id, name: j.title || 'Company', industry: 'Campus Drive', hq: j.location || '', logo: '' };
          return { ...j, id: j._id.toString(), companyId: populated?._id || j.companyId, company };
        }),
        total, page, limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) { next(error); }
};

export const getJobById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id).populate('companyId', 'name logo industry hq');
    if (!job) throw createError('Job not found', 404);
    res.json({ success: true, data: job });
  } catch (error) { next(error); }
};

export const createJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data = req.body;
    const job = await Job.create({
      ...data,
      recruiterId: new mongoose.Types.ObjectId(req.user!.userId),
      stats: { eligible: 0, applied: 0, shortlisted: 0, interviewed: 0, selected: 0 },
    });
    res.status(201).json({ success: true, data: job, message: 'Job created successfully' });
  } catch (error) { next(error); }
};

export const updateJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) throw createError('Job not found', 404);
    Object.assign(job, req.body);
    await job.save();
    res.json({ success: true, data: job, message: 'Job updated' });
  } catch (error) { next(error); }
};

export const deleteJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, { status: 'closed' }, { new: true });
    if (!job) throw createError('Job not found', 404);
    res.json({ success: true, message: 'Job closed successfully' });
  } catch (error) { next(error); }
};
