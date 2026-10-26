import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Company } from '../models/Company';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';

export const getCompanies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filter: Record<string, unknown> = {};
    const { search, type, status, industry } = req.query;

    if (typeof search === 'string' && search.trim()) {
      const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter['$or'] = [
        { name: { $regex: term, $options: 'i' } },
        { industry: { $regex: term, $options: 'i' } },
        { hq: { $regex: term, $options: 'i' } },
        { 'recruiters.name': { $regex: term, $options: 'i' } },
      ];
    }
    if (type && type !== 'all') filter.type = type;
    if (typeof industry === 'string' && industry && industry !== 'all') filter.industry = industry;
    if (status === 'active') filter.isActive = true;
    else if (status === 'inactive') filter.isActive = false;
    else if (status === 'tied') filter.isTied = true;

    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const effectiveCollegeId =
      (!isSuperAdmin && req.user?.tenantId) ||
      (typeof req.query.collegeId === 'string' ? req.query.collegeId : undefined);

    let allCompaniesFilter: Record<string, unknown> = {};

    if (isSuperAdmin) {
      // Super Admin ONLY views platform partner companies, never college-specific companies
      filter.isPlatform = true;
      filter.createdByRole = { $ne: 'COLLEGE_ADMIN' };
      allCompaniesFilter = { isPlatform: true, createdByRole: { $ne: 'COLLEGE_ADMIN' } };
    } else if (effectiveCollegeId) {
      if (mongoose.isValidObjectId(effectiveCollegeId)) {
        filter.colleges = new mongoose.Types.ObjectId(effectiveCollegeId);
        allCompaniesFilter = { colleges: new mongoose.Types.ObjectId(effectiveCollegeId) };
      } else {
        filter.colleges = new mongoose.Types.ObjectId('000000000000000000000000');
        allCompaniesFilter = { colleges: new mongoose.Types.ObjectId('000000000000000000000000') };
      }
    } else if (req.query.isPlatform === 'true' || req.query.scope === 'platform') {
      filter.isPlatform = true;
      allCompaniesFilter = { isPlatform: true };
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const skip = (page - 1) * limit;

    const [data, total, allCompanies] = await Promise.all([
      Company.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Company.countDocuments(filter),
      Company.find(allCompaniesFilter).lean(),
    ]);

    const totalPartnerCompanies = allCompanies.length;
    const tiedCount = allCompanies.filter(c => c.isTied).length;
    const totalStudentsHired = allCompanies.reduce((acc, c) => acc + (c.totalHired || 0), 0);

    const rawPackages = allCompanies
      .map(c => (c.avgPackage > 1000 ? c.avgPackage / 100000 : c.avgPackage))
      .filter(p => p > 0);
    const avgPkgVal = rawPackages.length > 0
      ? (rawPackages.reduce((a, b) => a + b, 0) / rawPackages.length).toFixed(1)
      : '12.4';
    const highestPkgVal = allCompanies.reduce((max, c) => {
      const p = c.highestPackage > 1000 ? c.highestPackage / 100000 : (c.highestPackage || 0);
      return Math.max(max, p);
    }, 0);
    const industries = [...new Set(allCompanies.map(c => c.industry).filter(Boolean))].sort();

    const formattedData = data.map(c => ({
      ...c,
      id: c._id.toString(),
      avgPackage: c.avgPackage > 1000 ? Math.round((c.avgPackage / 100000) * 10) / 10 : c.avgPackage,
      highestPackage: c.highestPackage > 1000 ? Math.round((c.highestPackage / 100000) * 10) / 10 : c.highestPackage,
    }));

    res.json({
      success: true,
      data: {
        data: formattedData,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          totalPartnerCompanies,
          tiedCount,
          totalStudentsHired,
          avgPackage: `₹${avgPkgVal} LPA`,
          highestPackage: Math.round(highestPkgVal * 10) / 10,
          industries,
        },
      },
    });
  } catch (error) { next(error); }
};

export const getCompanyById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) throw createError('Company not found', 404);
    res.json({ success: true, data: company });
  } catch (error) { next(error); }
};

export const createCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
    const collegeId = !isSuperAdmin ? (req.user?.tenantId || (req.body.collegeId ? req.body.collegeId : undefined)) : undefined;
    const colleges = collegeId && mongoose.isValidObjectId(collegeId) ? [new mongoose.Types.ObjectId(collegeId)] : (req.body.colleges || []);

    const recruiterEmail = req.body.recruiterEmail ? String(req.body.recruiterEmail).trim().toLowerCase() : undefined;
    const recruiterPassword = req.body.recruiterPassword ? String(req.body.recruiterPassword) : undefined;
    const recruiterName = req.body.recruiterName?.trim() || req.body.name?.trim() || 'Corporate Recruiter';
    const recruiterPhone = req.body.recruiterPhone?.trim() || '';

    if (recruiterEmail && recruiterPassword) {
      const existingUser = await User.findOne({ email: recruiterEmail });
      if (existingUser) {
        throw createError('A user with this recruiter email already exists', 400);
      }
    }

    const payload = {
      ...req.body,
      colleges,
      isPlatform: isSuperAdmin ? true : !!req.body.isPlatform,
      createdByRole: isSuperAdmin ? 'SUPER_ADMIN' : 'COLLEGE_ADMIN',
      email: recruiterEmail,
      industry: req.body.industry || 'Technology',
      hq: req.body.hq || 'Bengaluru',
      size: req.body.size || 'medium',
      type: req.body.type || 'product',
      avgPackage: Number(req.body.avgPackage || 12),
      highestPackage: Number(req.body.highestPackage || 28),
    };
    const company = await Company.create(payload);

    let recruiterUserId: mongoose.Types.ObjectId | undefined;
    if (recruiterEmail && recruiterPassword) {
      const recruiterUser = await User.create({
        name: recruiterName,
        email: recruiterEmail,
        passwordHash: recruiterPassword, // automatically hashed by userSchema.pre('save')
        role: 'RECRUITER',
        tenantId: company._id,
        phone: recruiterPhone,
        isActive: true,
        isEmailVerified: true,
      });
      recruiterUserId = recruiterUser._id;
      company.recruiterId = recruiterUserId;
      await company.save();
    }

    const doc = company.toObject();
    res.status(201).json({
      success: true,
      data: {
        ...doc,
        id: doc._id.toString(),
        recruiterId: recruiterUserId ? recruiterUserId.toString() : undefined,
      },
      message: recruiterEmail
        ? `Company and Recruiter login (${recruiterEmail}) created successfully!`
        : 'Company created successfully',
    });
  } catch (error) { next(error); }
};

export const updateCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!company) throw createError('Company not found', 404);
    const doc = company.toObject();
    res.json({
      success: true,
      data: {
        ...doc,
        id: doc._id.toString(),
      },
    });
  } catch (error) { next(error); }
};

export const toggleCompanyStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) throw createError('Company not found', 404);
    company.isActive = !company.isActive;
    await company.save();
    res.json({ success: true, data: company, message: `Company ${company.isActive ? 'activated' : 'deactivated'}` });
  } catch (error) { next(error); }
};

export const toggleTiedStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) throw createError('Company not found', 404);
    company.isTied = !company.isTied;
    await company.save();
    res.json({ success: true, data: company, message: `Company ${company.isTied ? 'tied up' : 'untied'}` });
  } catch (error) { next(error); }
};

export const deleteCompany = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const company = await Company.findByIdAndDelete(req.params.id);
    if (!company) throw createError('Company not found', 404);
    res.json({ success: true, message: 'Company deleted' });
  } catch (error) { next(error); }
};
