import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db';
import { User } from '../models/User';
import { College } from '../models/College';
import { Department } from '../models/Department';
import { Student } from '../models/Student';
import { Post } from '../models/Post';

const DEMO_PASSWORD = 'password123';

interface RawStudentInput {
  alias: string;
  name: string;
  email: string;
  collegeName: string;
  collegeCity: string;
  deptCode: string;
  deptName: string;
  batch: string;
  cgpa: number;
  rollNo: string;
  matchScore: number;
  avatarImage: string;
  skills: string[];
  interests: string[];
  bio: string;
  isPlaced: boolean;
  placedAt?: string;
  projects: { title: string; tech: string; desc: string }[];
  certifications: string[];
  isProfilePublic?: boolean;
  github?: string;
  linkedin?: string;
}

const RICH_STUDENTS: RawStudentInput[] = [
  {
    alias: 'c1',
    name: 'Arjun K',
    email: 'arjun.k@rvce.edu.in',
    collegeName: 'RV College of Engineering',
    collegeCity: 'Bengaluru',
    deptCode: 'CSE',
    deptName: 'Computer Science & Engineering',
    batch: '2025',
    cgpa: 9.42,
    rollNo: '1RV21CSE015',
    matchScore: 95,
    avatarImage: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80',
    skills: ['C++', 'Distributed Systems', 'Java', 'System Design'],
    interests: ['Backend Development', 'System Architecture', 'Software Engineer'],
    bio: 'Software Engineer placed @ Microsoft. Passionate about distributed systems, microservices, and high-performance computing.',
    isPlaced: true,
    placedAt: 'Microsoft',
    projects: [
      {
        title: 'Cloud Infrastructure Monitoring Dashboard',
        tech: 'Go · React · Prometheus',
        desc: 'Real-time telemetry and metrics aggregator for cloud microservices.'
      }
    ],
    certifications: ['Microsoft Certified: Azure Solutions Architect Expert'],
    isProfilePublic: true,
    github: 'https://github.com/arjunk',
    linkedin: 'https://linkedin.com/in/arjunk'
  },
  {
    alias: 'c2',
    name: 'Priya Sharma',
    email: 'priya.sharma@vit.ac.in',
    collegeName: 'VIT Chennai',
    collegeCity: 'Chennai',
    deptCode: 'ECE',
    deptName: 'Electronics & Communication Engineering',
    batch: '2024',
    cgpa: 9.18,
    rollNo: '20ECE0104',
    matchScore: 92,
    avatarImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80',
    skills: ['Figma', 'UI/UX Design', 'Design Systems', 'Prototyping'],
    interests: ['Product Design', 'User Research'],
    bio: 'Product Designer placed @ Google. Crafting intuitive user experiences and accessible design systems.',
    isPlaced: true,
    placedAt: 'Google',
    projects: [
      {
        title: 'Accessible Campus Mobile App UX',
        tech: 'Figma · Design Systems · User Testing',
        desc: 'End-to-end design research and prototype for inclusive campus mobile app.'
      }
    ],
    certifications: ['Google UX Design Professional Certificate'],
    isProfilePublic: true,
    github: 'https://github.com/priyasharma',
    linkedin: 'https://linkedin.com/in/priyasharma'
  },
  {
    alias: 'c3',
    name: 'Rohit Menon',
    email: 'rohit.menon@bmsce.ac.in',
    collegeName: 'BMS College of Engineering',
    collegeCity: 'Bengaluru',
    deptCode: 'IT',
    deptName: 'Information Technology',
    batch: '2025',
    cgpa: 8.95,
    rollNo: '1BM21IT078',
    matchScore: 89,
    avatarImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
    skills: ['React', 'Node.js', 'AWS', 'GraphQL', 'TypeScript'],
    interests: ['Full Stack Development', 'Cloud Native Apps'],
    bio: 'Full Stack Developer placed @ Amazon. Building resilient web services and high-scale cloud platforms.',
    isPlaced: true,
    placedAt: 'Amazon',
    projects: [
      {
        title: 'E-Commerce Micro-services Platform',
        tech: 'React · Node.js · AWS DynamoDB',
        desc: 'Serverless web platform handling real-time inventory and payments.'
      }
    ],
    certifications: ['AWS Certified Developer Associate'],
    isProfilePublic: true,
    github: 'https://github.com/rohitmenon',
    linkedin: 'https://linkedin.com/in/rohitmenon'
  },
  {
    alias: 'c4',
    name: 'Sneha Reddy',
    email: 'sneha.reddy@pes.edu',
    collegeName: 'PES University',
    collegeCity: 'Bengaluru',
    deptCode: 'CSE',
    deptName: 'Computer Science & Engineering',
    batch: '2025',
    cgpa: 9.05,
    rollNo: 'PES1202100452',
    matchScore: 91,
    avatarImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&auto=format&fit=crop&q=80',
    skills: ['React', 'Next.js', 'TailwindCSS', 'Web Performance'],
    interests: ['Frontend Engineering', 'UI Frameworks'],
    bio: 'Frontend Architect & UI Specialist. Open to software engineering and frontend developer roles.',
    isPlaced: false,
    projects: [
      {
        title: 'High Performance Component Library',
        tech: 'React · TypeScript · Tailwind',
        desc: 'Zero-dependency design kit benchmarked for sub-50ms render times.'
      }
    ],
    certifications: ['Meta Front-End Developer Professional'],
    isProfilePublic: true,
    github: 'https://github.com/snehareddy',
    linkedin: 'https://linkedin.com/in/snehareddy'
  },
  {
    alias: 'c5',
    name: 'Vikramaditya S',
    email: 'vikram.s@msrit.edu',
    collegeName: 'MSRIT Bangalore',
    collegeCity: 'Bengaluru',
    deptCode: 'ECE',
    deptName: 'Electronics & Communication Engineering',
    batch: '2025',
    cgpa: 8.76,
    rollNo: '1MS21EC089',
    matchScore: 87,
    avatarImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80',
    skills: ['C/C++', 'RTOS', 'ARM Cortex', 'Embedded C', 'IoT'],
    interests: ['Embedded Firmware', 'Robotics'],
    bio: 'Embedded Systems Engineer specializing in microcontrollers, RTOS kernel customization, and hardware design.',
    isPlaced: false,
    projects: [
      {
        title: 'Autonomous Drone Flight Controller',
        tech: 'Embedded C · FreeRTOS · STM32',
        desc: 'Real-time telemetry and attitude stabilization system for autonomous quadcopters.'
      }
    ],
    certifications: ['Arm Certified Embedded Systems Specialist'],
    isProfilePublic: true,
    github: 'https://github.com/vikramaditya',
    linkedin: 'https://linkedin.com/in/vikramaditya'
  },
  {
    alias: 'c6',
    name: 'Ananya Deshmukh',
    email: 'ananya.d@vjti.ac.in',
    collegeName: 'VJTI Mumbai',
    collegeCity: 'Mumbai',
    deptCode: 'IT',
    deptName: 'Information Technology',
    batch: '2024',
    cgpa: 9.30,
    rollNo: '20IT0032',
    matchScore: 94,
    avatarImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80',
    skills: ['Apache Spark', 'Python', 'SQL', 'Snowflake', 'Airflow'],
    interests: ['Data Engineering', 'Big Data Analytics'],
    bio: 'Data Engineer placed @ Goldman Sachs. Specialized in large-scale data pipelines, ETL workflows, and real-time streaming analytics.',
    isPlaced: true,
    placedAt: 'Goldman Sachs',
    projects: [
      {
        title: 'Financial Market Tick Data Pipeline',
        tech: 'PySpark · Kafka · Snowflake',
        desc: 'Stream processing architecture parsing 10M events/min for algorithmic risk assessment.'
      }
    ],
    certifications: ['Databricks Certified Data Engineer Professional'],
    isProfilePublic: true,
    github: 'https://github.com/ananyadeshmukh',
    linkedin: 'https://linkedin.com/in/ananyadeshmukh'
  },
  {
    alias: 'c7',
    name: 'Karthik Raja',
    email: 'karthik.raja@srmist.edu.in',
    collegeName: 'SRM Institute',
    collegeCity: 'Chennai',
    deptCode: 'CSE',
    deptName: 'Computer Science & Engineering',
    batch: '2025',
    cgpa: 9.65,
    rollNo: 'RA2111003010112',
    matchScore: 96,
    avatarImage: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=300&auto=format&fit=crop&q=80',
    skills: ['PyTorch', 'CUDA', 'Deep Learning', 'LLMs', 'Transformers'],
    interests: ['AI Research', 'Computer Vision'],
    bio: 'ML Research Engineer placed @ NVIDIA. Researching deep neural network optimization and LLM acceleration.',
    isPlaced: true,
    placedAt: 'NVIDIA',
    projects: [
      {
        title: 'Quantized LLM Inference Engine',
        tech: 'PyTorch · CUDA C++ · TensorRT',
        desc: 'Custom CUDA kernels reducing Transformer model memory footprint by 60%.'
      }
    ],
    certifications: ['NVIDIA Certified Fundamentals of Deep Learning'],
    isProfilePublic: true,
    github: 'https://github.com/karthikraja',
    linkedin: 'https://linkedin.com/in/karthikraja'
  },
  {
    alias: 'c8',
    name: 'Divya Subramanian',
    email: 'divya.s@ssn.edu.in',
    collegeName: 'SSN College of Engineering',
    collegeCity: 'Chennai',
    deptCode: 'ISE',
    deptName: 'Information Science & Engineering',
    batch: '2025',
    cgpa: 8.82,
    rollNo: '21ISE029',
    matchScore: 88,
    avatarImage: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&auto=format&fit=crop&q=80',
    skills: ['Cloud Security', 'Kubernetes Security', 'IAM', 'Penetration Testing'],
    interests: ['Cybersecurity', 'DevSecOps'],
    bio: 'Cloud Security Analyst specializing in threat detection, identity & access management, and DevSecOps pipelines.',
    isPlaced: false,
    projects: [
      {
        title: 'Automated Container Vulnerability Scanner',
        tech: 'Python · Docker · Trivy · AWS GuardDuty',
        desc: 'CI/CD security gate blocking vulnerable container images prior to deployment.'
      }
    ],
    certifications: ['Certified Information Systems Security Professional (Study)', 'AWS Certified Security Specialty'],
    isProfilePublic: true,
    github: 'https://github.com/divyasubramanian',
    linkedin: 'https://linkedin.com/in/divyasubramanian'
  },
  {
    alias: 'c9',
    name: 'Aditya Verma',
    email: 'aditya.verma@iitdh.ac.in',
    collegeName: 'IIT Dharwad',
    collegeCity: 'Dharwad',
    deptCode: 'CSE',
    deptName: 'Computer Science & Engineering',
    batch: '2025',
    cgpa: 8.91,
    rollNo: '210010008',
    matchScore: 90,
    avatarImage: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&auto=format&fit=crop&q=80',
    skills: ['Go', 'gRPC', 'PostgreSQL', 'Docker', 'System Design'],
    interests: ['Backend Engineering', 'Microservices'],
    bio: 'Backend & Go Engineer building high-throughput REST and gRPC microservices with robust database architectures.',
    isPlaced: false,
    projects: [
      {
        title: 'High Concurrency Rate Limiter Service',
        tech: 'Go · Redis · gRPC',
        desc: 'Distributed token-bucket rate limiter handling 50k requests/second per node.'
      }
    ],
    certifications: ['Certified Kubernetes Administrator (CKA)'],
    isProfilePublic: true,
    github: 'https://github.com/adityaverma',
    linkedin: 'https://linkedin.com/in/adityaverma'
  },
  {
    alias: 'c10',
    name: 'Rahul Gowda',
    email: 'rahul.g@rvce.edu.in',
    collegeName: 'RV College of Engineering',
    collegeCity: 'Bengaluru',
    deptCode: 'ME',
    deptName: 'Mechanical Engineering',
    batch: '2025',
    cgpa: 7.40,
    rollNo: '1RV21ME042',
    matchScore: 82,
    avatarImage: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&auto=format&fit=crop&q=80',
    skills: ['AutoCAD', 'SolidWorks', 'ANSYS', 'Python', 'MATLAB'],
    interests: ['Thermal Engineering', 'Robotics & Automation'],
    bio: 'Mechanical Engineering senior specializing in computational fluid dynamics and automated manufacturing systems.',
    isPlaced: false,
    projects: [
      {
        title: 'Autonomous Robotic Arm with Inverse Kinematics',
        tech: 'Python · ROS · SolidWorks',
        desc: '6-DOF robotic manipulator with real-time trajectory optimization.'
      }
    ],
    certifications: ['Certified SOLIDWORKS Associate (CSWA)'],
    isProfilePublic: false,
    github: 'https://github.com/rahulgowda',
    linkedin: 'https://linkedin.com/in/rahulgowda'
  }
];

export async function seedRichStudents() {
  console.log('\n🚀 Starting Rich Students Seeding into MongoDB...\n');
  await connectDB();

  // Find default fallback college
  let defaultCollege = await College.findOne({ code: 'RVCE' });
  if (!defaultCollege) {
    defaultCollege = await College.create({
      name: 'RV College of Engineering',
      code: 'RVCE',
      city: 'Bengaluru',
      state: 'Karnataka',
      country: 'India',
      phone: '080-67178001',
      email: 'info@rvce.edu.in',
      establishedYear: 1963,
      type: 'engineering',
      subscription: {
        plan: 'professional',
        status: 'active',
        expiresAt: new Date('2026-12-31'),
        studentsLimit: 5000,
        studentsUsed: 1500,
        aiCreditsLimit: 5000,
        aiCreditsUsed: 500,
        recruitersLimit: 50,
        recruitersUsed: 10,
        jobsLimit: 200,
        jobsUsed: 40,
      },
      isActive: true,
    });
  }

  for (const item of RICH_STUDENTS) {
    console.log(`Processing student: ${item.name} (${item.email})...`);

    // 1. Get or create College
    let college = await College.findOne({ name: new RegExp(`^${item.collegeName}$`, 'i') });
    if (!college) {
      college = await College.create({
        name: item.collegeName,
        code: item.collegeName.replace(/[^A-Z]/g, '').slice(0, 6) || 'COL',
        city: item.collegeCity,
        state: 'Karnataka',
        country: 'India',
        phone: '080-12345678',
        email: `info@${item.email.split('@')[1] || 'college.edu.in'}`,
        establishedYear: 1980,
        type: 'engineering',
        subscription: {
          plan: 'professional',
          status: 'active',
          expiresAt: new Date('2026-12-31'),
          studentsLimit: 5000,
          studentsUsed: 1500,
          aiCreditsLimit: 5000,
          aiCreditsUsed: 500,
          recruitersLimit: 50,
          recruitersUsed: 10,
          jobsLimit: 200,
          jobsUsed: 40,
        },
        isActive: true,
      });
    }

    // 2. Get or create Department
    let department = await Department.findOne({
      collegeId: college._id,
      code: item.deptCode,
    });
    if (!department) {
      department = await Department.create({
        collegeId: college._id,
        code: item.deptCode,
        name: item.deptName,
        headOfDept: `Dr. Head of ${item.deptCode}`,
        email: `hod.${item.deptCode.toLowerCase()}@${item.email.split('@')[1]}`,
        totalStudents: 120,
        isActive: true,
      });
    }

    // 3. Upsert User
    let user = await User.findOne({ email: item.email.toLowerCase() });
    if (!user) {
      user = await User.create({
        email: item.email.toLowerCase(),
        passwordHash: DEMO_PASSWORD,
        name: item.name,
        role: 'STUDENT',
        tenantId: college._id,
        avatar: item.avatarImage,
        isEmailVerified: true,
        isActive: true,
      });
    } else {
      user.name = item.name;
      user.avatar = item.avatarImage;
      user.tenantId = college._id;
      await user.save();
    }

    // 4. Upsert Student Record
    let student = await Student.findOne({
      $or: [
        { userId: user._id },
        { studentId: item.rollNo },
        { email: item.email.toLowerCase() }
      ]
    });

    const studentProjects = item.projects.map((p, idx) => ({
      id: `proj-${idx + 1}`,
      title: p.title,
      description: p.desc,
      technologies: p.tech.split('·').map(t => t.trim()),
      duration: '3 months',
      highlights: [],
    }));

    const studentCertifications = item.certifications.map((c, idx) => ({
      id: `cert-${idx + 1}`,
      name: c,
      issuer: c.includes('Microsoft') ? 'Microsoft' : c.includes('Google') ? 'Google' : c.includes('AWS') ? 'AWS' : c.includes('NVIDIA') ? 'NVIDIA' : 'Industry Partner',
      issueDate: '2024-01-15',
    }));

    const studentExperience = item.isPlaced && item.placedAt ? [
      {
        id: 'exp-1',
        company: item.placedAt,
        role: 'Software Development Engineer',
        type: 'fulltime' as const,
        startDate: '2024-08-01',
        isCurrent: true,
        description: `Placed at ${item.placedAt} through campus placement.`,
        skills: item.skills,
      }
    ] : [];

    const studentData: any = {
      userId: user._id,
      collegeId: college._id,
      departmentId: department._id,
      studentId: item.rollNo,
      name: item.name,
      email: item.email.toLowerCase(),
      phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
      avatar: item.avatarImage,
      department: `${item.deptCode} ${item.batch} · ${item.deptName}`,
      batch: item.batch,
      degree: 'B.E.',
      cgpa: item.cgpa,
      backlogs: 0,
      gender: ['Priya', 'Sneha', 'Ananya', 'Divya'].some(n => item.name.includes(n)) ? 'female' : 'male',
      address: {
        city: item.collegeCity,
        state: 'India',
        pincode: '560001',
      },
      skills: item.skills,
      certifications: studentCertifications,
      projects: studentProjects,
      experience: studentExperience,
      education: [
        {
          id: 'edu-1',
          level: 'graduation',
          institution: item.collegeName,
          degree: 'B.E.',
          specialization: item.deptName,
          score: item.cgpa,
          scoreType: 'cgpa',
          yearOfPassing: parseInt(item.batch) || 2025,
          location: item.collegeCity,
        }
      ],
      profileCompletion: 92,
      placementStatus: item.isPlaced ? 'placed' : 'not_placed',
      isEligible: true,
      placementReadinessScore: item.matchScore,
      linkedIn: item.linkedin,
      github: item.github,
      preferredLocations: [item.collegeCity, 'Bengaluru', 'Hyderabad'],
      preferredRoles: item.interests,
      expectedSalary: item.isPlaced ? 1800000 : 1200000,
      isProfilePublic: item.isProfilePublic !== false,
    };

    if (!student) {
      student = await Student.create(studentData);
      console.log(`  ✓ Created student ${item.name} with ID: ${student._id}`);
    } else {
      Object.assign(student, studentData);
      await student.save();
      console.log(`  ✓ Updated student ${item.name} with ID: ${student._id}`);
    }
  }

  // ─── 5. Seed Authentic Campus Community Posts ─────────────────────────
  console.log('\n📝 Seeding authentic campus community posts...');
  const priyaUser = await User.findOne({ email: 'priya.sharma@vit.ac.in' });
  const arjunUser = await User.findOne({ email: 'arjun.k@rvce.edu.in' });
  const karthikUser = await User.findOne({ email: 'karthik.raja@srmist.edu.in' });
  const snehaUser = await User.findOne({ email: 'sneha.reddy@pes.edu' });

  if (priyaUser) {
    const existingPost = await Post.findOne({ author: priyaUser._id });
    if (!existingPost) {
      await Post.create({
        author: priyaUser._id,
        title: 'Completed Google UX Design Professional Certificate! 🎉',
        content: 'Excited to share that I have officially completed the Google UX Design Professional certification. Looking forward to applying these design principles in building accessible systems!',
        type: 'achievement',
        hashtags: ['#Google', '#UXDesign', '#CareerGrowth', '#DesignSystems'],
        media: ['https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80'],
        likes: [arjunUser?._id].filter(Boolean),
        comments: [],
      });
    }
  }

  if (arjunUser) {
    const existingPost = await Post.findOne({ author: arjunUser._id });
    if (!existingPost) {
      await Post.create({
        author: arjunUser._id,
        title: 'Placed @ Microsoft — Software Development Engineer! 🚀',
        content: 'Thrilled to announce that I have received an offer for the SDE-1 role at Microsoft! A huge thank you to PlacementOS for the AI mock interviews and system design prep tracks.',
        type: 'achievement',
        hashtags: ['#Microsoft', '#Placed', '#SDE', '#PlacementOS', '#DreamJob'],
        media: ['https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1000&auto=format&fit=crop&q=80'],
        likes: [priyaUser?._id, snehaUser?._id].filter(Boolean),
        comments: [],
      });
    }
  }

  if (snehaUser) {
    const existingPost = await Post.findOne({ author: snehaUser._id });
    if (!existingPost) {
      await Post.create({
        author: snehaUser._id,
        title: 'Looking for Frontend / Fullstack Hackathon Teammates 💡',
        content: 'We are participating in the upcoming National Smart India Hackathon and looking for motivated developers skilled in React, Tailwind, and Node.js. DM or comment if you are interested!',
        type: 'opportunity',
        hashtags: ['#Hackathon', '#React', '#OpenSource', '#WebDev'],
        bullets: ['1 Backend Developer (Node.js/Go)', '1 Mobile/Flutter Developer', 'Ready to build high-scale solutions'],
        media: [],
        likes: [arjunUser?._id].filter(Boolean),
        comments: [],
      });
    }
  }

  if (karthikUser) {
    const existingPost = await Post.findOne({ author: karthikUser._id });
    if (!existingPost) {
      await Post.create({
        author: karthikUser._id,
        title: 'Open-Sourced Quantized LLM Inference Engine on PyTorch & CUDA ⚡',
        content: 'Just released our open-source CUDA kernels optimizing Transformer memory footprint by 60%. Benchmarks show sub-10ms latency on edge hardware.',
        type: 'project',
        hashtags: ['#PyTorch', '#CUDA', '#LLM', '#NVIDIA', '#AIResearch'],
        media: ['https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1000&auto=format&fit=crop&q=80'],
        likes: [arjunUser?._id, priyaUser?._id].filter(Boolean),
        comments: [],
      });
    }
  }

  console.log('\n✨ All rich students and community feed posts successfully synced to MongoDB!\n');
}

if (require.main === module) {
  seedRichStudents()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Error seeding rich students:', err);
      await disconnectDB();
      process.exit(1);
    });
}
