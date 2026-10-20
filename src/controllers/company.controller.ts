import { Request, Response, NextFunction } from 'express';
import { Company } from '../models/Company';
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

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const skip = (page - 1) * limit;

    const [data, total, allCompanies] = await Promise.all([
      Company.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Company.countDocuments(filter),
      Company.find({}).lean(),
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
    const payload = {
      ...req.body,
      industry: req.body.industry || 'Technology',
      hq: req.body.hq || 'Bengaluru',
      size: req.body.size || 'medium',
      type: req.body.type || 'product',
      avgPackage: Number(req.body.avgPackage || 12),
      highestPackage: Number(req.body.highestPackage || 28),
    };
    const company = await Company.create(payload);
    const doc = company.toObject();
    res.status(201).json({
      success: true,
      data: {
        ...doc,
        id: doc._id.toString(),
      },
      message: 'Company created successfully',
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
