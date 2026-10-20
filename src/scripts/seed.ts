import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db';
import { User } from '../models/User';
import { College } from '../models/College';
import { Department } from '../models/Department';
import { Student } from '../models/Student';
import { Company } from '../models/Company';
import { Job } from '../models/Job';
import { Program } from '../models/Program';
import { Interview } from '../models/Interview';
import { seedRichStudents } from './seed_rich_students';

const DEMO_PASSWORD = 'password123';

const seed = async () => {
  console.log('\n🌱 Starting database seed...\n');

  await connectDB();

  // Clear existing data (dev only)
  console.log('🗑️  Clearing existing data...');
  await Promise.all([
    User.deleteMany({}),
    College.deleteMany({}),
    Department.deleteMany({}),
    Student.deleteMany({}),
    Company.deleteMany({}),
    Job.deleteMany({}),
    Program.deleteMany({}),
    Interview.deleteMany({}),
  ]);

  // ─── 1. Create Colleges ─────────────────────────────────────────────────

  console.log('🏛️  Creating colleges...');

  const college1 = await College.create({
    name: 'RV College of Engineering',
    code: 'RVCE',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    phone: '080-67178001',
    email: 'info@rvce.edu.in',
    website: 'https://www.rvce.edu.in',
    establishedYear: 1963,
    affiliation: 'VTU',
    type: 'engineering',
    totalStudents: 4200,
    tpoName: 'Dr. Ramesh Kumar',
    tpoEmail: 'tpo@rvce.edu.in',
    departments: ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'Civil'],
    subscription: {
      plan: 'professional',
      status: 'active',
      expiresAt: new Date('2025-12-31'),
      studentsLimit: 5000,
      studentsUsed: 4200,
      aiCreditsLimit: 5000,
      aiCreditsUsed: 1240,
      recruitersLimit: 50,
      recruitersUsed: 23,
      jobsLimit: 200,
      jobsUsed: 87,
    },
    isActive: true,
  });

  const college2 = await College.create({
    name: 'Sona College of Technology',
    code: 'SCT',
    city: 'Salem',
    state: 'Tamil Nadu',
    country: 'India',
    phone: '0427-4099999',
    email: 'info@sonatech.ac.in',
    establishedYear: 1998,
    affiliation: 'Anna University',
    type: 'engineering',
    totalStudents: 3800,
    tpoName: 'Prof. Anitha Rajan',
    tpoEmail: 'tpo@sonatech.ac.in',
    departments: ['CSE', 'ECE', 'ME', 'EEE'],
    subscription: {
      plan: 'starter',
      status: 'trial',
      expiresAt: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      studentsLimit: 500,
      studentsUsed: 120,
      aiCreditsLimit: 1000,
      aiCreditsUsed: 89,
      recruitersLimit: 10,
      recruitersUsed: 3,
      jobsLimit: 50,
      jobsUsed: 12,
    },
    isActive: true,
  });

  // ─── 2. Create Departments ──────────────────────────────────────────────

  console.log('📚 Creating departments...');

  const depts = await Department.insertMany([
    { collegeId: college1._id, name: 'Computer Science & Engineering', code: 'CSE', hod: 'Dr. Priya Sharma', totalStudents: 420, eligibleStudents: 380, placedStudents: 312, placementPercent: 82, avgPackage: 1200000, topSkills: ['Java', 'Python', 'React', 'Spring Boot'], activeJobs: 18 },
    { collegeId: college1._id, name: 'Information Science & Engineering', code: 'ISE', hod: 'Dr. Ramesh Babu', totalStudents: 360, eligibleStudents: 320, placedStudents: 265, placementPercent: 83, avgPackage: 1100000, topSkills: ['Python', 'ML', 'Node.js', 'SQL'], activeJobs: 14 },
    { collegeId: college1._id, name: 'Electronics & Communication Engineering', code: 'ECE', hod: 'Dr. Lakshmi Patel', totalStudents: 380, eligibleStudents: 330, placedStudents: 228, placementPercent: 69, avgPackage: 900000, topSkills: ['VLSI', 'Embedded C', 'Python', 'Signal Processing'], activeJobs: 10 },
    { collegeId: college1._id, name: 'Electrical & Electronics Engineering', code: 'EEE', hod: 'Prof. Suresh Kumar', totalStudents: 320, eligibleStudents: 270, placedStudents: 189, placementPercent: 70, avgPackage: 850000, topSkills: ['MATLAB', 'Power Systems', 'PLC', 'AutoCAD'], activeJobs: 6 },
    { collegeId: college1._id, name: 'Mechanical Engineering', code: 'ME', hod: 'Dr. Arun Pillai', totalStudents: 280, eligibleStudents: 220, placedStudents: 143, placementPercent: 65, avgPackage: 750000, topSkills: ['AutoCAD', 'SolidWorks', 'ANSYS', 'CNC'], activeJobs: 5 },
  ]);

  const [cse, ise, ece, eee, me] = depts;

  // ─── 3. Create Users + Students ─────────────────────────────────────────

  console.log('👥 Creating demo users...');

  // Super Admin
  const superAdmin = await User.create({
    email: 'admin@placementos.ai',
    passwordHash: DEMO_PASSWORD,
    name: 'Platform Admin',
    role: 'SUPER_ADMIN',
    isEmailVerified: true,
    isActive: true,
  });

  // College Admin (TPO)
  const collegeAdmin = await User.create({
    email: 'tpo@rvce.edu.in',
    passwordHash: DEMO_PASSWORD,
    name: 'Dr. Ramesh Kumar',
    role: 'COLLEGE_ADMIN',
    tenantId: college1._id,
    isEmailVerified: true,
    isActive: true,
  });

  // TPO User
  const tpoUser = await User.create({
    email: 'tpo2@rvce.edu.in',
    passwordHash: DEMO_PASSWORD,
    name: 'Mrs. Kavitha Srinivasan',
    role: 'TPO',
    tenantId: college1._id,
    isEmailVerified: true,
    isActive: true,
  });

  // Recruiter
  const recruiterUser = await User.create({
    email: 'hr@infosys.com',
    passwordHash: DEMO_PASSWORD,
    name: 'Ankit Gupta',
    role: 'RECRUITER',
    isEmailVerified: true,
    isActive: true,
  });

  // Student User
  const studentUser = await User.create({
    email: 'arjun.sharma@rvce.edu.in',
    passwordHash: DEMO_PASSWORD,
    name: 'Arjun Sharma',
    role: 'STUDENT',
    tenantId: college1._id,
    isEmailVerified: true,
    isActive: true,
  });

  // Create Student Profile
  const arjunStudent = await Student.create({
    userId: studentUser._id,
    collegeId: college1._id,
    departmentId: cse._id,
    studentId: '1RV21CS123',
    name: 'Arjun Sharma',
    email: 'arjun.sharma@rvce.edu.in',
    phone: '9876543210',
    department: 'CSE',
    batch: '2025',
    degree: 'B.E.',
    cgpa: 8.7,
    backlogs: 0,
    gender: 'male',
    address: { city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    skills: ['Java', 'Spring Boot', 'React', 'TypeScript', 'SQL', 'Git', 'Docker', 'REST API'],
    certifications: [
      { id: 'cert-1', name: 'AWS Cloud Practitioner', issuer: 'Amazon Web Services', issueDate: '2024-06-15' },
      { id: 'cert-2', name: 'Oracle Java SE 11', issuer: 'Oracle', issueDate: '2024-03-10' },
    ],
    projects: [
      {
        id: 'proj-1',
        title: 'AI-Powered Resume Analyzer',
        description: 'Built a React + FastAPI application that uses OpenAI to analyze resumes and suggest improvements',
        technologies: ['React', 'Python', 'FastAPI', 'OpenAI', 'MongoDB'],
        githubUrl: 'https://github.com/arjun/resume-ai',
        duration: '3 months',
        highlights: ['Reduced resume scan time by 70%', 'Achieved 85% ATS match accuracy'],
      },
      {
        id: 'proj-2',
        title: 'E-Commerce Microservices Backend',
        description: 'Designed and implemented a microservices architecture with Spring Boot',
        technologies: ['Java', 'Spring Boot', 'Docker', 'Kubernetes', 'MySQL'],
        githubUrl: 'https://github.com/arjun/ecom-backend',
        duration: '4 months',
        highlights: ['Handled 10K+ concurrent requests', 'Reduced API latency by 40%'],
      },
    ],
    education: [
      {
        id: 'edu-1',
        level: 'graduation',
        institution: 'RV College of Engineering',
        degree: 'B.E.',
        specialization: 'Computer Science & Engineering',
        score: 8.7,
        scoreType: 'cgpa',
        yearOfPassing: 2025,
        location: 'Bengaluru',
      },
      {
        id: 'edu-2',
        level: 'puc',
        institution: 'Delhi Public School',
        degree: 'PUC (12th)',
        score: 94.5,
        scoreType: 'percentage',
        yearOfPassing: 2021,
        location: 'Bengaluru',
      },
    ],
    experience: [
      {
        id: 'exp-1',
        company: 'Amazon',
        role: 'Software Development Intern',
        type: 'internship',
        startDate: '2024-05-01',
        endDate: '2024-07-31',
        isCurrent: false,
        description: 'Worked on Prime Video recommendations using ML and distributed systems.',
        skills: ['Python', 'AWS Lambda', 'DynamoDB'],
      },
    ],
    profileCompletion: 88,
    placementStatus: 'not_placed',
    isEligible: true,
    placementReadinessScore: 84,
    linkedIn: 'https://linkedin.com/in/arjun-sharma-dev',
    github: 'https://github.com/arjun',
    preferredLocations: ['Bengaluru', 'Hyderabad', 'Mumbai'],
    preferredRoles: ['Software Engineer', 'Backend Developer', 'Full Stack Developer'],
    expectedSalary: 1200000,
  });

  // Create more students
  const studentNames = [
    { name: 'Priya Nair', email: 'priya.nair@rvce.edu.in', cgpa: 9.1, dept: 'CSE', deptId: cse._id },
    { name: 'Rohan Verma', email: 'rohan.verma@rvce.edu.in', cgpa: 8.4, dept: 'CSE', deptId: cse._id },
    { name: 'Anjali Singh', email: 'anjali.singh@rvce.edu.in', cgpa: 7.9, dept: 'ISE', deptId: ise._id },
    { name: 'Karthik Reddy', email: 'karthik.reddy@rvce.edu.in', cgpa: 8.8, dept: 'ISE', deptId: ise._id },
    { name: 'Sneha Patel', email: 'sneha.patel@rvce.edu.in', cgpa: 7.2, dept: 'ECE', deptId: ece._id },
    { name: 'Aditya Kumar', email: 'aditya.kumar@rvce.edu.in', cgpa: 9.3, dept: 'CSE', deptId: cse._id },
    { name: 'Meera Krishnan', email: 'meera.k@rvce.edu.in', cgpa: 6.8, dept: 'ECE', deptId: ece._id },
    { name: 'Vikram Shah', email: 'vikram.shah@rvce.edu.in', cgpa: 8.2, dept: 'ISE', deptId: ise._id },
    { name: 'Suresh Kumar', email: 'suresh.k@rvce.edu.in', cgpa: 8.5, dept: 'EEE', deptId: eee._id },
    { name: 'Divya M', email: 'divya.m@rvce.edu.in', cgpa: 7.8, dept: 'EEE', deptId: eee._id },
    { name: 'Manoj Sharma', email: 'manoj.s@rvce.edu.in', cgpa: 8.1, dept: 'ME', deptId: me._id },
    { name: 'Rahul Gowda', email: 'rahul.g@rvce.edu.in', cgpa: 7.4, dept: 'ME', deptId: me._id, isPrivate: true },
  ];

  for (const s of studentNames) {
    const u = await User.create({
      email: s.email,
      passwordHash: DEMO_PASSWORD,
      name: s.name,
      role: 'STUDENT',
      tenantId: college1._id,
      isEmailVerified: true,
      isActive: true,
    });
    await Student.create({
      userId: u._id,
      collegeId: college1._id,
      departmentId: s.deptId,
      studentId: `1RV21${s.dept}${Math.floor(100 + Math.random() * 900)}`,
      name: s.name,
      email: s.email,
      phone: `9${Math.floor(100000000 + Math.random() * 900000000)}`,
      department: s.dept,
      batch: '2025',
      degree: 'B.E.',
      cgpa: s.cgpa,
      backlogs: s.cgpa < 7 ? 1 : 0,
      gender: ['male', 'female'][Math.floor(Math.random() * 2)] as 'male' | 'female',
      address: { city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
      skills: ['Java', 'Python', 'SQL'].slice(0, Math.floor(Math.random() * 3) + 1),
      certifications: [],
      projects: [],
      education: [],
      experience: [],
      profileCompletion: 40 + Math.floor(Math.random() * 50),
      placementStatus: Math.random() > 0.7 ? 'placed' : 'not_placed',
      isEligible: s.cgpa >= 6.5,
      placementReadinessScore: Math.floor(50 + Math.random() * 45),
      preferredLocations: ['Bengaluru'],
      preferredRoles: ['Software Engineer'],
      expectedSalary: 800000,
      isProfilePublic: !(s as any).isPrivate,
    });
  }

  // ─── 3b. Seed Rich Student Profiles ───────────────────────────────────
  await seedRichStudents();

  // ─── 4. Create Companies ────────────────────────────────────────────────

  console.log('🏢 Creating companies...');

  const infosys = await Company.create({
    name: 'Infosys',
    industry: 'Information Technology',
    type: 'service',
    hq: 'Bengaluru',
    size: 'enterprise',
    description: 'Global leader in technology and consulting',
    website: 'https://www.infosys.com',
    founded: 1981,
    techStack: ['Java', 'Spring Boot', 'Python', 'React', 'AWS'],
    activeJobs: 5,
    totalHired: 45,
    avgPackage: 700000,
    highestPackage: 1200000,
    isActive: true,
    isTied: true,
    colleges: [college1._id],
  });

  const google = await Company.create({
    name: 'Google',
    industry: 'Technology',
    type: 'product',
    hq: 'Bengaluru',
    size: 'enterprise',
    description: 'Technology giant leading innovation in search, cloud, and AI',
    website: 'https://careers.google.com',
    founded: 1998,
    techStack: ['Go', 'Python', 'C++', 'Java', 'TensorFlow', 'Kubernetes'],
    activeJobs: 3,
    totalHired: 12,
    avgPackage: 3500000,
    highestPackage: 6000000,
    isActive: true,
    isTied: true,
    colleges: [college1._id],
  });

  const wipro = await Company.create({
    name: 'Wipro Technologies',
    industry: 'Information Technology',
    type: 'service',
    hq: 'Bengaluru',
    size: 'enterprise',
    description: 'Leading global IT and consulting services company',
    website: 'https://www.wipro.com',
    founded: 1945,
    techStack: ['Java', '.NET', 'Python', 'Salesforce', 'Azure'],
    activeJobs: 4,
    totalHired: 38,
    avgPackage: 650000,
    highestPackage: 1100000,
    isActive: true,
    isTied: true,
    colleges: [college1._id],
  });

  // ─── 5. Create Jobs ─────────────────────────────────────────────────────

  console.log('💼 Creating jobs...');

  await Job.insertMany([
    {
      companyId: infosys._id,
      recruiterId: recruiterUser._id,
      title: 'Systems Engineer',
      description: 'Join Infosys as a Systems Engineer and work on enterprise-grade applications.',
      responsibilities: ['Develop and maintain Java-based applications', 'Participate in Agile sprints', 'Code review and testing'],
      requirements: ['Strong Java fundamentals', 'Knowledge of Spring Framework', 'Good communication skills'],
      type: 'fulltime',
      location: 'Bengaluru',
      isRemote: false,
      salaryMin: 600000,
      salaryMax: 800000,
      experience: 'Fresher',
      openings: 50,
      status: 'active',
      eligibility: {
        minCgpa: 6.5,
        maxBacklogs: 0,
        branches: ['CSE', 'ISE', 'ECE', 'EEE', 'ME'],
        degree: ['B.E.', 'B.Tech'],
        graduationYear: [2025],
      },
      skills: ['Java', 'Spring Boot', 'SQL', 'Git'],
      niceToHave: ['AWS', 'Docker'],
      benefits: ['Health Insurance', 'PF', 'Annual Bonus'],
      applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      collegeIds: [college1._id],
      stats: { eligible: 380, applied: 0, shortlisted: 0, interviewed: 0, selected: 0 },
      pipeline: [
        { id: 'p1', name: 'Application Review', order: 1, type: 'application' },
        { id: 'p2', name: 'Online Assessment', order: 2, type: 'assessment' },
        { id: 'p3', name: 'Technical Interview', order: 3, type: 'technical' },
        { id: 'p4', name: 'HR Round', order: 4, type: 'hr' },
      ],
    },
    {
      companyId: google._id,
      recruiterId: recruiterUser._id,
      title: 'Software Development Engineer',
      description: 'Work on some of the world\'s most impactful products at Google.',
      responsibilities: ['Design scalable systems', 'Write clean, efficient code', 'Collaborate with cross-functional teams'],
      requirements: ['Strong DSA', 'System Design', 'Proficiency in any one of Go/Java/C++/Python'],
      type: 'fulltime',
      location: 'Bengaluru',
      isRemote: false,
      salaryMin: 2500000,
      salaryMax: 5000000,
      experience: 'Fresher - 2 years',
      openings: 5,
      status: 'active',
      eligibility: {
        minCgpa: 8.0,
        maxBacklogs: 0,
        branches: ['CSE', 'ISE'],
        degree: ['B.E.', 'B.Tech', 'M.Tech'],
        graduationYear: [2025],
      },
      skills: ['Data Structures', 'Algorithms', 'System Design', 'Go', 'Python'],
      niceToHave: ['Competitive Programming', 'Open Source Contributions', 'Machine Learning'],
      benefits: ['Stock Options', 'World-class Perks', 'Free Meals', 'Health Insurance'],
      applicationDeadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      collegeIds: [college1._id],
      stats: { eligible: 85, applied: 0, shortlisted: 0, interviewed: 0, selected: 0 },
      pipeline: [
        { id: 'p1', name: 'Resume Screening', order: 1, type: 'application' },
        { id: 'p2', name: 'Online Coding Test', order: 2, type: 'assessment' },
        { id: 'p3', name: 'Technical Round 1', order: 3, type: 'technical' },
        { id: 'p4', name: 'Technical Round 2', order: 4, type: 'technical' },
        { id: 'p5', name: 'Googleyness & Leadership', order: 5, type: 'hr' },
      ],
    },
    {
      companyId: wipro._id,
      recruiterId: recruiterUser._id,
      title: 'Project Engineer',
      description: 'Kickstart your career at Wipro as a Project Engineer.',
      responsibilities: ['Develop software solutions', 'Work in client projects', 'Maintain documentation'],
      requirements: ['Good programming skills', 'Teamwork', 'Willingness to learn'],
      type: 'fulltime',
      location: 'Pune, Hyderabad, Chennai',
      isRemote: false,
      salaryMin: 550000,
      salaryMax: 720000,
      experience: 'Fresher',
      openings: 80,
      status: 'active',
      eligibility: {
        minCgpa: 6.0,
        maxBacklogs: 2,
        branches: ['CSE', 'ISE', 'ECE', 'EEE', 'ME', 'Civil'],
        degree: ['B.E.', 'B.Tech', 'MCA'],
        graduationYear: [2025],
      },
      skills: ['Java', 'Python', '.NET', 'SQL'],
      niceToHave: ['Salesforce', 'Azure'],
      benefits: ['Health Insurance', 'Learning Budget', 'Flexible Work'],
      applicationDeadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      collegeIds: [college1._id],
      stats: { eligible: 550, applied: 0, shortlisted: 0, interviewed: 0, selected: 0 },
      pipeline: [
        { id: 'p1', name: 'Application', order: 1, type: 'application' },
        { id: 'p2', name: 'WILP Written Test', order: 2, type: 'assessment' },
        { id: 'p3', name: 'Technical + HR', order: 3, type: 'hr' },
      ],
    },
  ]);

  // ─── 6. Create Video Programs ───────────────────────────────────────────

  console.log('🎥 Creating video programs...');

  await Program.insertMany([
    {
      title: 'A-Z Placement Prep & Technical Interview Masterclass',
      subtitle: 'Complete roadmap to crack Tier-1 product & service tech interviews',
      description: 'Master Data Structures & Algorithms, System Design basics, Core CS fundamentals (OS, DBMS, CN), and Live Coding interviews curated specifically for campus placements.',
      category: 'Placement Training',
      targetAudience: ['STUDENT'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
      instructorName: 'Vikramaditya Sharma',
      instructorTitle: 'Ex-Google SDE & Chief Technical Educator',
      instructorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      isPublished: true,
      totalDuration: '4h 45m',
      videosCount: 4,
      enrolledCount: 1420,
      rating: 4.9,
      tags: ['DSA', 'System Design', 'Technical Interview', 'Coding'],
      videos: [
        {
          order: 1,
          title: 'Mastering Coding Interviews & DSA Patterns',
          description: 'Two pointers, sliding window, binary search, and dynamic programming patterns commonly asked in campus online tests.',
          duration: '45:00',
          videoUrl: 'https://www.youtube.com/embed/1uF7oP33-9w',
          resources: [
            { title: 'Top 50 DSA Cheat Sheet (PDF)', type: 'pdf', url: '#', size: '2.4 MB' },
            { title: 'Python & C++ Starter Code', type: 'code', url: '#', size: '1.1 MB' }
          ]
        },
        {
          order: 2,
          title: 'System Design Basics for Undergraduates',
          description: 'Understand Scalability, Load Balancers, Caching, Databases (SQL vs NoSQL), and Microservices for technical rounds.',
          duration: '58:30',
          videoUrl: 'https://www.youtube.com/embed/bUHFg8CZFuc',
          resources: [
            { title: 'System Design Architecture Diagrams', type: 'ppt', url: '#', size: '4.8 MB' }
          ]
        },
        {
          order: 3,
          title: 'DBMS & SQL Live Queries Workout',
          description: 'Joins, Subqueries, Indexing, ACID Properties, and normalization scenario-based questions.',
          duration: '50:15',
          videoUrl: 'https://www.youtube.com/embed/HXV3zeQKqGY',
          resources: [
            { title: 'Top SQL Interview Questions & Scripts', type: 'doc', url: '#', size: '850 KB' }
          ]
        },
        {
          order: 4,
          title: 'HR Round Playbook & Behavioral Questions',
          description: 'How to answer "Tell me about yourself", STAR method scenarios, salary expectations, and confidence building.',
          duration: '40:00',
          videoUrl: 'https://www.youtube.com/embed/y8YH0Qbu5hU',
          resources: [
            { title: 'Behavioral Answer Framework Worksheet', type: 'pdf', url: '#', size: '1.5 MB' }
          ]
        }
      ]
    },
    {
      title: 'ATS Resume Masterclass & Portfolio Accelerator',
      subtitle: 'Pass AI resume screeners and land 3x more interview callbacks',
      description: 'Learn how ATS parsers rank candidate resumes, how to format bullet points with impact metrics, and how to build high-scoring GitHub portfolios.',
      category: 'Career Advice',
      targetAudience: ['STUDENT'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&auto=format&fit=crop&q=80',
      instructorName: 'Neha Kapoor',
      instructorTitle: 'Senior Talent Acquisition Specialist',
      instructorAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
      isPublished: true,
      totalDuration: '2h 15m',
      videosCount: 3,
      enrolledCount: 980,
      rating: 4.8,
      tags: ['Resume', 'ATS', 'Portfolio', 'Job Search'],
      videos: [
        {
          order: 1,
          title: 'Deconstructing ATS Algorithms & Formatting',
          description: 'Font choices, column structures, keywords optimization, and avoiding common ATS parser pitfalls.',
          duration: '35:00',
          videoUrl: 'https://www.youtube.com/embed/y8YH0Qbu5hU',
          resources: [
            { title: 'LaTeX & Word ATS Clean Templates', type: 'doc', url: '#', size: '3.2 MB' }
          ]
        },
        {
          order: 2,
          title: 'Action Verbs & Impact Metrics Writing',
          description: 'Transforming boring duty statements into high-impact bullet points with numbers and results.',
          duration: '45:00',
          videoUrl: 'https://www.youtube.com/embed/1uF7oP33-9w',
          resources: [
            { title: '100+ High-Impact Action Verbs Bank', type: 'pdf', url: '#', size: '600 KB' }
          ]
        },
        {
          order: 3,
          title: 'Building a Standout GitHub & Portfolio Site',
          description: 'README formatting, live deployments, project documentation, and showcasing full-stack applications.',
          duration: '55:00',
          videoUrl: 'https://www.youtube.com/embed/bUHFg8CZFuc',
        }
      ]
    },
    {
      title: 'Campus Placement Strategy 2026 & Corporate Relations',
      subtitle: 'Strategic playbook for TPOs to maximize corporate tie-ups and student placement rates',
      description: 'Learn how top-tier universities streamline campus drives, invite marquee tech firms, manage multi-round virtual interviews, and boost average CTC packages.',
      category: 'TPO Orientation',
      targetAudience: ['COLLEGE_ADMIN', 'TPO'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80',
      instructorName: 'Dr. Ramesh Sundaram',
      instructorTitle: 'Director of Corporate Relations & Placement Veteran',
      instructorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
      isPublished: true,
      totalDuration: '3h 30m',
      videosCount: 3,
      enrolledCount: 340,
      rating: 5.0,
      tags: ['TPO Strategy', 'Campus Drives', 'Corporate Relations', 'Placement OS'],
      videos: [
        {
          order: 1,
          title: 'Automating Campus Drive Logistics on PlacementOS',
          description: 'Creating job listings, batch eligibility criteria, automated shortlisting, and real-time candidate notifications.',
          duration: '50:00',
          videoUrl: 'https://www.youtube.com/embed/1uF7oP33-9w',
          resources: [
            { title: 'TPO Placement Operating SOP (PDF)', type: 'pdf', url: '#', size: '5.1 MB' }
          ]
        },
        {
          order: 2,
          title: 'Corporate Engagement & MoU Signings Guide',
          description: 'Outreach strategies to invite global MNCs, startups, and PSUs for early-bird recruitment slots.',
          duration: '1h 10m',
          videoUrl: 'https://www.youtube.com/embed/bUHFg8CZFuc',
          resources: [
            { title: 'Corporate Outreach Email & Deck Templates', type: 'ppt', url: '#', size: '8.4 MB' }
          ]
        },
        {
          order: 3,
          title: 'Student Readiness Analytics & Intervention',
          description: 'Using AI Placement Readiness metrics to identify at-risk students and run targeted bootcamp interventions.',
          duration: '45:00',
          videoUrl: 'https://www.youtube.com/embed/HXV3zeQKqGY',
        }
      ]
    },
    {
      title: 'TPO Operational Excellence & Legal Norms',
      subtitle: 'Offer policies, dual placement rules, and student compliance management',
      description: 'Guidelines on crafting transparent placement policies, handling dream vs non-dream company offers, and managing student disciplinary codes.',
      category: 'Policy & Compliance',
      targetAudience: ['COLLEGE_ADMIN', 'TPO'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&auto=format&fit=crop&q=80',
      instructorName: 'Prof. Anjali Mehta',
      instructorTitle: 'Head of Placement Cell & Institutional Policy Advisor',
      instructorAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
      isPublished: true,
      totalDuration: '1h 45m',
      videosCount: 2,
      enrolledCount: 290,
      rating: 4.9,
      tags: ['Placement Policy', 'Compliance', 'TPO Guidelines'],
      videos: [
        {
          order: 1,
          title: 'Drafting Standardized Placement Policy Documents',
          description: 'Defining One Student One Job rules, PPO acceptance criteria, and penalty clauses for non-attendance.',
          duration: '45:00',
          videoUrl: 'https://www.youtube.com/embed/y8YH0Qbu5hU',
          resources: [
            { title: 'Sample College Placement Policy Template', type: 'doc', url: '#', size: '1.2 MB' }
          ]
        },
        {
          order: 2,
          title: 'Conflict Resolution & Offer Letter Auditing',
          description: 'Handling joining date delays, bond verification, and background checks smoothly.',
          duration: '1h 00m',
          videoUrl: 'https://www.youtube.com/embed/1uF7oP33-9w',
        }
      ]
    },
    {
      title: 'High-Velocity Campus Hiring & AI Candidate Screening',
      subtitle: 'Streamline bulk campus drives, automated assessments, and speed interviews',
      description: 'Best practices for corporate hiring teams to post multi-tier job descriptions, conduct AI-driven resume screening, and manage candidate pipelines efficiently.',
      category: 'Corporate Hiring',
      targetAudience: ['RECRUITER'],
      thumbnailUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=800&auto=format&fit=crop&q=80',
      instructorName: 'Sanjay Deshmukh',
      instructorTitle: 'VP of Talent Acquisition, TechCorp',
      instructorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      isPublished: true,
      totalDuration: '2h 40m',
      videosCount: 3,
      enrolledCount: 510,
      rating: 4.9,
      tags: ['Recruitment', 'AI Screening', 'Campus Drives', 'Interview Panel'],
      videos: [
        {
          order: 1,
          title: 'Optimizing Job Criteria & AI Match Score Thresholds',
          description: 'How to configure CGPA, branch, and skill filters on PlacementOS to automatically surface top 5% talent.',
          duration: '45:00',
          videoUrl: 'https://www.youtube.com/embed/bUHFg8CZFuc',
          resources: [
            { title: 'Recruiter Playbook for Campus Hiring', type: 'pdf', url: '#', size: '3.9 MB' }
          ]
        },
        {
          order: 2,
          title: 'Conducting Structured Technical & HR Panel Rounds',
          description: 'Standardized scorecards, reducing interviewer bias, and automated candidate feedback submission.',
          duration: '55:00',
          videoUrl: 'https://www.youtube.com/embed/HXV3zeQKqGY',
        },
        {
          order: 3,
          title: 'Employer Branding on University Portals',
          description: 'Showcasing tech stack, company culture, employee benefits, and internship stipends to attract top talent.',
          duration: '40:00',
          videoUrl: 'https://www.youtube.com/embed/y8YH0Qbu5hU',
          resources: [
            { title: 'Employer Brand Media Guidelines', type: 'ppt', url: '#', size: '6.2 MB' }
          ]
        }
      ]
    }
  ]);

  console.log('\n✅ Seed completed successfully!\n');
  console.log('─────────────────────────────────────────────');
  console.log('  Demo Accounts (password: password123)');
  console.log('─────────────────────────────────────────────');
  console.log(`  👑 Super Admin   : admin@placementos.ai`);
  console.log(`  🏛️  College Admin : tpo@rvce.edu.in`);
  console.log(`  📋 TPO           : tpo2@rvce.edu.in`);
  console.log(`  🏢 Recruiter     : hr@infosys.com`);
  console.log(`  🎓 Student       : arjun.sharma@rvce.edu.in`);
  console.log('─────────────────────────────────────────────\n');

  await disconnectDB();
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  mongoose.disconnect();
  process.exit(1);
});
