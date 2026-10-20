import { Request, Response } from 'express';
import { Program } from '../models/Program';
import mongoose from 'mongoose';

export const getAllPrograms = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, audience, category, search } = req.query;

    const filter: mongoose.FilterQuery<typeof Program> = {};

    // Filter by role / targetAudience
    const target = (audience || role) as string | undefined;
    if (target && target !== 'ALL' && target !== 'SUPER_ADMIN') {
      const audienceConditions: Record<string, unknown>[] = [
        { targetAudience: 'ALL' },
        { targetAudience: target },
      ];
      if (target === 'TPO') {
        audienceConditions.push({ targetAudience: 'COLLEGE_ADMIN' });
      } else if (target === 'COLLEGE_ADMIN') {
        audienceConditions.push({ targetAudience: 'TPO' });
      }
      filter.$or = audienceConditions;
    }

    // Filter by category
    if (category && category !== 'ALL') {
      filter.category = String(category);
    }

    // Filter by search query
    if (search) {
      const regex = new RegExp(String(search), 'i');
      filter.title = regex;
    }

    const programs = await Program.find(filter).sort({ createdAt: -1 });
    res.json({
      success: true,
      data: programs.map(p => {
        const obj = p.toObject();
        return {
          ...obj,
          id: p._id.toString(),
          videos: p.videos.map((v, idx) => ({
            ...v,
            id: v._id ? v._id.toString() : `vid-${idx}`,
          })),
        };
      }),
    });
  } catch (error) {
    console.error('Error fetching programs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch video programs' });
  }
};

export const getProgramById = async (req: Request, res: Response): Promise<void> => {
  try {
    const program = await Program.findById(req.params.id);
    if (!program) {
      res.status(404).json({ success: false, message: 'Program not found' });
      return;
    }

    const obj = program.toObject();
    res.json({
      success: true,
      data: {
        ...obj,
        id: program._id.toString(),
        videos: program.videos.map((v, idx) => ({
          ...v,
          id: v._id ? v._id.toString() : `vid-${idx}`,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching program:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch video program' });
  }
};

export const createProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      title,
      subtitle,
      description,
      category,
      targetAudience,
      thumbnailUrl,
      instructorName,
      instructorTitle,
      instructorAvatar,
      isPublished,
      totalDuration,
      videosCount,
      videos,
      tags,
    } = req.body;

    if (!title || !description || !thumbnailUrl) {
      res.status(400).json({ success: false, message: 'Title, description and thumbnail URL are required' });
      return;
    }

    const newProgram = await Program.create({
      title,
      subtitle: subtitle || title,
      description,
      category: category || 'Placement Training',
      targetAudience: Array.isArray(targetAudience) ? targetAudience : ['STUDENT'],
      thumbnailUrl,
      instructorName: instructorName || 'Super Admin Team',
      instructorTitle: instructorTitle || 'PlacementOS Director',
      instructorAvatar: instructorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      isPublished: isPublished !== undefined ? Boolean(isPublished) : true,
      totalDuration: totalDuration || '1h 00m',
      videosCount: Array.isArray(videos) ? videos.length : (videosCount || 0),
      videos: Array.isArray(videos) ? videos : [],
      enrolledCount: 1,
      rating: 5.0,
      tags: Array.isArray(tags) ? tags : [category || 'Placement Training'],
    });

    const obj = newProgram.toObject();
    res.status(201).json({
      success: true,
      message: 'Video program created successfully',
      data: {
        ...obj,
        id: newProgram._id.toString(),
        videos: newProgram.videos.map((v, idx) => ({
          ...v,
          id: v._id ? v._id.toString() : `vid-${idx}`,
        })),
      },
    });
  } catch (error) {
    console.error('Error creating program:', error);
    res.status(500).json({ success: false, message: 'Failed to create video program' });
  }
};

export const updateProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.videos && Array.isArray(updates.videos)) {
      updates.videosCount = updates.videos.length;
    }

    const updatedProgram = await Program.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!updatedProgram) {
      res.status(404).json({ success: false, message: 'Program not found' });
      return;
    }

    const obj = updatedProgram.toObject();
    res.json({
      success: true,
      message: 'Video program updated successfully',
      data: {
        ...obj,
        id: updatedProgram._id.toString(),
        videos: updatedProgram.videos.map((v, idx) => ({
          ...v,
          id: v._id ? v._id.toString() : `vid-${idx}`,
        })),
      },
    });
  } catch (error) {
    console.error('Error updating program:', error);
    res.status(500).json({ success: false, message: 'Failed to update video program' });
  }
};

export const deleteProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await Program.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ success: false, message: 'Program not found' });
      return;
    }

    res.json({ success: true, message: 'Video program deleted successfully' });
  } catch (error) {
    console.error('Error deleting program:', error);
    res.status(500).json({ success: false, message: 'Failed to delete video program' });
  }
};

export const togglePublishProgram = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const program = await Program.findById(id);
    if (!program) {
      res.status(404).json({ success: false, message: 'Program not found' });
      return;
    }

    program.isPublished = !program.isPublished;
    await program.save();

    const obj = program.toObject();
    res.json({
      success: true,
      message: `Program status changed to ${program.isPublished ? 'Published' : 'Draft'}`,
      data: {
        ...obj,
        id: program._id.toString(),
      },
    });
  } catch (error) {
    console.error('Error toggling publish status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle publish status' });
  }
};
