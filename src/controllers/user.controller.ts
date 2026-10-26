import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { Student } from '../models/Student';
import { College } from '../models/College';
import { Application } from '../models/Application';
import { Company } from '../models/Company';
import { createError } from '../middleware/errorHandler';

/**
 * GET /api/users
 * Super Admin: Get all users with filtering, searching, and pagination.
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const { search, role, status } = req.query;
    const filter: Record<string, any> = {};

    if (search) {
      filter['$or'] = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    if (role && role !== 'all') {
      filter.role = role;
    }
    if (status && status !== 'all') {
      filter.isActive = status === 'active';
    }

    const [data, total, statsAgg] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-passwordHash -otpCode -otpExpiresAt -passwordResetToken -passwordResetExpiresAt')
        .lean(),
      User.countDocuments(filter),
      User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
            studentCount: { $sum: { $cond: [{ $eq: ['$role', 'STUDENT'] }, 1, 0] } },
            adminCount: { $sum: { $cond: [{ $in: ['$role', ['SUPER_ADMIN', 'COLLEGE_ADMIN']] }, 1, 0] } },
          }
        }
      ]),
    ]);

    const stats = statsAgg[0] || { totalUsers: 0, activeUsers: 0, studentCount: 0, adminCount: 0 };

    res.json({
      success: true,
      data: {
        data: data.map(u => ({ ...u, id: u._id.toString() })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/users/:id/toggle-status
 * Super Admin: Toggle user isActive status
 */
export const toggleUserStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw createError('User not found', 404);

    if (user.role === 'SUPER_ADMIN' && user._id.toString() === req.user?.userId) {
      throw createError('Cannot deactivate your own super admin account', 400);
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      data: { ...user.toObject(), id: user._id.toString() },
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/users/:id
 * Super Admin: Delete user
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw createError('User not found', 404);

    if (user.role === 'SUPER_ADMIN' && user._id.toString() === req.user?.userId) {
      throw createError('Cannot delete your own super admin account', 400);
    }

    await user.deleteOne();

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/users/:id
 * Super Admin: Get full details for a user, including linked student/college/company data & applications.
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .populate('tenantId', 'name code city state email website logo affiliation establishedYear type')
      .select('-passwordHash -otpCode -otpExpiresAt -passwordResetToken -passwordResetExpiresAt')
      .lean();

    if (!user) {
      throw createError('User not found', 404);
    }

    let studentData: any = null;
    let applications: any[] = [];
    let collegeData: any = user.tenantId || null;
    let recruiterData: any = null;

    if (user.role === 'STUDENT') {
      studentData = await Student.findOne({
        $or: [{ userId: user._id }, { email: user.email }],
      })
        .populate('collegeId', 'name code city state logo website')
        .lean();

      if (studentData) {
        applications = await Application.find({ studentId: studentData._id })
          .populate('jobId', 'title companyName type location salary workMode')
          .sort({ appliedAt: -1 })
          .limit(10)
          .lean();
      }
    } else if (user.role === 'COLLEGE_ADMIN' || user.role === 'TPO') {
      if (!collegeData && user.tenantId) {
        collegeData = await College.findById(user.tenantId).lean();
      }
    } else if (user.role === 'RECRUITER') {
      recruiterData = await Company.findOne({
        $or: [
          { email: user.email },
          { name: { $regex: user.name, $options: 'i' } },
        ],
      }).lean();
    }

    res.json({
      success: true,
      data: {
        user: { ...user, id: user._id.toString() },
        student: studentData ? { ...studentData, id: studentData._id.toString() } : null,
        college: collegeData,
        recruiter: recruiterData,
        applications,
      },
    });
  } catch (error) {
    next(error);
  }
};

