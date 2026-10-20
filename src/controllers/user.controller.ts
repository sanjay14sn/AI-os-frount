import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
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
