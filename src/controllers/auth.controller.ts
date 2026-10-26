import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { Student } from '../models/Student';
import { College } from '../models/College';
import { ensureCollegeCodes } from './college.controller';
import { Department } from '../models/Department';
import { tokenService } from '../services/token.service';
import { otpService, generateOtp, getOtpExpiry } from '../services/otp.service';
import { createError } from '../middleware/errorHandler';
import { env } from '../config/env';

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const registerStudentSchema = z.object({
  name: z.string().min(2, 'Full Name must be at least 2 characters').trim(),
  email: z.string().email('Please enter a valid email address').toLowerCase(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  collegeId: z.string().min(1, 'College is required'),
  departmentId: z.string().optional(),
  studentId: z.string().min(1, 'Roll No / USN is required').trim(),
  department: z.string().min(1, 'Department / Branch is required'),
  batch: z.string().min(4, 'Batch year is required'),
  degree: z.string().min(1, 'Degree is required'),
  cgpa: z.number().min(0, 'CGPA cannot be negative').max(10, 'CGPA cannot exceed 10.0'),
  collegeName: z.string().optional(),
  isIndividual: z.boolean().optional(),
  aadharNumber: z
    .string({ required_error: 'Aadhar Card Number is mandatory for KYC identity verification' })
    .transform((v) => v.replace(/\s+/g, ''))
    .refine((v) => /^\d{12}$/.test(v), {
      message: 'Aadhar Card Number must be exactly 12 digits',
    }),
  aadharCard: z.object({
    fileName: z.string(),
    fileUrl: z.string().min(1, 'Aadhar document is required'),
    fileSize: z.number().optional(),
    uploadedAt: z.string().optional(),
  }, { required_error: 'Aadhar Card document upload is mandatory for identity verification' }),
});

export const registerCollegeSchema = z.object({
  // College info
  collegeName: z.string().min(2, 'College name required').trim(),
  collegeCode: z.string().min(2, 'College code required').transform(v => v.toUpperCase()),
  city: z.string().min(1, 'City required'),
  state: z.string().min(1, 'State required'),
  phone: z.string().min(10, 'Phone required'),
  email: z.string().email('Invalid college email').toLowerCase(),
  // Admin user info
  adminName: z.string().min(2, 'Admin name required').trim(),
  adminEmail: z.string().email('Invalid admin email').toLowerCase(),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters'),
  tpoName: z.string().optional(),
  tpoEmail: z.string().email().optional(),
});

export const verifyOtpSchema = z.object({
  email: z.string().email().toLowerCase(),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const forgotPasswordOtpSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const resetPasswordOtpSchema = z.object({
  email: z.string().email().toLowerCase(),
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildUserResponse = (user: InstanceType<typeof User>, token: string) => ({
  user: {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId?.toString(),
    phone: user.phone,
    avatar: user.avatar,
    isActive: user.isActive,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  },
  token,
});

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user) {
      throw createError('Invalid email or password', 401);
    }

    if (!user.isActive) {
      throw createError('Account is deactivated. Contact support.', 403);
    }

    if (!user.isEmailVerified) {
      throw createError('Please verify your email first. Check your inbox.', 403);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw createError('Invalid email or password', 401);
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = tokenService.generateToken(
      user._id.toString(),
      user.role,
      user.tenantId?.toString()
    );

    const payload = buildUserResponse(user, token);
    if (user.tenantId && (user.role === 'TPO' || user.role === 'COLLEGE_ADMIN')) {
      await ensureCollegeCodes();
      const college = await College.findById(user.tenantId).select('name code');
      if (college) {
        Object.assign(payload.user, { collegeCode: college.code, collegeName: college.name });
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: payload,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/register/student
 * Creates User + Student profile, sends OTP for email verification
 */
export const registerStudent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.body as z.infer<typeof registerStudentSchema>;

    // Check if email already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      if (!existingUser.isEmailVerified) {
        // Re-send OTP & update profile credentials
        const otp = generateOtp();
        existingUser.name = data.name;
        existingUser.passwordHash = data.password; // hashed by pre-save hook
        existingUser.otpCode = otp;
        existingUser.otpExpiresAt = getOtpExpiry();
        existingUser.otpAttempts = 0;
        await existingUser.save();

        await Student.findOneAndUpdate(
          { userId: existingUser._id },
          {
            name: data.name,
            studentId: data.studentId,
            department: data.department,
            degree: data.degree,
            batch: data.batch,
            cgpa: data.cgpa,
            aadharNumber: data.aadharNumber,
            aadharCard: {
              fileName: data.aadharCard.fileName,
              fileUrl: data.aadharCard.fileUrl,
              fileSize: data.aadharCard.fileSize || 0,
              uploadedAt: new Date(),
            },
          }
        );

        await otpService.sendOtp(data.email, existingUser.name, otp);

        res.status(200).json({
          success: true,
          message: `Verification code resent to ${data.email}. Please verify your email.`,
          data: { requiresOtp: true, email: data.email },
        });
        return;
      }
      throw createError('Email already registered and verified. Please sign in.', 409);
    }

    // Validate college exists or fallback to individual/custom
    let college: any = null;
    if (data.collegeId && mongoose.Types.ObjectId.isValid(data.collegeId)) {
      college = await College.findById(data.collegeId);
    }
    if (!college && data.collegeId) {
      college = await College.findOne({
        $or: [
          { code: String(data.collegeId).trim().toUpperCase() },
          { name: new RegExp(`^${String(data.collegeId).trim()}$`, 'i') },
        ],
      });
    }
    if (!college) {
      college = await College.findOne({ code: 'INDIVIDUAL' });
    }
    if (!college) {
      college = await College.create({
        name: 'Independent / Individual Students',
        code: 'INDIVIDUAL',
        city: 'Global',
        state: 'General',
        country: 'India',
        phone: '1800-120-7522',
        email: 'support@aicampusintelligent.com',
        website: 'https://aicampusintelligent.com',
        establishedYear: 2024,
        affiliation: 'Direct Candidate Placement Registry',
        type: 'engineering',
        totalStudents: 1,
        tpoName: 'AI Placement Coordinator',
        tpoEmail: 'tpo@aicampusintelligent.com',
        departments: ['Computer Science (CSE)', 'Information Technology (IT)', 'Electronics (ECE)', 'Mechanical', 'General'],
        subscription: {
          plan: 'enterprise',
          status: 'active',
          expiresAt: new Date('2035-12-31'),
          studentsLimit: 1000000,
          studentsUsed: 1,
          aiCreditsLimit: 1000000,
          aiCreditsUsed: 0,
          recruitersLimit: 100000,
          recruitersUsed: 0,
          jobsLimit: 100000,
          jobsUsed: 0,
        },
      });
    }

    // Validate department exists or create fallback ObjectId
    let departmentIdObj: mongoose.Types.ObjectId;
    if (data.departmentId && mongoose.Types.ObjectId.isValid(data.departmentId)) {
      departmentIdObj = new mongoose.Types.ObjectId(data.departmentId);
    } else {
      departmentIdObj = new mongoose.Types.ObjectId();
    }

    const otp = generateOtp();

    // Create User
    const user = await User.create({
      email: data.email,
      passwordHash: data.password, // hashed by pre-save hook
      name: data.name,
      role: 'STUDENT',
      tenantId: college._id,
      phone: data.phone || '',
      isEmailVerified: false,
      otpCode: otp,
      otpExpiresAt: getOtpExpiry(),
    });

    // Create Student profile (linked to user)
    const cgpa = data.cgpa || 0;
    const studentRoll = data.studentId || `${college.code || 'STU'}${data.batch || '2025'}${data.department.substring(0, 2).toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;

    await Student.create({
      userId: user._id,
      collegeId: college._id,
      departmentId: departmentIdObj,
      studentId: studentRoll,
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      department: data.department,
      batch: data.batch,
      degree: data.degree,
      cgpa,
      isEligible: cgpa >= 6.5,
      placementStatus: 'not_placed',
      placementReadinessScore: 30,
      profileCompletion: data.aadharCard ? 45 : 35,
      preferredLocations: [],
      preferredRoles: [],
      expectedSalary: 0,
      skills: [],
      aadharNumber: data.aadharNumber ? String(data.aadharNumber).trim() : undefined,
      aadharCard: data.aadharCard ? {
        fileName: data.aadharCard.fileName || 'aadhar_card.pdf',
        fileUrl: data.aadharCard.fileUrl || '',
        fileSize: data.aadharCard.fileSize || 0,
        uploadedAt: data.aadharCard.uploadedAt || new Date(),
      } : undefined,
      certifications: [],
      projects: [],
      education: [
        {
          id: `edu-${Date.now()}`,
          level: 'graduation',
          institution: data.collegeName || (college.code === 'INDIVIDUAL' ? 'Independent Student' : college.name),
          degree: data.degree,
          specialization: data.department,
          score: cgpa,
          scoreType: 'cgpa',
          yearOfPassing: parseInt(data.batch) || 2025,
          location: college.city || 'India',
        },
      ],
      experience: [],
    });

    // Send Real OTP via Resend / SMTP
    await otpService.sendOtp(data.email, data.name, otp);

    res.status(201).json({
      success: true,
      message: `Verification code sent to ${data.email}. Please verify your email.`,
      data: { requiresOtp: true, email: data.email },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/register/college
 * Creates College + COLLEGE_ADMIN user
 */
export const registerCollege = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = req.body as z.infer<typeof registerCollegeSchema>;
    const collegeCode = String(data.collegeCode).toUpperCase();

    // Check admin email uniqueness
    const existingAdmin = await User.findOne({ email: data.adminEmail });
    if (existingAdmin) {
      throw createError('Admin email already registered', 409);
    }

    // Check college code uniqueness
    const existingCollege = await College.findOne({ code: collegeCode });
    if (existingCollege) {
      throw createError('College with this code already exists', 409);
    }

    // Create College
    const college = await College.create({
      name: data.collegeName,
      code: collegeCode,
      city: data.city,
      state: data.state,
      country: 'India',
      phone: data.phone,
      email: data.email,
      tpoName: data.tpoName || data.adminName,
      tpoEmail: data.tpoEmail || data.adminEmail,
      departments: [],
      totalStudents: 0,
      subscription: {
        plan: 'starter',
        status: 'trial',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day trial
        studentsLimit: 500,
        studentsUsed: 0,
        aiCreditsLimit: 1000,
        aiCreditsUsed: 0,
        recruitersLimit: 10,
        recruitersUsed: 0,
        jobsLimit: 50,
        jobsUsed: 0,
      },
    });

    const otp = generateOtp();

    // Create Admin User
    const adminUser = await User.create({
      email: String(data.adminEmail),
      passwordHash: String(data.adminPassword),
      name: String(data.adminName),
      role: 'COLLEGE_ADMIN',
      tenantId: college._id,
      isEmailVerified: false,
      otpCode: otp,
      otpExpiresAt: getOtpExpiry(),
    });

    await otpService.sendOtp(data.adminEmail, data.adminName, otp);

    res.status(201).json({
      success: true,
      message: `College "${data.collegeName}" registered. OTP sent to ${data.adminEmail}.`,
      data: {
        requiresOtp: true,
        email: data.adminEmail,
        collegeId: college._id.toString(),
        collegeName: college.name,
        adminId: adminUser._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/verify-otp
 * Verifies OTP and activates account, returns JWT
 */
export const verifyOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp } = req.body as z.infer<typeof verifyOtpSchema>;

    const user = await User.findOne({ email }).select('+otpCode +otpExpiresAt');
    if (!user) {
      throw createError('User not found', 404);
    }

    if (user.isEmailVerified) {
      throw createError('Email already verified. Please login.', 400);
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      throw createError('No OTP found. Please request a new one.', 400);
    }

    // Check max attempts
    if (user.otpAttempts >= env.otp.maxAttempts) {
      throw createError('Too many attempts. Please request a new OTP.', 429);
    }

    const result = otpService.verify(otp, user.otpCode, user.otpExpiresAt);

    if (!result.valid) {
      user.otpAttempts += 1;
      await user.save();
      throw createError(result.reason || 'Invalid OTP', 400);
    }

    // Activate account
    user.isEmailVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    user.lastLogin = new Date();
    await user.save();

    const token = tokenService.generateToken(
      user._id.toString(),
      user.role,
      user.tenantId?.toString()
    );

    const payload = buildUserResponse(user, token);
    if (user.tenantId) {
      const college = await College.findById(user.tenantId).select('name code');
      if (college) {
        Object.assign(payload.user, { collegeCode: college.code, collegeName: college.name });
      }
    }

    res.json({
      success: true,
      message: 'Email verified successfully! Welcome to AI Campus OS.',
      data: payload,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/resend-otp
 */
export const resendOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body as { email: string };

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      res.json({ success: true, message: 'If the email exists, a new OTP has been sent.' });
      return;
    }

    if (user.isEmailVerified) {
      throw createError('Email already verified.', 400);
    }

    const otp = generateOtp();
    user.otpCode = otp;
    user.otpExpiresAt = getOtpExpiry();
    user.otpAttempts = 0;
    await user.save();

    await otpService.sendOtp(email, user.name, otp);

    res.json({ success: true, message: 'New OTP sent successfully.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password
 */
export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body as z.infer<typeof forgotPasswordSchema>;

    const user = await User.findOne({ email });

    if (user) {
      const resetToken = tokenService.generateResetToken(user._id.toString());
      user.passwordResetToken = resetToken;
      user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      const resetUrl = `${env.clientOrigin}/reset-password?token=${resetToken}`;
      await otpService.sendPasswordReset(email, user.name, resetUrl);
    }

    // Always respond OK to prevent email enumeration
    res.json({
      success: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password
 */
export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, password } = req.body as z.infer<typeof resetPasswordSchema>;

    let userId: string;
    try {
      const decoded = tokenService.verifyResetToken(token);
      userId = decoded.userId;
    } catch {
      throw createError('Invalid or expired reset token', 400);
    }

    const user = await User.findById(userId).select('+passwordResetToken +passwordResetExpiresAt');
    if (!user || user.passwordResetToken !== token) {
      throw createError('Invalid or expired reset token', 400);
    }

    if (user.passwordResetExpiresAt && new Date() > user.passwordResetExpiresAt) {
      throw createError('Reset token has expired', 400);
    }

    user.passwordHash = password; // Will be hashed by pre-save hook
    user.passwordResetToken = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. You can now login.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/forgot-password-otp
 * Generates and sends a 6-digit OTP to the user's email via Resend
 */
export const forgotPasswordOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body as z.infer<typeof forgotPasswordOtpSchema>;

    const user = await User.findOne({ email });

    if (user) {
      const otp = generateOtp();
      user.otpCode = otp;
      user.otpExpiresAt = getOtpExpiry();
      user.otpAttempts = 0;
      await user.save();

      await otpService.sendOtp(email, user.name, otp);
    }

    res.json({
      success: true,
      message: 'If an account exists with that email, a 6-digit verification code has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/reset-password-otp
 * Verifies the 6-digit OTP and updates the password
 */
export const resetPasswordOtp = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, otp, password } = req.body as z.infer<typeof resetPasswordOtpSchema>;

    const user = await User.findOne({ email }).select('+otpCode +otpExpiresAt');
    if (!user) {
      throw createError('User not found', 404);
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      throw createError('No OTP found. Please request a new code.', 400);
    }

    const result = otpService.verify(otp, user.otpCode, user.otpExpiresAt);
    if (!result.valid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      throw createError(result.reason || 'Invalid verification code', 400);
    }

    // Set new password (will be hashed by pre-save hook)
    user.passwordHash = password;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully! You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user!.userId);
    if (!user) {
      throw createError('User not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId?.toString(),
        phone: user.phone,
        avatar: user.avatar,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/change-password
 */
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body as z.infer<typeof changePasswordSchema>;

    const user = await User.findById(req.user!.userId).select('+passwordHash');
    if (!user) {
      throw createError('User not found', 404);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw createError('Current password is incorrect', 400);
    }

    user.passwordHash = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    next(error);
  }
};
