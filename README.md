# aiplacementosbackend

Backend REST API & WebSocket server for AI PlacementOS.

## Features
- **Authentication**: JWT auth, bcrypt password hashing, role-based access control (Student, College Admin, Super Admin, Recruiter).
- **Placement Management**: Drives, applications, interviews, jobs, companies, departments, programs.
- **AI Integrations**: Gemini API resume parsing, ATS scoring, AI networking recommendations, interview prep mock live evaluation.
- **Social & Community**: Campus connect, feeds, groups, events, peer connections, messaging with Socket.io.
- **Storage**: Cloudinary & local disk uploads for resumes and avatars.
- **Database**: MongoDB Atlas with Mongoose.

## Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB Atlas connection URI

### Installation
```bash
npm install
```

### Environment Variables
Configure `.env` file based on `.env.example`:
```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

### Running the Server
```bash
# Development (ts-node-dev with auto-reload)
npm run dev

# Build
npm run build

# Start Production
npm start
```
