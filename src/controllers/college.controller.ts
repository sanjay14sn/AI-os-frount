import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { College } from '../models/College';
import { Department } from '../models/Department';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';

const STOP_WORDS = new Set(['OF', 'AND', 'THE', 'FOR', 'A', 'AN']);
const GENERIC_WORDS = new Set(['COLLEGE', 'INSTITUTE', 'UNIVERSITY', 'SCHOOL', 'TECHNOLOGY', 'SCIENCE', 'ENGINEERING']);

export const collegeCodeLetters = (name: string): string => {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));
  if (!words.length) return 'COL';

  const first = words[0];
  if (first.length >= 3 && !GENERIC_WORDS.has(first)) return first.slice(0, 3);

  let letters = first;
  for (const word of words.slice(1)) {
    letters += word[0];
    if (letters.length >= 3) break;
  }
  return letters.padEnd(3, 'X').slice(0, 3);
};

let ensurePromise: Promise<void> | null = null;

export const ensureCollegeCodes = async (): Promise<void> => {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const colleges = await College.find().sort({ createdAt: 1 });
      const used = new Set<string>();
      for (const college of colleges) {
        if (/^[A-Z]{3}\d$/.test(college.code) && !used.has(college.code)) {
          used.add(college.code);
          continue;
        }
        const letters = collegeCodeLetters(college.name);
        let assigned = '';
        for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
          const candidate = `${letters}${digit}`;
          if (!used.has(candidate)) {
            assigned = candidate;
            break;
          }
        }
        if (!assigned) assigned = `${letters}1`;
        used.add(assigned);
        if (college.code !== assigned) {
          college.code = assigned;
          await college.save();
        }
      }
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
};

const allocateCollegeCode = async (name: string): Promise<string> => {
  await ensureCollegeCodes();
  const letters = collegeCodeLetters(name);
  const existing = await College.find({ code: new RegExp(`^${letters}\\d$`) }).select('code').lean();
  const used = new Set(existing.map((college) => college.code));
  for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']) {
    const candidate = `${letters}${digit}`;
    if (!used.has(candidate)) return candidate;
  }
  throw createError('No college code is available for this name', 409);
};

export const lookupCollege = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await ensureCollegeCodes();
    const query = String(req.query.q || '').trim();
    if (query.length < 2) {
      res.json({ success: true, data: null });
      return;
    }

    const code = query.toUpperCase();
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let college = /^[A-Z]{3}\d$/.test(code)
      ? await College.findOne({ code, isActive: true })
      : null;
    if (!college) {
      college = await College.findOne({
        isActive: true,
        $or: [{ code }, { name: new RegExp(`^${escaped}$`, 'i') }],
      });
    }
    if (!college && query.length >= 4) {
      college = await College.findOne({ isActive: true, name: new RegExp(escaped, 'i') });
    }
    if (!college) {
      res.json({ success: true, data: null });
      return;
    }

    const departments = await Department.find({ collegeId: college._id }).select('name code').sort({ name: 1 }).lean();
    const departmentList = departments.length
      ? departments.map((department) => ({
          id: department._id.toString(),
          name: department.name,
          code: department.code,
        }))
      : (college.departments || []).map((name, index) => ({
          id: `dept-${index + 1}`,
          name,
          code: name,
        }));

    res.json({
      success: true,
      data: {
        id: college._id.toString(),
        name: college.name,
        code: college.code,
        city: college.city,
        departments: departmentList,
      },
    });
  } catch (error) { next(error); }
};

export const getColleges = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await ensureCollegeCodes();
    const filter: Record<string, unknown> = {};
    if (req.user?.role !== 'SUPER_ADMIN' && req.user?.tenantId) {
      filter._id = new mongoose.Types.ObjectId(req.user.tenantId);
    }

    const { search } = req.query;
    if (search) {
      filter['$or'] = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      College.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      College.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: { data: data.map(c => ({ ...c, id: c._id.toString() })), total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
};

export const getCollegeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await ensureCollegeCodes();
    const college = await College.findById(req.params.id);
    if (!college) throw createError('College not found', 404);
    res.json({ success: true, data: college });
  } catch (error) { next(error); }
};

export const updateCollege = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) throw createError('No token provided', 401);
    const role = req.user.role;
    const canEdit = role === 'SUPER_ADMIN' || role === 'COLLEGE_ADMIN' || role === 'TPO';
    if (!canEdit) throw createError('Access denied', 403);
    if (role !== 'SUPER_ADMIN' && req.user.tenantId !== req.params.id) {
      throw createError('Access denied', 403);
    }

    const body = req.body || {};
    const updates: Record<string, unknown> = {};
    const fields = ['name', 'city', 'state', 'country', 'website', 'phone', 'email', 'affiliation', 'type', 'tpoName', 'tpoEmail', 'tpoPhone'] as const;
    for (const field of fields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (body.establishedYear !== undefined && body.establishedYear !== '') {
      updates.establishedYear = Number(body.establishedYear);
    }
    if (body.settings && typeof body.settings === 'object') {
      const settings = body.settings;
      updates.settings = {
        minCgpa: Math.min(10, Math.max(0, Number(settings.minCgpa ?? 6))),
        maxBacklogs: Math.max(0, Number(settings.maxBacklogs ?? 0)),
        driveAlerts: Boolean(settings.driveAlerts),
        applicationAlerts: Boolean(settings.applicationAlerts),
        interviewReminders: Boolean(settings.interviewReminders),
      };
    }

    const college = await College.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!college) throw createError('College not found', 404);
    res.json({ success: true, data: college });
  } catch (error) { next(error); }
};

export const toggleCollegeStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const college = await College.findById(req.params.id);
    if (!college) throw createError('College not found', 404);
    college.isActive = !college.isActive;
    await college.save();
    res.json({ success: true, data: college });
  } catch (error) { next(error); }
};

export const createCollege = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, city, state, establishedYear, tpoName, tpoEmail, tpoPhone, password, plan } = req.body;
    
    if (!name || !tpoEmail || !password) {
      throw createError('Name, TPO Email, and Password are required', 400);
    }

    const code = await allocateCollegeCode(name);

    const existingUser = await User.findOne({ email: tpoEmail.toLowerCase() });
    if (existingUser) throw createError('TPO email already registered', 400);

    // 1. Create College
    const college = await College.create({
      name,
      code,
      city: city || 'Unknown',
      state: state || 'State',
      phone: tpoPhone || '0000000000',
      email: tpoEmail.toLowerCase(),
      establishedYear: parseInt(establishedYear || '2000', 10),
      tpoName: tpoName || 'College Admin',
      tpoEmail: tpoEmail.toLowerCase(),
      tpoPhone: tpoPhone || '',
      isActive: true,
      subscription: {
        plan: plan || 'starter',
        status: 'active',
        startDate: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        autoRenew: true,
        studentsUsed: 0,
        studentsLimit: plan === 'enterprise' ? 10000 : plan === 'professional' ? 5000 : 1000,
        aiCreditsUsed: 0,
        aiCreditsLimit: plan === 'enterprise' ? 50000 : plan === 'professional' ? 20000 : 5000,
        recruitersUsed: 0,
        recruitersLimit: 100,
        jobsUsed: 0,
        jobsLimit: 500,
      }
    });

    // 2. Create College Admin User Account
    let adminUser;
    try {
      adminUser = await User.create({
        name: tpoName || `${name} Admin`,
        email: tpoEmail.toLowerCase(),
        passwordHash: password, // Mongoose pre-save hook will hash this automatically
        role: 'COLLEGE_ADMIN',
        tenantId: college._id,
        phone: tpoPhone || '',
        isActive: true,
        isEmailVerified: true,
      });
    } catch (userErr) {
      // Rollback college creation if user account creation fails
      await College.findByIdAndDelete(college._id);
      throw userErr;
    }

    const collegeData = college.toJSON() as Record<string, unknown>;
    collegeData.id = college._id.toString();

    res.status(201).json({
      success: true,
      message: 'College and College Admin account created successfully',
      data: {
        college: collegeData,
        adminUser: {
          id: adminUser._id.toString(),
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role,
        }
      }
    });
  } catch (error) { next(error); }
};

/**
 * POST /api/colleges/:id/reset-password
 * Super Admin: Reset or create credentials for a college admin user
 */
export const resetCollegePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || String(password).length < 6) {
      throw createError('Password must be at least 6 characters', 400);
    }

    const college = await College.findById(id);
    if (!college) throw createError('College not found', 404);

    let user = await User.findOne({
      $or: [
        { email: college.tpoEmail?.toLowerCase() },
        { tenantId: college._id }
      ]
    });

    if (user) {
      user.passwordHash = password; // pre-save hashes this
      user.isActive = true;
      user.isEmailVerified = true;
      await user.save();
    } else {
      user = await User.create({
        name: college.tpoName || `${college.name} Admin`,
        email: (college.tpoEmail || college.email).toLowerCase(),
        passwordHash: password,
        role: 'COLLEGE_ADMIN',
        tenantId: college._id,
        phone: college.phone || '',
        isActive: true,
        isEmailVerified: true,
      });
    }

    res.json({
      success: true,
      message: `Password reset successfully for ${user.email}`,
      data: {
        email: user.email,
        name: user.name,
        collegeCode: college.code,
      }
    });
  } catch (error) { next(error); }
};


