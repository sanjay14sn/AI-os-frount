import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Interview } from '../models/Interview';
import { Student } from '../models/Student';
import { Application } from '../models/Application';
import { createError } from '../middleware/errorHandler';

export const getInterviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    const { status, date, studentId } = req.query;

    if (req.user?.role === 'STUDENT') {
      const student = await Student.findOne({ userId: req.user.userId }).lean();
      if (student) filter.studentId = student._id;
    } else if (req.user?.role === 'RECRUITER') {
      filter.recruiterId = new mongoose.Types.ObjectId(req.user.userId);
    }

    if (status) filter.status = status;
    if (date) filter.date = { $gte: new Date(date as string), $lt: new Date(new Date(date as string).getTime() + 86400000) };
    if (studentId) filter.studentId = new mongoose.Types.ObjectId(studentId as string);

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      Interview.find(filter)
        .populate('studentId', 'name email avatar department cgpa')
        .populate('jobId', 'title')
        .populate('companyId', 'name logo')
        .populate('driveId', 'title')
        .sort({ date: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Interview.countDocuments(filter),
    ]);

    const mapInterview = (i: any) => ({
      ...i,
      id: i._id?.toString(),
      student: i.studentId ? { id: i.studentId._id?.toString(), name: i.studentId.name, email: i.studentId.email, avatar: i.studentId.avatar, department: i.studentId.department, cgpa: i.studentId.cgpa } : undefined,
      studentId: i.studentId?._id?.toString() || i.studentId,
      company: i.companyId
        ? { id: i.companyId._id?.toString(), name: i.companyId.name, logo: i.companyId.logo }
        : i.driveId?.title ? { id: i.driveId._id?.toString(), name: i.driveId.title } : undefined,
      companyId: i.companyId?._id?.toString() || i.companyId,
      driveId: i.driveId?._id?.toString() || i.driveId,
      applicationId: i.applicationId?.toString(),
      job: i.jobId ? { id: i.jobId._id?.toString(), title: i.jobId.title } : undefined,
      jobId: i.jobId?._id?.toString() || i.jobId,
    });

    res.json({
      success: true,
      data: { data: data.map(mapInterview), total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

export const scheduleInterview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role === 'STUDENT') throw createError('Students cannot schedule interviews', 403);

    const interviewData: any = {
      ...req.body,
    };

    if (interviewData.applicationId) {
      const application = await Application.findById(interviewData.applicationId).lean();
      if (!application) throw createError('Application not found', 404);
      interviewData.studentId = application.studentId;
      interviewData.jobId = application.jobId;
      interviewData.companyId = application.companyId || interviewData.companyId;
      interviewData.driveId = application.driveId || interviewData.driveId;
    }

    if (req.user?.userId) {
      interviewData.recruiterId = new mongoose.Types.ObjectId(req.user.userId);
    }

    const interview = await Interview.create(interviewData);
    
    const responseData = {
      ...interview.toObject(),
      id: interview._id.toString(),
      student: req.body.student,
      company: req.body.company
    };

    res.status(201).json({ success: true, data: responseData, message: 'Interview scheduled successfully' });
  } catch (error) { next(error); }
};

export const updateInterviewStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) throw createError('Interview not found', 404);
    interview.status = req.body.status;
    await interview.save();
    res.json({ success: true, data: interview });
  } catch (error) { next(error); }
};

export const submitFeedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) throw createError('Interview not found', 404);
    interview.feedback = req.body.feedback;
    interview.status = 'completed';
    await interview.save();
    res.json({ success: true, data: interview, message: 'Feedback submitted' });
  } catch (error) { next(error); }
};

export const checkConflicts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { studentId, date, time } = req.query;
    const conflict = await Interview.findOne({
      studentId: new mongoose.Types.ObjectId(studentId as string),
      date: new Date(date as string),
      time: time as string,
      status: { $in: ['scheduled', 'confirmed'] },
    });
    res.json({ success: true, data: { hasConflict: !!conflict, conflictingInterview: conflict || null } });
  } catch (error) { next(error); }
};
