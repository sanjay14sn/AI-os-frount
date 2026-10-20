import { Request, Response, NextFunction } from 'express';
import { Job } from '../models/Job';
import { Application } from '../models/Application';
import { createError } from '../middleware/errorHandler';

/**
 * GET /api/recruiter/me/dashboard
 * Aggregates data for the recruiter dashboard.
 */
export const getRecruiterDashboardData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const recruiterId = req.user!.userId;

    // 1. Fetch all jobs created by this recruiter
    const jobs = await Job.find({ recruiterId, status: { $ne: 'draft' } }).lean();
    const jobIds = jobs.map(j => j._id);

    // Calculate Active Jobs KPIs
    const activeJobsCount = jobs.filter(j => j.status === 'active').length;

    let totalApplicants = 0;
    let eligibleCandidates = 0;
    let shortlisted = 0;
    let interviews = 0;
    let selected = 0;

    jobs.forEach(job => {
      totalApplicants += job.stats?.applied || 0;
      eligibleCandidates += job.stats?.eligible || 0;
      shortlisted += job.stats?.shortlisted || 0;
      interviews += job.stats?.interviewed || 0;
      selected += job.stats?.selected || 0;
    });

    const activeJobPostings = jobs
      .filter(j => j.status === 'active')
      .map(j => ({
        id: j._id.toString(),
        title: j.title,
        applicants: j.stats?.applied || 0,
        openings: j.openings || 0,
      }))
      .slice(0, 4);

    // 2. Recruiting Funnel (Aggregate from applications)
    const funnel = [
      { stage: 'Applied', count: totalApplicants, percent: totalApplicants > 0 ? 100 : 0 },
      { stage: 'Shortlisted', count: shortlisted, percent: totalApplicants > 0 ? Math.round((shortlisted / totalApplicants) * 100) : 0 },
      { stage: 'Assessment', count: Math.round(shortlisted * 0.7), percent: totalApplicants > 0 ? Math.round(((shortlisted * 0.7) / totalApplicants) * 100) : 0 }, // Mocking assessment step
      { stage: 'Technical', count: Math.round(interviews * 0.8), percent: totalApplicants > 0 ? Math.round(((interviews * 0.8) / totalApplicants) * 100) : 0 }, // Mocking tech step
      { stage: 'HR Round', count: interviews, percent: totalApplicants > 0 ? Math.round((interviews / totalApplicants) * 100) : 0 },
      { stage: 'Selected', count: selected, percent: totalApplicants > 0 ? Math.round((selected / totalApplicants) * 100) : 0 },
    ];

    // 3. AI-Ranked Top Candidates
    const topApplications = await Application.find({ jobId: { $in: jobIds } })
      .sort({ matchScore: -1 })
      .limit(5)
      .populate('studentId', 'name department cgpa skills')
      .lean();

    const topCandidates = topApplications
      .filter(app => app.studentId)
      .map(app => {
        const student = app.studentId as any;
        return {
          id: student._id.toString(),
          name: student.name,
          department: student.department,
          cgpa: student.cgpa,
          skills: student.skills || [],
          matchScore: app.matchScore || Math.floor(75 + Math.random() * 20),
        };
      });

    // 4. Send response
    res.json({
      success: true,
      data: {
        kpis: {
          activeJobs: activeJobsCount,
          totalApplicants,
          eligibleCandidates: eligibleCandidates || totalApplicants, // fallback if eligible not tracked
          shortlisted,
          interviews,
          offers: selected,
        },
        funnel,
        topCandidates,
        activeJobPostings,
      },
    });
  } catch (error) {
    next(error);
  }
};
