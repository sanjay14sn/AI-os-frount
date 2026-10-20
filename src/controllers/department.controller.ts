import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Department } from '../models/Department';
import { createError } from '../middleware/errorHandler';

export const getDepartments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const collegeId = req.query.collegeId || req.user?.tenantId;
    if (!collegeId) throw createError('College ID required', 400);

    let matchStage: any = {};
    if (collegeId !== 'college-1') {
      if (!mongoose.Types.ObjectId.isValid(collegeId as string)) {
        res.json({ success: true, data: [] });
        return;
      }
      matchStage = { collegeId: new mongoose.Types.ObjectId(collegeId as string) };
    }

    const departments = await Department.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: 'departmentId',
          as: 'studentDocs'
        }
      },
      {
        $addFields: {
          totalStudents: { $size: '$studentDocs' },
          eligibleStudents: {
            $size: {
              $filter: {
                input: '$studentDocs',
                as: 's',
                cond: { $eq: ['$$s.isEligible', true] }
              }
            }
          },
          placedStudents: {
            $size: {
              $filter: {
                input: '$studentDocs',
                as: 's',
                cond: { $eq: ['$$s.placementStatus', 'placed'] }
              }
            }
          }
        }
      },
      { $project: { studentDocs: 0 } }
    ]);

    const mapped = departments.map(d => {
      const eligible = d.eligibleStudents > 0 ? d.eligibleStudents : 0;
      const placementPercent = eligible > 0 ? Math.round((d.placedStudents / eligible) * 100) : 0;
      return {
        ...d,
        id: d._id.toString(),
        placementPercent
      };
    });

    res.json({ success: true, data: mapped });
  } catch (error) { next(error); }
};

export const getDepartmentById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departments = await Department.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: 'departmentId',
          as: 'studentDocs'
        }
      },
      {
        $addFields: {
          totalStudents: { $size: '$studentDocs' },
          eligibleStudents: {
            $size: {
              $filter: {
                input: '$studentDocs',
                as: 's',
                cond: { $eq: ['$$s.isEligible', true] }
              }
            }
          },
          placedStudents: {
            $size: {
              $filter: {
                input: '$studentDocs',
                as: 's',
                cond: { $eq: ['$$s.placementStatus', 'placed'] }
              }
            }
          }
        }
      },
      { $project: { studentDocs: 0 } }
    ]);

    if (!departments || departments.length === 0) throw createError('Department not found', 404);
    
    const doc = departments[0];
    const eligible = doc.eligibleStudents > 0 ? doc.eligibleStudents : 0;
    doc.placementPercent = eligible > 0 ? Math.round((doc.placedStudents / eligible) * 100) : 0;
    doc.id = doc._id.toString();
    
    res.json({ success: true, data: doc });
  } catch (error) { next(error); }
};

export const createDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const collegeId = req.body.collegeId || req.user?.tenantId;
    const eligible = req.body.eligibleStudents > 0 ? req.body.eligibleStudents : req.body.totalStudents || 0;
    const placed = req.body.placedStudents || 0;
    const placementPercent = eligible > 0 ? Math.round((placed / eligible) * 100) : 0;

    const dept = await Department.create({
      ...req.body,
      placementPercent,
      collegeId: new mongoose.Types.ObjectId(collegeId as string)
    });
    res.status(201).json({ success: true, data: dept, message: 'Department created' });
  } catch (error) { next(error); }
};

export const updateDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dept = await Department.findById(req.params.id);
    if (!dept) throw createError('Department not found', 404);
    Object.assign(dept, req.body);
    const eligible = dept.eligibleStudents > 0 ? dept.eligibleStudents : dept.totalStudents || 0;
    dept.placementPercent = eligible > 0 ? Math.round((dept.placedStudents / eligible) * 100) : 0;
    await dept.save();
    res.json({ success: true, data: dept });
  } catch (error) { next(error); }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const dept = await Department.findByIdAndDelete(req.params.id);
    if (!dept) throw createError('Department not found', 404);
    res.json({ success: true, message: 'Department deleted' });
  } catch (error) { next(error); }
};
