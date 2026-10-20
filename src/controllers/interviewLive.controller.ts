import { Request, Response, NextFunction } from 'express';
import { InterviewSession } from '../models/InterviewSession';
import { Student } from '../models/Student';
import { env } from '../config/env';
import { createError } from '../middleware/errorHandler';
import { generateJson } from '../services/gemini.service';

const DAILY_COMPLETED_LIMIT = 5;
const HOURLY_START_LIMIT = 12;

export const LIVE_MODELS = [
  'gemini-3.8-live',
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.0-flash-live-001',
];

type AuthTokenResponse = {
  name?: string;
  error?: { message?: string };
};

const mintLiveToken = async (): Promise<string> => {
  if (!env.geminiApiKey) throw createError('Gemini is not configured', 503);
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const paths = [
    'https://generativelanguage.googleapis.com/v1beta/auth_tokens',
    'https://generativelanguage.googleapis.com/v1alpha/auth_tokens',
  ];
  let lastMessage = 'Gemini could not start a live voice session';
  for (const url of paths) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.geminiApiKey,
      },
      body: JSON.stringify({ uses: 1, expireTime, newSessionExpireTime }),
    });
    const body = (await response.json().catch(() => ({}))) as AuthTokenResponse;
    if (response.ok && typeof body?.name === 'string' && body.name) return body.name;
    lastMessage = body?.error?.message || lastMessage;
    if (response.status !== 404) break;
  }
  throw createError(lastMessage, 502);
};

const instructionsFor = async (req: Request, company: string, round: string) => {
  const student = await Student.findOne({ userId: req.user?.userId })
    .select('name department degree batch cgpa skills preferredRoles')
    .lean();
  const roundLabel = round === 'hr' ? 'HR and behavioral' : round === 'technical' ? 'technical' : round;
  const profile = student
    ? `${student.name}, ${student.degree || 'student'} in ${student.department || 'their department'}, batch ${student.batch || 'current'}, CGPA ${student.cgpa ?? 'unknown'}, skills ${(student.skills || []).slice(0, 8).join(', ') || 'not listed'}.`
    : 'a campus student.';
  return `You are a young woman interviewing live at ${company} for a ${roundLabel} campus placement round. The candidate is ${profile} Speak like a real person across the table: warm, natural, unhurried, with everyday English and a calm young woman's voice. Do not sound like a text-to-speech system, a robot, or a news anchor. Ask one question at a time. The candidate may answer by speaking or by typing. Treat a typed message as their answer and ask the next question out loud. Do not read a list of questions. Start by greeting the candidate by name if you know it, then ask them to introduce themselves. Continue with follow-up questions based on what they actually say. After four or five exchanges, thank them and close the interview. Keep each question short enough to say in one breath. Do not mention that you are a language model.`;
};

const assertOwner = async (req: Request, id: string) => {
  const session = await InterviewSession.findById(id);
  if (!session || String(session.userId) !== req.user?.userId) {
    throw createError('Interview session not found', 404);
  }
  return session;
};

export const startInterview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.role !== 'STUDENT') throw createError('Only students can start a mock interview', 403);
    const company = String(req.body?.company || '').trim().slice(0, 80);
    const round = String(req.body?.round || 'technical').trim().slice(0, 40);
    if (!company) throw createError('Choose a company', 400);

    const sinceMidnight = new Date();
    sinceMidnight.setHours(0, 0, 0, 0);
    const completedToday = await InterviewSession.countDocuments({
      userId: req.user.userId,
      status: 'completed',
      createdAt: { $gte: sinceMidnight },
    });
    if (completedToday >= DAILY_COMPLETED_LIMIT) {
      throw createError(`Daily limit reached. You can complete ${DAILY_COMPLETED_LIMIT} mock interviews per day.`, 429);
    }
    const recentStarts = await InterviewSession.countDocuments({
      userId: req.user.userId,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (recentStarts >= HOURLY_START_LIMIT) {
      throw createError('Hourly interview limit reached. Try again later.', 429);
    }

    await InterviewSession.updateMany(
      { userId: req.user.userId, status: 'active' },
      { status: 'abandoned' },
    );

    const token = await mintLiveToken();
    const instructions = await instructionsFor(req, company, round);
    const session = await InterviewSession.create({
      userId: req.user.userId,
      company,
      round,
      status: 'active',
    });

    res.json({
      success: true,
      data: {
        sessionId: String(session._id),
        token,
        models: LIVE_MODELS,
        instructions,
        remainingToday: DAILY_COMPLETED_LIMIT - completedToday,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const refreshInterviewToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const session = await assertOwner(req, String(req.params.id));
    if (session.status !== 'active') throw createError('This interview is already closed', 400);
    const token = await mintLiveToken();
    res.json({ success: true, data: { token, models: LIVE_MODELS } });
  } catch (error) {
    next(error);
  }
};

export const completeInterview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const session = await assertOwner(req, String(req.params.id));
    const transcript = Array.isArray(req.body?.transcript)
      ? req.body.transcript
        .filter((turn: { role?: string; text?: string }) =>
          (turn?.role === 'interviewer' || turn?.role === 'candidate') && typeof turn.text === 'string' && turn.text.trim())
        .slice(0, 40)
        .map((turn: { role: 'interviewer' | 'candidate'; text: string }) => ({
          role: turn.role,
          text: turn.text.trim().slice(0, 4000),
        }))
      : [];

    let score = 0;
    let feedback = 'No speech was captured, so this interview could not be scored.';
    let strengths: string[] = [];
    let improvements: string[] = ['Speak a full answer after each question so the interviewer can score it.'];
    const interviewerSpoke = transcript.some((turn: { role: string }) => turn.role === 'interviewer');

    if (transcript.some((turn: { role: string }) => turn.role === 'candidate')) {
      const graded = await generateJson<{
        score?: number;
        feedback?: string;
        strengths?: string[];
        improvements?: string[];
      }>(
        `Score this campus ${session.round} interview at ${session.company} from 0 to 100 using only the transcript. Return JSON with score (integer), feedback (string), strengths (string array), and improvements (string array). Transcript: ${JSON.stringify(transcript)}`,
        'You grade campus placement interviews. Do not invent answers the candidate did not give.',
      );
      score = Math.max(0, Math.min(100, Math.round(Number(graded.score) || 0)));
      feedback = String(graded.feedback || feedback);
      strengths = Array.isArray(graded.strengths) ? graded.strengths.map(String).slice(0, 5) : [];
      improvements = Array.isArray(graded.improvements) ? graded.improvements.map(String).slice(0, 5) : [];
    } else if (interviewerSpoke) {
      feedback = 'The interviewer asked a question, but no spoken answer was captured. Answer out loud, then end the interview to get a score.';
      improvements = ['Wait until the question finishes, then speak a full answer before ending the session.'];
    }

    session.transcript = transcript;
    session.score = score;
    session.feedback = feedback;
    session.strengths = strengths;
    session.improvements = improvements;
    session.status = 'completed';
    if (typeof req.body?.model === 'string') session.model = req.body.model.slice(0, 80);
    await session.save();

    res.json({
      success: true,
      data: {
        id: String(session._id),
        company: session.company,
        round: session.round,
        score,
        feedback,
        strengths,
        improvements,
        transcript,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const listInterviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessions = await InterviewSession.find({ userId: req.user?.userId, status: 'completed' })
      .sort({ createdAt: -1 })
      .limit(8)
      .select('company round score feedback createdAt')
      .lean();
    res.json({
      success: true,
      data: sessions.map((session) => ({
        id: String(session._id),
        company: session.company,
        round: session.round,
        score: session.score ?? 0,
        feedback: session.feedback || '',
        createdAt: session.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};
