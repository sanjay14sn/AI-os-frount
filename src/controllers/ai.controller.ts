import { Request, Response, NextFunction } from 'express';
import { Student } from '../models/Student';
import { Job } from '../models/Job';
import { Application } from '../models/Application';
import { AiChat } from '../models/AiChat';
import { generateJson, generateText } from '../services/gemini.service';
import { createError } from '../middleware/errorHandler';
import { extractPdfText } from './googleJobs.controller';

const studentContext = async (req: Request) => {
  const requestedId = typeof req.query.studentId === 'string' ? req.query.studentId : '';
  const query = req.user?.role === 'STUDENT' || !requestedId
    ? { userId: req.user?.userId }
    : { _id: requestedId };
  const student = await Student.findOne(query)
    .select('name department degree batch cgpa backlogs skills projects certifications experience preferredRoles preferredLocations placementStatus profileCompletion')
    .lean();
  if (!student) return null;
  return {
    name: student.name,
    department: student.department,
    degree: student.degree,
    batch: student.batch,
    cgpa: student.cgpa,
    backlogs: student.backlogs,
    skills: student.skills || [],
    projects: (student.projects || []).slice(0, 5).map((project: { title?: string; technologies?: string[] }) => ({
      title: project.title,
      technologies: project.technologies || [],
    })),
    certifications: (student.certifications || []).slice(0, 5).map((item: { name?: string }) => item.name).filter(Boolean),
    experience: (student.experience || []).slice(0, 3).map((item: { role?: string; company?: string }) => `${item.role || 'Role'} at ${item.company || 'company'}`),
    preferredRoles: student.preferredRoles || [],
    preferredLocations: student.preferredLocations || [],
    placementStatus: student.placementStatus,
    profileCompletion: student.profileCompletion,
  };
};

const toLpa = (amount: number) => Math.round((Number(amount) / 100000) * 10) / 10;

const named = (value: unknown) => {
  if (value && typeof value === 'object' && 'name' in value) return String((value as { name?: string }).name || '');
  return '';
};

const titled = (value: unknown) => {
  if (value && typeof value === 'object' && 'title' in value) return String((value as { title?: string }).title || '');
  return '';
};

const campusContext = async (req: Request) => {
  const profile = await studentContext(req);
  const collegeId = req.user?.tenantId;
  const jobs = await Job.find({
    status: 'active',
    ...(collegeId ? { collegeIds: collegeId } : {}),
  })
    .populate('companyId', 'name')
    .select('title location salaryMin salaryMax type skills eligibility applicationDeadline')
    .sort({ applicationDeadline: 1 })
    .limit(20)
    .lean();

  const student = req.user?.role === 'STUDENT'
    ? await Student.findOne({ userId: req.user.userId }).select('_id cgpa backlogs department degree').lean()
    : null;

  const applications = student
    ? await Application.find({ studentId: student._id })
      .populate('jobId', 'title')
      .populate('companyId', 'name')
      .select('status currentStage appliedAt')
      .sort({ appliedAt: -1 })
      .limit(10)
      .lean()
    : [];

  return {
    profile,
    jobs: jobs.map((job) => {
      const reasons: string[] = [];
      const minCgpa = job.eligibility?.minCgpa ?? 0;
      const maxBacklogs = job.eligibility?.maxBacklogs ?? 99;
      const branches = job.eligibility?.branches || [];
      if (student && student.cgpa < minCgpa) reasons.push(`CGPA is below ${minCgpa}`);
      if (student && student.backlogs > maxBacklogs) reasons.push(`backlogs are above ${maxBacklogs}`);
      if (student && branches.length && !branches.some((branch) => {
        const department = (student.department || '').toLowerCase();
        const allowed = branch.toLowerCase();
        return department.includes(allowed) || allowed.includes(department);
      })) {
        reasons.push(`department is not in ${branches.join(', ')}`);
      }
      return {
        title: job.title,
        company: named(job.companyId),
        location: job.location,
        type: job.type,
        salaryMinLpa: toLpa(job.salaryMin),
        salaryMaxLpa: toLpa(job.salaryMax),
        skills: (job.skills || []).slice(0, 8),
        minCgpa,
        deadline: job.applicationDeadline,
        eligible: student ? reasons.length === 0 : undefined,
        reasons,
      };
    }),
    applications: applications.map((item) => ({
      job: titled(item.jobId),
      company: named(item.companyId),
      status: item.status,
      stage: item.currentStage,
      appliedAt: item.appliedAt,
    })),
  };
};

const chatMode = (value: unknown) => {
  const mode = String(value || 'student');
  return mode === 'college' || mode === 'recruiter' || mode === 'student' ? mode : 'student';
};

const INTERVIEW_QUESTIONS: Record<string, string[]> = {
  Java: [
    'What is the difference between an interface and an abstract class?',
    'How does HashMap work, and what happens when two keys collide?',
    'Explain final, finally, and finalize.',
    'What is the difference between == and equals()?',
    'How do you handle exceptions, and when would you create a custom one?',
  ],
  Python: [
    'What is the difference between a list and a tuple?',
    'How do decorators work?',
    'Explain the GIL and when it matters.',
    'What is the difference between deepcopy and a shallow copy?',
    'How would you read a large file without loading it all into memory?',
  ],
  SQL: [
    'What is the difference between WHERE and HAVING?',
    'Explain an inner join versus a left join with an example.',
    'What is an index, and when can it make a query slower?',
    'How do you find duplicate rows in a table?',
    'What is a transaction, and what do ACID properties mean?',
  ],
  HR: [
    'Tell me about yourself in under a minute, focused on placements.',
    'Describe a project where something went wrong and how you fixed it.',
    'Why do you want this role, and why this company?',
    'How do you handle a deadline you cannot meet?',
    'What will you do in your first 90 days if you are hired?',
  ],
};

const answerFromCampus = (message: string, campus: Awaited<ReturnType<typeof campusContext>>) => {
  const text = message.toLowerCase();
  const profile = campus.profile;
  const jobs = campus.jobs;
  const salaryAsk = text.match(/(?:above|over|more than|at least)\s*(\d+(?:\.\d+)?)\s*lpa/);
  const minLpa = salaryAsk ? Number(salaryAsk[1]) : null;

  const line = (job: (typeof jobs)[number]) => {
    const pay = job.salaryMaxLpa > 0 ? `${job.salaryMinLpa}–${job.salaryMaxLpa} LPA` : 'package not listed';
    const company = job.company ? ` at ${job.company}` : '';
    const deadline = job.deadline
      ? ` — apply by ${new Date(job.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : '';
    return `- **${job.title}**${company} — ${pay} — ${job.location || 'Campus'}${deadline}`;
  };

  if (/interview/.test(text)) {
    const topic = /python/.test(text) ? 'Python' : /sql/.test(text) ? 'SQL' : /hr|behavioral|behaviour/.test(text) ? 'HR' : 'Java';
    return `**${topic} interview questions**\n\n${INTERVIEW_QUESTIONS[topic].map((item) => `- ${item}`).join('\n')}`;
  }

  if (/application|applied|status of my/.test(text)) {
    if (!campus.applications.length) return 'You have no applications on the platform yet. Register for a campus drive to start one.';
    const rows = campus.applications.map((item) => {
      const company = item.company ? ` at ${item.company}` : '';
      return `- **${item.job || 'Application'}**${company} — ${item.status}${item.stage ? ` (${item.stage})` : ''}`;
    });
    return `**Your applications**\n\n${rows.join('\n')}`;
  }

  if (/score|readiness|improve|skill gap|what should i learn|learn for/.test(text)) {
    if (!profile) return 'Open this assistant from a student account to see readiness advice for your profile.';
    const owned = new Set((profile.skills || []).map((skill) => skill.toLowerCase()));
    const missing = [...new Set(jobs.flatMap((job) => job.skills))]
      .filter((skill) => !owned.has(skill.toLowerCase()))
      .slice(0, 6);
    const steps = [
      (profile.projects || []).length ? '' : 'Add at least one project and list the technologies you used.',
      (profile.certifications || []).length ? '' : 'Add a certification that matches the role you want.',
      (profile.skills || []).length >= 5 ? '' : 'Add the languages and tools you can already use. Recruiters filter on these.',
      missing.length ? `Campus roles also ask for ${missing.join(', ')}.` : '',
      (profile.cgpa || 0) < 8 ? `Your CGPA is ${profile.cgpa}. A clear project write-up helps when the cutoff is higher than your CGPA.` : '',
    ].filter(Boolean);
    return `**How to improve your placement readiness**\n\n${steps.map((item) => `- ${item}`).join('\n') || '- Your profile already covers the main campus requirements. Keep applying before each deadline.'}`;
  }

  let chosen = jobs;
  let heading = '**Open campus jobs**';
  if (minLpa != null) {
    chosen = jobs.filter((job) => job.salaryMaxLpa >= minLpa);
    heading = `**Jobs at or above ${minLpa} LPA**`;
  } else if (/eligible/.test(text)) {
    chosen = jobs.filter((job) => job.eligible);
    heading = '**Jobs you are eligible for**';
  }

  if (!chosen.length) {
    const blocked = jobs.filter((job) => job.eligible === false).slice(0, 3);
    const why = blocked.map((job) => `- **${job.title}**: ${job.reasons.join('; ') || 'eligibility rules do not match'}`);
    return why.length
      ? `No matching jobs are open for you right now.\n\n${why.join('\n')}`
      : 'No matching jobs are open on the platform right now.';
  }

  return `${heading}\n\n${chosen.slice(0, 8).map(line).join('\n')}`;
};

export const getChat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const mode = chatMode(req.query.mode);
    const saved = await AiChat.findOne({ userId: req.user!.userId, mode }).lean();
    const messages = (saved?.messages || []).map((item) => ({
      id: String(item._id),
      role: item.role,
      content: item.content,
      timestamp: item.createdAt,
    }));
    res.json({ success: true, data: { messages } });
  } catch (error) {
    next(error);
  }
};

const saveChat = (userId: string, mode: string, question: string, answer: string) =>
  AiChat.findOneAndUpdate(
    { userId, mode },
    {
      $push: {
        messages: {
          $each: [
            { role: 'user', content: question.slice(0, 4000), createdAt: new Date() },
            { role: 'assistant', content: answer.slice(0, 12000), createdAt: new Date() },
          ],
          $slice: -100,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

export const chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const message = String(req.body?.message || '').trim();
  const mode = chatMode(req.body?.mode);
  const userId = req.user!.userId;
  try {
    if (!message) throw createError('Message is required', 400);
    const campus = await campusContext(req);
    const content = answerFromCampus(message, campus);
    await saveChat(userId, mode, message, content);
    res.json({ success: true, data: { content, model: 'Campus' } });
  } catch (error) {
    if (message) {
      const answer = error instanceof Error ? error.message : 'Gemini could not answer that.';
      await saveChat(userId, mode, message, answer).catch(() => undefined);
    }
    next(error);
  }
};

export const readiness = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await studentContext(req);
    const data = await generateJson(
      `Score this student's placement readiness from 0 to 100. Return JSON with overallScore (number), breakdown (resume, skills, projects, certifications, communication, interviewReadiness as numbers 0-100), strengths (string array), weaknesses (string array), recommendations (string array), and improvementTimeline (array of {week, action, expectedGain}). Profile: ${JSON.stringify(profile || {})}`,
      'You score campus placement readiness. Base every point on the supplied profile.',
    );
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const skillGap = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const targetRole = String(req.body?.targetRole || 'Software Engineer');
    const profile = await studentContext(req);
    const data = await generateJson<Record<string, any>>(
      `Compare this student with the role "${targetRole}". Return JSON with studentId, targetRole, currentSkills, requiredSkills, matchedSkills, missingSkills, matchPercent (0-100), and learningResources (array of {title, url}). Profile: ${JSON.stringify(profile || {})}`,
    );
    res.json({ success: true, data: { ...data, studentId: profile ? 'me' : '', targetRole } });
  } catch (error) {
    next(error);
  }
};

export const matchScore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const jobId = String(req.body?.jobId || '');
    if (!jobId) throw createError('Job is required', 400);
    const profile = await studentContext(req);
    const job = await Job.findById(jobId).select('title skills description eligibility location').lean();
    if (!job) throw createError('Job not found', 404);
    const data = await generateJson<Record<string, any>>(
      `Score how well this student matches the job, from 0 to 100. Return JSON with overallScore, breakdown (skillMatch, educationMatch, cgpaMatch, certificationMatch, locationMatch, preferenceMatch), matchedSkills, missingSkills, recommendation (one of suitable, borderline, not_suitable), explanation, strengths, and concerns. Student: ${JSON.stringify(profile || {})}. Job: ${JSON.stringify(job)}`,
    );
    res.json({ success: true, data: { ...data, studentId: 'me', jobId } });
  } catch (error) {
    next(error);
  }
};

export const interviewQuestion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = String(req.body?.company || 'the company');
    const round = String(req.body?.round || 'technical');
    const profile = await studentContext(req);
    const question = await generateText(
      `Ask one ${round} interview question for a campus student interviewing at ${company}. Return only the question. Profile: ${JSON.stringify(profile || {})}`,
    );
    res.json({ success: true, data: { question } });
  } catch (error) {
    next(error);
  }
};

export const analyzeResume = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.file?.buffer?.length) throw createError('Upload a resume PDF', 400);
    const targetRole = String(req.body?.targetRole || 'Software Engineer');
    const resumeText = extractPdfText(req.file.buffer).slice(0, 8000);
    if (resumeText.replace(/[^A-Za-z]/g, '').length < 40) {
      throw createError('Could not read this resume PDF.', 400);
    }
    const data = await generateJson<Record<string, any>>(
      `Review this resume for the role "${targetRole}". Return JSON with fileName, targetRole, overallScore, atsScore, formattingScore, impactScore, parsedSummary (name, email, phone, wordCount, detectedSections, skillsFound), sections (skills, projects, atsKeywords, formatting, achievements, experience, education), strengths, weaknesses, matchedKeywords, missingKeywords, missingSkills, bulletFixes (array of {original, optimized, reason}), atsChecklist (array of {check, passed, details}), suggestions, and certificationRecommendations. Resume:\n${resumeText}`,
      'You are an ATS resume reviewer for campus placements. Scores are integers from 0 to 100.',
    );
    res.json({
      success: true,
      data: {
        ...data,
        fileName: req.file.originalname,
        targetRole,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const optimizeProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await studentContext(req);
    const targetRoles = profile?.preferredRoles?.length ? profile.preferredRoles.join(', ') : 'Software Engineer';
    const dept = profile?.department || 'Computer Science';
    const currentSkills = profile?.skills || [];

    let data;
    try {
      data = await generateJson(
        `Analyze this student's profile for top tier campus recruitment and ATS score optimization.
Return a valid JSON object matching this schema:
{
  "headlineSuggestion": "A compelling 1-line headline (e.g. 'Full Stack Engineer | React, Node.js & Cloud | Final Year CSE')",
  "executiveSummary": "A concise 2-sentence professional bio emphasizing strengths, problem solving, and passion for engineering.",
  "recommendedSkills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"],
  "missingKeywords": ["Keyword 1", "Keyword 2", "Keyword 3", "Keyword 4"],
  "projectIdeas": [
    { "title": "Project Title 1", "tech": "React, Node.js, MongoDB", "summary": "Impactful project description solving a real world problem." },
    { "title": "Project Title 2", "tech": "Python, Docker, Redis", "summary": "High scalability backend/API service." }
  ],
  "recruiterTips": [
    "Tip 1 for campus placements",
    "Tip 2 for resume and ATS screening",
    "Tip 3 for tech interviews"
  ]
}
Current Profile:
Department: ${dept}
Target Roles: ${targetRoles}
Current Skills: ${currentSkills.join(', ')}
Current Projects: ${JSON.stringify(profile?.projects || [])}
Current Certifications: ${JSON.stringify(profile?.certifications || [])}`,
        'You are an expert AI Placement Director and Technical Recruiter.'
      );
    } catch {
      // Deterministic fallback
      data = {
        headlineSuggestion: `${targetRoles.split(',')[0] || 'Software Engineer'} | High Performance Engineering | ${dept} 2025`,
        executiveSummary: `Passionate engineer specializing in modern software architectures, algorithms, and resilient full-stack systems. Driven to deliver robust, scalable technology solutions for high-growth tech teams.`,
        recommendedSkills: ['Docker', 'TypeScript', 'Kubernetes', 'Redis', 'AWS Cloud', 'PostgreSQL'].filter(s => !currentSkills.includes(s)),
        missingKeywords: ['CI/CD Pipelines', 'System Design', 'Microservices Architecture', 'Unit Testing'],
        projectIdeas: [
          {
            title: 'Real-time Distributed Event Streaming Platform',
            tech: 'TypeScript, WebSocket, Redis, Docker',
            summary: 'Engineered a low-latency event broker handling concurrent client subscriptions with automatic message deduplication.'
          },
          {
            title: 'Cloud-Native Automated CI/CD Vulnerability Gate',
            tech: 'Go / Node.js, Docker, GitHub Actions, AWS S3',
            summary: 'Built automated container vulnerability scanning gate rejecting insecure build artifacts prior to staging deployment.'
          }
        ],
        recruiterTips: [
          'Quantify your project metrics (e.g. "Reduced API latency by 35% using Redis caching").',
          'Include active GitHub repo links and live demo URLs on your resume and profile.',
          'Add your verified LinkedIn profile and phone number so campus coordinators can reach you directly.'
        ]
      };
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

