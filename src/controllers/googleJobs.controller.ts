import zlib from 'zlib';
import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { SavedResume, ISavedResume } from '../models/SavedResume';
import { createError } from '../middleware/errorHandler';
import { generateText } from '../services/gemini.service';

type ListingRating = {
  company_name?: string;
  source?: string;
  rating?: number;
  reviews?: number;
  link?: string;
};

const MAX_SAVED_RESUMES = 5;
const MAX_STORED_RESUME_BYTES = 8 * 1024 * 1024;

const toResumeSummary = (r: ISavedResume) => ({
  id: String(r._id),
  fileName: r.fileName,
  size: r.size,
  lastQuery: r.lastQuery || '',
  uploadedAt: r.createdAt,
  lastUsedAt: r.lastUsedAt,
});

type SerpApiResponse = {
  error?: string;
  jobs_results?: any[];
  ratings?: ListingRating[];
};

const SKILL_TERMS = [
  'spring boot', 'machine learning', 'react native', 'node.js', 'react', 'angular', 'vue',
  'typescript', 'javascript', 'python', 'django', 'flask', 'java', 'golang', 'kotlin',
  'spring', 'sql', 'mongodb', 'aws', 'docker', 'kubernetes', 'flutter', 'android',
  'data science', 'devops', '.net', 'c++', 'c#',
];

const decodePdfString = (value: string) => value
  .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
  .replace(/\\n/g, ' ')
  .replace(/\\r/g, ' ')
  .replace(/\\t/g, ' ')
  .replace(/\\\(/g, '(')
  .replace(/\\\)/g, ')')
  .replace(/\\\\/g, '\\');

const inflateObject = (source: string) => {
  const match = source.match(/stream\r?\n([\s\S]*?)endstream/);
  if (!match) return '';
  try {
    return zlib.inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1');
  } catch {
    return '';
  }
};

const parseCmap = (cmapText: string) => {
  const map = new Map<string, string>();
  for (const chunk of cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    const pairs = /<([0-9A-Fa-f]{1,4})>\s*<([0-9A-Fa-f]{1,6})>/g;
    let pair: RegExpExecArray | null;
    while ((pair = pairs.exec(chunk[1]))) {
      map.set(pair[1].toUpperCase().padStart(4, '0'), pair[2].toUpperCase().padStart(4, '0'));
    }
  }
  for (const chunk of cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const ranges = /<([0-9A-Fa-f]{1,4})>\s*<([0-9A-Fa-f]{1,4})>\s*<([0-9A-Fa-f]{1,6})>/g;
    let range: RegExpExecArray | null;
    while ((range = ranges.exec(chunk[1]))) {
      const start = parseInt(range[1], 16);
      const end = parseInt(range[2], 16);
      if (end < start || end - start > 400) continue;
      for (let code = start; code <= end; code += 1) {
        map.set(
          code.toString(16).toUpperCase().padStart(4, '0'),
          (parseInt(range[3], 16) + (code - start)).toString(16).toUpperCase().padStart(4, '0'),
        );
      }
    }
  }
  return map;
};

const pdfObjects = (raw: string) => {
  const marks: { id: string; index: number }[] = [];
  const marker = /(\d+)\s+0\s+obj/g;
  let mark: RegExpExecArray | null;
  while ((mark = marker.exec(raw))) marks.push({ id: mark[1], index: mark.index });
  const objects = new Map<string, string>();
  for (const item of marks) {
    const start = raw.indexOf('obj', item.index) + 3;
    let end = raw.indexOf('endobj', start);
    const streamAt = raw.indexOf('stream', start);
    if (streamAt !== -1 && streamAt < end) {
      const endStream = raw.indexOf('endstream', streamAt);
      if (endStream !== -1) end = raw.indexOf('endobj', endStream);
    }
    if (end > start) objects.set(item.id, raw.slice(start, end));
  }
  return objects;
};

const extractEncodedPdfText = (raw: string) => {
  const objects = pdfObjects(raw);
  const cmaps = new Map<string, Map<string, string>>();
  for (const [id, source] of objects) {
    const text = inflateObject(source);
    if (text.includes('beginbfchar') || text.includes('beginbfrange')) cmaps.set(id, parseCmap(text));
  }

  const fontMaps = new Map<string, Map<string, string>>();
  for (const [id, source] of objects) {
    const unicodeId = source.match(/\/ToUnicode\s+(\d+)\s+0\s+R/)?.[1];
    const cmap = unicodeId ? cmaps.get(unicodeId) : undefined;
    if (!cmap) continue;
    const baseFont = source.match(/\/BaseFont\s*\/([A-Za-z0-9+]+)/)?.[1]?.split('+')[0];
    if (baseFont) fontMaps.set(baseFont, cmap);
    for (const other of objects.values()) {
      const names = other.matchAll(new RegExp(`/([A-Za-z0-9]+)\\s+${id}\\s+0\\s+R`, 'g'));
      for (const name of names) fontMaps.set(name[1], cmap);
    }
  }

  let decoded = '';
  for (const source of objects.values()) {
    const text = inflateObject(source);
    if (!text.includes('Tf') && !text.includes('Tj')) continue;
    let font: Map<string, string> | undefined;
    const tokens = /\/([A-Za-z][A-Za-z0-9+]*)\s+[-\d.]+\s+Tf|<([0-9A-Fa-f]+)>|\(((?:\\.|[^\\)]){1,200})\)\s*Tj/g;
    let token: RegExpExecArray | null;
    while ((token = tokens.exec(text))) {
      if (token[1]) {
        font = fontMaps.get(token[1]) || fontMaps.get(token[1].split('+')[0]) || font;
        continue;
      }
      if (token[2] && font && token[2].length >= 4 && token[2].length % 4 === 0) {
        for (let index = 0; index < token[2].length; index += 4) {
          const dest = font.get(token[2].slice(index, index + 4).toUpperCase());
          if (!dest) continue;
          const code = parseInt(dest.slice(0, 4), 16);
          if (code > 31 && code < 65535) decoded += String.fromCharCode(code);
        }
        continue;
      }
      if (token[3]) decoded += ` ${decodePdfString(token[3])} `;
    }
  }
  return decoded.replace(/\s+/g, ' ').trim();
};

const extractLiteralPdfText = (raw: string) => {
  const parts: string[] = [];
  const pattern = /\(((?:\\.|[^\\)]){2,200})\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw))) {
    const text = decodePdfString(match[1]);
    if (/[A-Za-z]{3,}/.test(text)) parts.push(text);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

export const extractPdfText = (buffer: Buffer) => {
  const raw = buffer.toString('latin1');
  const encoded = extractEncodedPdfText(raw);
  if (encoded.replace(/[^A-Za-z]/g, '').length > 40) return encoded;
  return extractLiteralPdfText(raw);
};

const RESUME_SIGNALS = [
  'resume', 'curriculum vitae', 'education', 'experience', 'internship',
  'cgpa', 'gpa', 'bachelor', 'b.tech', 'btech', 'projects', 'technical skills',
  'skills', 'objective', 'work experience', 'linkedin', 'github',
];

const CERTIFICATE_SIGNALS = [
  'certificate of incorporation', 'registrar of companies', 'memorandum of association',
  'articles of association', 'this is to certify', 'corporate identity number',
  'incorporation',
];

const countSignals = (text: string, signals: string[]) => {
  const lower = text.toLowerCase();
  return signals.filter(signal => lower.includes(signal)).length;
};

const looksLikeNonResumeName = (name: string) =>
  /incorp|certificate|\bcert\b|\bipa\b|marksheet|aadhaar|\bpan\b|passport/.test(name.toLowerCase());

const isResumeDocument = (text: string, fileName: string) => {
  const resumeSignals = countSignals(text, RESUME_SIGNALS);
  const certificateSignals = countSignals(text, CERTIFICATE_SIGNALS);
  if (looksLikeNonResumeName(fileName) && resumeSignals < 3) return false;
  if (certificateSignals > 0 && resumeSignals < 3) return false;
  return resumeSignals >= 2;
};

const queryFromResume = (text: string) => {
  const lower = text.toLowerCase();
  const found = SKILL_TERMS.filter(term => lower.includes(term));
  const specific = found.filter(term => !found.some(other => other !== term && other.includes(term)));
  return specific.slice(0, 3).join(' ').slice(0, 120);
};

const fetchGoogleJobs = async (query: string) => {
  const searchParams = new URLSearchParams({
    engine: 'google_jobs',
    q: query,
    location: 'Bengaluru, India',
    gl: 'in',
    hl: 'en',
    api_key: env.serpApiKey,
  });
  const searchResponse = await fetch(`https://serpapi.com/search.json?${searchParams}`);
  const body = (await searchResponse.json()) as SerpApiResponse;
  return { ok: searchResponse.ok, body };
};

const saveUploadedResume = async (userId: string, file: Express.Multer.File, hint: string) => {
  const fileName = file.originalname || 'resume.pdf';
  const text = extractPdfText(file.buffer);
  if (!isResumeDocument(text, fileName)) {
    throw createError(`This file is not a resume. ${hint}`, 400);
  }
  const saved = await SavedResume.findOneAndUpdate(
    { userId, fileName, size: file.size },
    {
      $set: {
        text,
        mimeType: file.mimetype || 'application/pdf',
        lastUsedAt: new Date(),
        ...(file.size <= MAX_STORED_RESUME_BYTES ? { data: file.buffer } : {}),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  const stale = await SavedResume.find({ userId }).sort({ lastUsedAt: -1 }).skip(MAX_SAVED_RESUMES).select('_id').lean();
  if (stale.length) await SavedResume.deleteMany({ _id: { $in: stale.map(s => s._id) } });
  return saved;
};

export const uploadSavedResume = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw createError('Not authenticated', 401);
    if (!req.file?.buffer?.length) throw createError('Choose a resume PDF to upload', 400);
    const saved = await saveUploadedResume(userId, req.file, 'Upload your resume as a PDF.');
    res.status(201).json({ success: true, data: toResumeSummary(saved) });
  } catch (error) { next(error); }
};

export const searchGoogleJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!env.serpApiKey) throw createError('Google Jobs search is not configured', 503);
    const userId = req.user?.userId;
    if (!userId) throw createError('Not authenticated', 401);

    let saved;
    if (req.file?.buffer?.length) {
      saved = await saveUploadedResume(userId, req.file, 'Upload your resume PDF to find matching jobs.');
    } else if (typeof req.body?.resumeId === 'string' && mongoose.isValidObjectId(req.body.resumeId)) {
      saved = await SavedResume.findOne({ _id: req.body.resumeId, userId });
      if (!saved) throw createError('That saved resume was not found. Upload it again.', 404);
      saved.lastUsedAt = new Date();
    } else {
      throw createError('Upload a resume PDF before searching for jobs', 400);
    }

    const resumeText = saved.text;
    let query = queryFromResume(resumeText) || 'software engineer';
    if (env.geminiApiKey) {
      try {
        const aiQuery = await generateText(
          `Turn this resume into a Google Jobs search of at most 6 words. Use the strongest role and skills. Return only the query.\n\n${resumeText.slice(0, 4000)}`,
        );
        const cleaned = aiQuery.replace(/["\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (cleaned.split(' ').filter(Boolean).length >= 2) query = cleaned;
      } catch {
        query = queryFromResume(resumeText) || 'software engineer';
      }
    }
    let search = await fetchGoogleJobs(query);
    let searchJson = search.body;
    let noResults = typeof searchJson?.error === 'string' && /hasn't returned any results/i.test(searchJson.error);
    if (noResults) {
      const lead = SKILL_TERMS.find(term => query.startsWith(term)) || query.split(' ')[0];
      const broader = `${lead} engineer`;
      if (broader !== query) {
        query = broader;
        search = await fetchGoogleJobs(query);
        searchJson = search.body;
        noResults = typeof searchJson?.error === 'string' && /hasn't returned any results/i.test(searchJson.error);
      }
    }
    saved.lastQuery = query;
    await saved.save();
    const resume = toResumeSummary(saved);

    if (noResults) {
      res.json({ success: true, data: [], query, resume });
      return;
    }
    if (!search.ok || (searchJson.error && !Array.isArray(searchJson.jobs_results))) {
      throw createError(searchJson.error || 'Google Jobs search failed', 502);
    }

    const results = Array.isArray(searchJson.jobs_results) ? searchJson.jobs_results.slice(0, 8) : [];

    const jobs = await Promise.all(results.map(async (job: any, index: number) => {
      let ratings: ListingRating[] = [];
      if (index < 4 && job.job_id) {
        try {
          const listingParams = new URLSearchParams({
            engine: 'google_jobs_listing',
            q: job.job_id,
            api_key: env.serpApiKey,
          });
          const listingResponse = await fetch(`https://serpapi.com/search.json?${listingParams}`, {
            signal: AbortSignal.timeout(8000),
          });
          const listingJson = (await listingResponse.json()) as SerpApiResponse;
          if (Array.isArray(listingJson.ratings)) ratings = listingJson.ratings;
        } catch {
          ratings = [];
        }
      }

      return {
        id: String(job.job_id || `${job.title || 'job'}-${index}`),
        title: job.title || 'Job',
        companyName: job.company_name || 'Company',
        location: job.location || 'India',
        via: job.via || '',
        description: typeof job.description === 'string' ? job.description.slice(0, 280) : '',
        schedule: job.detected_extensions?.schedule_type || '',
        postedAt: job.detected_extensions?.posted_at || '',
        applyLink: job.apply_options?.[0]?.link || job.share_link || '',
        ratings: ratings.slice(0, 3).map(rating => ({
          source: rating.source || 'Rating',
          rating: typeof rating.rating === 'number' ? rating.rating : null,
          reviews: typeof rating.reviews === 'number' ? rating.reviews : null,
          link: rating.link || '',
        })),
      };
    }));

    res.json({ success: true, data: jobs, query, resume });
  } catch (error) {
    next(error);
  }
};

export const listSavedResumes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const resumes = await SavedResume.find({ userId: req.user?.userId })
      .sort({ lastUsedAt: -1 })
      .limit(MAX_SAVED_RESUMES);
    res.json({ success: true, data: resumes.map(toResumeSummary) });
  } catch (error) { next(error); }
};

export const downloadSavedResume = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw createError('Resume not found', 404);
    const resume = await SavedResume.findOne({ _id: req.params.id, userId: req.user?.userId }).select('+data');
    if (!resume?.data?.length) throw createError('The original file for this resume is not stored', 404);
    res.setHeader('Content-Type', resume.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resume.fileName)}"`);
    res.send(resume.data);
  } catch (error) { next(error); }
};

export const deleteSavedResume = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) throw createError('Resume not found', 404);
    const result = await SavedResume.deleteOne({ _id: req.params.id, userId: req.user?.userId });
    if (!result.deletedCount) throw createError('Resume not found', 404);
    res.json({ success: true, message: 'Resume removed' });
  } catch (error) { next(error); }
};
