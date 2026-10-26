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

    const conditions: Record<string, unknown>[] = [];
    const effectiveCollegeId =
      (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId) ||
      (typeof req.query.collegeId === 'string' ? req.query.collegeId : undefined);

    if (req.user?.role === 'STUDENT') {
      const student = await Student.findOne({ userId: req.user.userId }).lean();
      if (student) filter.studentId = student._id;
      else filter.studentId = new mongoose.Types.ObjectId('000000000000000000000000');
    } else if (req.user?.role === 'RECRUITER') {
      const companyId = req.user.tenantId;
      const recruiterJobs = await Job.find({
        $or: [
          { recruiterId: new mongoose.Types.ObjectId(req.user.userId) },
          ...(companyId && mongoose.isValidObjectId(companyId) ? [{ companyId: new mongoose.Types.ObjectId(companyId) }] : [])
        ]
      }).select('_id').lean();
      const jobIds = recruiterJobs.map(j => j._id);

      const recruiterConditions: Record<string, unknown>[] = [];
      if (jobIds.length > 0) {
        recruiterConditions.push({ jobId: { $in: jobIds } });
      }
      if (companyId && mongoose.isValidObjectId(companyId)) {
        recruiterConditions.push({ companyId: new mongoose.Types.ObjectId(companyId) });
      }
      if (recruiterConditions.length > 0) {
        conditions.push({ $or: recruiterConditions });
      }
    } else if (effectiveCollegeId) {
      if (mongoose.isValidObjectId(effectiveCollegeId)) {
        const collegeObjId = new mongoose.Types.ObjectId(effectiveCollegeId);
        const [students, drives] = await Promise.all([
          Student.find({ collegeId: collegeObjId }).select('_id').lean(),
          PlacementDrive.find({ collegeId: collegeObjId }).select('_id').lean(),
        ]);
        const studentIds = students.map(s => s._id);
        const driveIds = drives.map(d => d._id);
        conditions.push({
          $or: [
            { studentId: { $in: studentIds } },
            { driveId: { $in: driveIds } },
          ],
        });
      } else {
        conditions.push({ studentId: new mongoose.Types.ObjectId('000000000000000000000000') });
      }
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
      conditions.push({
        $or: [
          { studentId: { $in: students.map(item => item._id) } },
          { jobId: { $in: jobs.map(item => item._id) } },
          { companyId: { $in: companies.map(item => item._id) } },
          { driveId: { $in: drives.map(item => item._id) } },
        ],
      });
    }

    if (conditions.length === 1) {
      Object.assign(filter, conditions[0]);
    } else if (conditions.length > 1) {
      filter.$and = conditions;
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
    const { jobId, driveId, studentId, status } = req.body;

    let student: any = null;
    if (studentId && mongoose.isValidObjectId(studentId)) {
      student = await Student.findById(studentId);
    }
    if (!student && req.user?.userId) {
      student = await Student.findOne({ userId: req.user.userId });
    }
    if (!student) throw createError('Student profile not found', 404);

    let job: any = jobId && mongoose.isValidObjectId(jobId) ? await Job.findById(jobId) : null;
    let drive: IPlacementDrive | null = null;

    if (driveId && mongoose.isValidObjectId(driveId)) {
      drive = await PlacementDrive.findById(driveId);
      if (!job && drive?.jobId && mongoose.isValidObjectId(drive.jobId)) {
        job = await Job.findById(drive.jobId);
      }
    }

    const isRecruiter = req.user?.role === 'RECRUITER';

    // If recruiter is shortlisting and no job was specified, find or create default job for their company
    if (!job && isRecruiter) {
      const companyId = req.user?.tenantId && mongoose.isValidObjectId(req.user.tenantId)
        ? req.user.tenantId
        : undefined;

      if (companyId) {
        job = await Job.findOne({ companyId, status: 'active' }) || await Job.findOne({ companyId });
      }

      if (!job) {
        let resolvedCompanyId = companyId;
        if (!resolvedCompanyId) {
          const comp: any = await Company.findOne().select('_id').lean();
          resolvedCompanyId = comp?._id?.toString() || new mongoose.Types.ObjectId().toString();
        }

        const recruiterUserId = req.user?.userId || new mongoose.Types.ObjectId().toString();
        job = await Job.create({
          companyId: new mongoose.Types.ObjectId(resolvedCompanyId),
          recruiterId: new mongoose.Types.ObjectId(recruiterUserId),
          title: 'Software Engineer Graduate 2025',
          description: 'Campus recruitment role',
          location: 'Bengaluru',
          salaryMin: 8,
          salaryMax: 14,
          status: 'active',
          openings: 10,
          applicationDeadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
          eligibility: { minCgpa: 6.0, maxBacklogs: 0, branches: ['CSE', 'ISE', 'ECE'], degree: ['B.E.'], graduationYear: [2025] }
        });
      }
    }

    if (!job && drive) {
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

    const initialStatus = status || (isRecruiter ? 'shortlisted' : 'applied');
    const isShortlisted = initialStatus === 'shortlisted' || req.body.isShortlisted === true;

    // Check if application already exists
    let application = await Application.findOne({ studentId: student._id, jobId: job._id });
    if (application) {
      if (isRecruiter) {
        application.status = 'shortlisted';
        application.isShortlisted = true;
        application.currentStage = 'Shortlisted';
        await application.save();
        const populated = await Application.findById(application._id)
          .populate('studentId', 'name email avatar department cgpa skills')
          .populate('jobId', 'title salaryMin salaryMax type')
          .populate('companyId', 'name logo industry')
          .lean();
        res.json({ success: true, data: mapApplication(populated || application), message: 'Candidate shortlisted' });
        return;
      } else {
        throw createError('You have already applied for this job', 400);
      }
    }

    application = await Application.create({
      studentId: student._id,
      jobId: job._id,
      companyId: job.companyId,
      driveId: drive?._id,
      status: initialStatus,
      currentStage: isShortlisted ? 'Shortlisted' : 'Application Submitted',
      timeline: [
        { stage: 'Application Submitted', status: 'completed', date: new Date() },
        ...(isShortlisted ? [{ stage: 'Shortlisted', status: 'current', date: new Date() }] : [])
      ],
      isShortlisted,
      matchScore: req.body.matchScore || Math.min(99, Math.round(75 + (student.cgpa || 7) * 2.5)),
    });

    await Job.findByIdAndUpdate(job._id, { $inc: { 'stats.applied': 1 } });
    if (drive) {
      await PlacementDrive.findByIdAndUpdate(drive._id, { $inc: { 'stats.registered': 1, 'stats.applied': 1 } });
    }

    const populated = await Application.findById(application._id)
      .populate('studentId', 'name email avatar department cgpa skills')
      .populate('jobId', 'title salaryMin salaryMax type')
      .populate('companyId', 'name logo industry')
      .lean();

    res.status(201).json({
      success: true,
      data: mapApplication(populated || application),
      message: isShortlisted ? 'Candidate shortlisted successfully!' : 'Application submitted successfully!',
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
