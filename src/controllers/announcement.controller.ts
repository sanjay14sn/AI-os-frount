import { Request, Response, NextFunction } from 'express';
import { Announcement } from '../models/Announcement';
import { createError } from '../middleware/errorHandler';

export const getAnnouncements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const filter: any = {};
    if (req.user?.role === 'STUDENT') {
      filter.targetAudience = { $in: ['STUDENT', 'ALL'] };
      filter.isPublished = true;
    } else if (req.user?.role === 'COLLEGE_ADMIN') {
      filter.targetAudience = { $in: ['COLLEGE_ADMIN', 'TPO', 'ALL'] };
      filter.isPublished = true;
    }

    const announcements = await Announcement.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: announcements.map(a => {
        const obj = a.toJSON();
        return { ...obj, id: obj._id };
      }),
    });
  } catch (error) {
    next(error);
  }
};

export const getAnnouncementById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) throw createError('Announcement not found', 404);

    res.json({
      success: true,
      data: { ...announcement.toJSON(), id: announcement._id },
    });
  } catch (error) {
    next(error);
  }
};

export const createAnnouncement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || !['SUPER_ADMIN', 'PLATFORM_ADMIN'].includes(req.user.role)) {
      throw createError('Not authorized', 403);
    }

    const { title } = req.body;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();

    const announcement = new Announcement({
      ...req.body,
      slug,
      authorId: req.user.userId,
    });

    await announcement.save();

    res.status(201).json({
      success: true,
      data: { ...announcement.toJSON(), id: announcement._id },
    });
  } catch (error) {
    next(error);
  }
};

export const updateAnnouncement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || !['SUPER_ADMIN', 'PLATFORM_ADMIN'].includes(req.user.role)) {
      throw createError('Not authorized', 403);
    }

    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!announcement) throw createError('Announcement not found', 404);

    res.json({
      success: true,
      data: { ...announcement.toJSON(), id: announcement._id },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAnnouncement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || !['SUPER_ADMIN', 'PLATFORM_ADMIN'].includes(req.user.role)) {
      throw createError('Not authorized', 403);
    }

    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) throw createError('Announcement not found', 404);

    res.json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const togglePin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user || !['SUPER_ADMIN', 'PLATFORM_ADMIN'].includes(req.user.role)) {
      throw createError('Not authorized', 403);
    }

    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) throw createError('Announcement not found', 404);

    announcement.isPinned = !announcement.isPinned;
    await announcement.save();

    res.json({
      success: true,
      data: { ...announcement.toJSON(), id: announcement._id },
    });
  } catch (error) {
    next(error);
  }
};

export const toggleLike = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) throw createError('Announcement not found', 404);

    const userIdStr = req.user!.userId;
    const index = announcement.likedByUsers.indexOf(userIdStr);

    if (index === -1) {
      announcement.likedByUsers.push(userIdStr);
      announcement.likesCount += 1;
    } else {
      announcement.likedByUsers.splice(index, 1);
      announcement.likesCount -= 1;
    }

    await announcement.save();

    res.json({
      success: true,
      data: { ...announcement.toJSON(), id: announcement._id },
    });
  } catch (error) {
    next(error);
  }
};

export const incrementViews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewsCount: 1 } },
      { new: true }
    );
    if (!announcement) throw createError('Announcement not found', 404);

    res.json({
      success: true,
      data: { ...announcement.toJSON(), id: announcement._id },
    });
  } catch (error) {
    next(error);
  }
};
