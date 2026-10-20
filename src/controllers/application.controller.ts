import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Application } from '../models/Application';
import { Job } from '../models/Job';
import { Student } from '../models/Student';
import { PlacementDrive, type IPlacementDrive } from '../models/PlacementDrive';
import { Company } from '../models/Company';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';

const refId = (value: any) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
};

const mapApplication = (a: any) => {
  const drive = a.driveId && typeof a.driveId === 'object' ? a.driveId : null;
  const job = a.jobId && typeof a.jobId === 'object' ? a.jobId : null;
  const company = a.companyId && typeof a.companyId === 'object' ? a.companyId : null;
  const student = a.studentId && typeof a.studentId === 'object' ? a.studentId : null;

  return {
    ...a,
    id: String(a._id),
    studentId: refId(a.studentId),
    student: student
      ? { id: refId(student), name: student.name, email: student.email, avatar: student.avatar, department: student.department, cgpa: student.cgpa, skills: student.skills }
      : undefined,
    jobId: refId(a.jobId),
    job: job
      ? { id: refId(job), title: job.title, salaryMin: job.salaryMin, salaryMax: job.salaryMax, type: job.type }
      : drive
        ? { id: refId(drive), title: drive.title }
        : undefined,
    companyId: refId(a.companyId),
    company: company
      ? { id: refId(company), name: company.name, logo: company.logo, industry: company.industry }
      : drive
        ? { id: refId(drive), name: drive.title, industry: 'Campus Drive' }
        : undefined,
    driveId: refId(a.driveId),
    matchScore: Number.isFinite(a.matchScore) ? a.matchScore : 0,
  };
};

export const getApplications = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    const { status, jobId, studentId, companyId, driveId, search } = req.query;
    const objectId = (value: unknown) =>
      new mongoose.Types.ObjectId(typeof value === 'string' && mongoose.isValidObjectId(value) ? value : '000000000000000000000000');

    if (req.user?.role === 'STUDENT') {
      const student = await Student.findOne({ userId: req.user.userId }).lean();
      if (student) filter.studentId = student._id;
    } else if (req.user?.role === 'RECRUITER') {
      // Get jobs posted by this recruiter
      const jobs = await Job.find({ recruiterId: new mongoose.Types.ObjectId(req.user.userId) }).select('_id').lean();
      filter.jobId = { $in: jobs.map(j => j._id) };
    }

    if (status) filter.status = status;
    if (jobId) filter.jobId = objectId(jobId);
    if (studentId) filter.studentId = objectId(studentId);
    if (companyId) filter.companyId = objectId(companyId);
    if (driveId) filter.driveId = objectId(driveId);

    const term = String(search || '').trim();
    if (term) {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      const [students, jobs, companies, drives] = await Promise.all([
        Student.find({ $or: [{ name: pattern }, { department: pattern }, { studentId: pattern }, { email: pattern }] }).select('_id').lean(),
        Job.find({ title: pattern }).select('_id').lean(),
        Company.find({ name: pattern }).select('_id').lean(),
        PlacementDrive.find({ title: pattern }).select('_id').lean(),
      ]);
      filter.$or = [
        { studentId: { $in: students.map(item => item._id) } },
        { jobId: { $in: jobs.map(item => item._id) } },
        { companyId: { $in: companies.map(item => item._id) } },
        { driveId: { $in: drives.map(item => item._id) } },
      ];
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Application.find(filter)
        .populate('studentId', 'name email avatar department cgpa skills')
        .populate('jobId', 'title salaryMin salaryMax type')
        .populate('companyId', 'name logo industry')
        .populate('driveId', 'title date venue')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Application.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        data: data.map(mapApplication),
        total, page, limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) { next(error); }
};

export const getApplicationById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const app = await Application.findById(req.params.id)
      .populate('studentId', 'name email avatar department cgpa skills')
      .populate('jobId', 'title salaryMin salaryMax type')
      .populate('companyId', 'name logo industry');
    if (!app) throw createError('Application not found', 404);
    res.json({ success: true, data: app });
  } catch (error) { next(error); }
};

export const applyToJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { jobId, driveId } = req.body;

    const student = await Student.findOne({ userId: req.user!.userId });
    if (!student) throw createError('Student profile not found', 404);

    let job = jobId ? await Job.findById(jobId) : null;
    let drive: IPlacementDrive | null = null;

    if (driveId) {
      drive = await PlacementDrive.findById(driveId);
      if (!drive) throw createError('Drive not found', 404);
      if (drive.status === 'completed' || drive.status === 'cancelled') {
        throw createError('This drive is no longer accepting registrations', 400);
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(drive.endDate || drive.date) < today) {
        throw createError('Registration for this drive has closed', 400);
      }
      if (!job && drive.jobId && mongoose.isValidObjectId(drive.jobId)) {
        job = await Job.findById(drive.jobId);
      }
    }

    if (drive && !job) {
      let companyId = drive.companyId;
      if (!companyId || !mongoose.isValidObjectId(companyId)) {
        const company = await Company.create({
          name: drive.title,
          industry: 'Campus Drive',
          hq: drive.venue || 'Campus',
          description: drive.description || '',
          colleges: drive.collegeId ? [drive.collegeId] : [],
        });
        companyId = company._id;
        drive.companyId = company._id;
      }

      const recruiter = await User.findOne({ role: 'RECRUITER' }).select('_id');
      job = await Job.create({
        companyId,
        recruiterId: recruiter?._id || req.user!.userId,
        title: drive.title,
        description: drive.description || '',
        location: drive.venue || 'Campus',
        salaryMin: 0,
        salaryMax: 0,
        status: 'active',
        eligibility: {
          minCgpa: drive.eligibility?.minCgpa ?? 0,
          maxBacklogs: drive.eligibility?.maxBacklogs ?? 99,
          branches: drive.eligibility?.branches || [],
          degree: drive.eligibility?.degree || [],
          graduationYear: drive.eligibility?.graduationYear || [],
        },
        applicationDeadline: drive.endDate || drive.date || new Date(),
        driveDate: drive.date,
        collegeIds: drive.collegeId ? [drive.collegeId] : [],
        openings: drive.openings || 1,
      });
      drive.jobId = job._id;
      await drive.save();
    }

    if (!job) throw createError('Job not found', 404);

    if (!drive) {
      if (job.status !== 'active') throw createError('This job is not accepting applications', 400);
      if (new Date() > job.applicationDeadline) throw createError('Application deadline has passed', 400);
    }

    if (student.cgpa < (job.eligibility?.minCgpa ?? 0)) {
      throw createError(`Minimum CGPA ${job.eligibility?.minCgpa ?? 0} required`, 400);
    }
    if (student.backlogs > (job.eligibility?.maxBacklogs ?? 99)) {
      throw createError(`Maximum ${job.eligibility?.maxBacklogs ?? 0} backlogs allowed`, 400);
    }

    const existing = await Application.findOne({ studentId: student._id, jobId: job._id });
    if (existing) throw createError('You have already applied for this drive', 400);

    const application = await Application.create({
      studentId: student._id,
      jobId: job._id,
      companyId: job.companyId,
      driveId: drive?._id,
      status: 'applied',
      currentStage: 'Application Submitted',
      timeline: [{ stage: 'Application Submitted', status: 'current', date: new Date() }],
      isShortlisted: false,
    });

    await Job.findByIdAndUpdate(job._id, { $inc: { 'stats.applied': 1 } });
    if (drive) {
      await PlacementDrive.findByIdAndUpdate(drive._id, { $inc: { 'stats.registered': 1, 'stats.applied': 1 } });
    }

    res.status(201).json({
      success: true,
      data: application,
      message: 'Application submitted successfully!',
    });
  } catch (error) { next(error); }
};

export const updateApplicationStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, recruiterNotes } = req.body;
    const app = await Application.findById(req.params.id);
    if (!app) throw createError('Application not found', 404);

    if (req.user?.role === 'STUDENT') {
      const student = await Student.findOne({ userId: req.user.userId }).select('_id').lean();
      if (!student || String(app.studentId) !== String(student._id) || status !== 'withdrawn') {
        throw createError('Students can only withdraw their own applications', 403);
      }
    }

    app.status = status;
    if (recruiterNotes) app.recruiterNotes = recruiterNotes;

    app.timeline.push({
      stage: status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      status: ['rejected', 'withdrawn'].includes(status) ? 'failed' : 'current',
      date: new Date(),
    });

    await app.save();
    res.json({ success: true, data: app, message: 'Application status updated' });
  } catch (error) { next(error); }
};
