import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getFeed,
  createPost,
  deletePost,
  getConnections,
  createConnectionRequest,
  updateConnectionRequest,
  deleteConnection,
  getMessages,
  getUnreadMessageCount,
  sendMessage,
  getConversations,
  createConversation,
  getGroups,
  getGroupById,
  createGroup,
  joinGroup,
  leaveGroup,
  getEvents,
  createEvent,
  updateEvent,
  registerForEvent,
  deleteEvent,
  exploreStudents,
  getOpportunities,
} from '../controllers/community.controller';

const router = Router();

router.use(authenticate);

// Feed / Posts
router.get('/feed', getFeed);
router.post('/feed', createPost);
router.delete('/feed/:postId', deletePost);

// Connections
router.get('/connections', getConnections);
router.post('/connections', createConnectionRequest);
router.patch('/connections/:id', updateConnectionRequest);
router.delete('/connections/:id', deleteConnection);

// Messages & Conversations
router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/messages/unread', getUnreadMessageCount);
router.get('/messages/:conversationId', getMessages);
router.post('/messages', sendMessage);

// Groups / Communities
router.get('/groups', getGroups);
router.post('/groups', createGroup);
router.get('/groups/:id', getGroupById);
router.post('/groups/:id/join', joinGroup);
router.post('/groups/:id/leave', leaveGroup);

// Events — posted by the college TPO, read by students of that college
router.get('/events', getEvents);
router.post('/events', authorize('TPO', 'COLLEGE_ADMIN'), createEvent);
router.put('/events/:id', authorize('TPO', 'COLLEGE_ADMIN'), updateEvent);
router.patch('/events/:id', authorize('TPO', 'COLLEGE_ADMIN'), updateEvent);
router.post('/events/:id/register', registerForEvent);
router.delete('/events/:id', authorize('TPO', 'COLLEGE_ADMIN'), deleteEvent);

// Explore Students
router.get('/explore-students', exploreStudents);

// Opportunities
router.get('/opportunities', getOpportunities);

export default router;
