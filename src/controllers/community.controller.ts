import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Post } from '../models/Post';
import { Connection } from '../models/Connection';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { Group } from '../models/Group';
import { Event } from '../models/Event';
import { User } from '../models/User';
import { Student } from '../models/Student';
import { getIo } from '../config/socket';

export const getFeed = async (req: Request, res: Response) => {
  try {
    const posts = await Post.find()
      .populate('author', 'name email role avatar')
      .populate('comments.author', 'name email avatar')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const { title, content, type, hashtags, bullets, media } = req.body;
    const post = await Post.create({
      author: (req as any).user.userId,
      title,
      content,
      type: type || 'achievement',
      hashtags: hashtags || [],
      bullets: bullets || [],
      media: media || [],
    });
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deletePost = async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      // Handle mock data or invalid ID gracefully
      return res.json({ success: true, message: 'Post deleted' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.author.toString() !== userId && userRole !== 'SUPER_ADMIN') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await Post.findByIdAndDelete(postId);
    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getConnections = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const connections = await Connection.find({
      $or: [{ requester: userId }, { recipient: userId }],
      status: { $in: ['pending', 'accepted'] },
    })
      .populate('requester', 'name email role avatar')
      .populate('recipient', 'name email role avatar');
    res.json({ success: true, data: connections });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createConnectionRequest = async (req: Request, res: Response) => {
  try {
    const { recipientId } = req.body;
    const requesterId = (req as any).user.userId;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Recipient ID is required' });
    }

    // Resolve recipientId in case a Student document ID was passed
    let targetUserId = recipientId;
    if (mongoose.Types.ObjectId.isValid(recipientId)) {
      const student = await Student.findById(recipientId).select('userId');
      if (student && student.userId) {
        targetUserId = student.userId.toString();
      }
    }

    if (requesterId.toString() === targetUserId.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot connect with yourself' });
    }

    // Check for any existing connections between these two users
    const existingConnections = await Connection.find({
      $or: [
        { requester: requesterId, recipient: targetUserId },
        { requester: targetUserId, recipient: requesterId },
      ],
    });

    const acceptedConn = existingConnections.find((c) => c.status === 'accepted');
    if (acceptedConn) {
      return res.status(400).json({ success: false, message: 'Already connected' });
    }

    const pendingConn = existingConnections.find((c) => c.status === 'pending');
    if (pendingConn) {
      if (pendingConn.requester.toString() === requesterId.toString()) {
        return res.status(400).json({ success: false, message: 'Connection request already sent' });
      } else {
        // The other user already sent a pending request to current user, so accept it!
        pendingConn.status = 'accepted';
        await pendingConn.save();
        const populated = await Connection.findById(pendingConn._id)
          .populate('requester', 'name email role avatar')
          .populate('recipient', 'name email role avatar');
        return res.status(200).json({ success: true, data: populated, message: 'Connection request accepted' });
      }
    }

    // Remove any previous rejected/cancelled requests between the two users
    if (existingConnections.length > 0) {
      await Connection.deleteMany({
        _id: { $in: existingConnections.map((c) => c._id) },
      });
    }

    const connection = await Connection.create({
      requester: requesterId,
      recipient: targetUserId,
      status: 'pending',
    });

    const populated = await Connection.findById(connection._id)
      .populate('requester', 'name email role avatar')
      .populate('recipient', 'name email role avatar');

    res.status(201).json({ success: true, data: populated });
  } catch (error: any) {
    console.error('Error creating connection request:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const updateConnectionRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = (req as any).user.userId;

    if (status === 'rejected') {
      // Cleanly remove the connection request if declined so future requests can be re-sent smoothly
      const connection = await Connection.findOneAndDelete({
        _id: id,
        recipient: userId,
      });
      if (!connection) {
        return res.status(404).json({ success: false, message: 'Connection request not found' });
      }
      return res.json({ success: true, message: 'Connection request declined' });
    }

    const connection = await Connection.findOneAndUpdate(
      { _id: id, recipient: userId },
      { status },
      { new: true }
    )
      .populate('requester', 'name email role avatar')
      .populate('recipient', 'name email role avatar');

    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection request not found' });
    }
    res.json({ success: true, data: connection });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteConnection = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const connection = await Connection.findOneAndDelete({
      _id: req.params.id,
      $or: [{ requester: userId }, { recipient: userId }],
    });
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection not found' });
    }
    res.json({ success: true, message: connection.status === 'pending' ? 'Connection request cancelled' : 'Connection removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getUnreadMessageCount = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const conversationIds = await Conversation.find({ participants: userId }).distinct('_id');
    const count = await Message.countDocuments({
      conversation: { $in: conversationIds },
      sender: { $ne: userId },
      isRead: false,
    });
    res.json({ success: true, data: { count } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const userId = (req as any).user.userId;
    await Message.updateMany(
      { conversation: conversationId, sender: { $ne: userId }, isRead: false },
      { $set: { isRead: true } },
    );
    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'name email avatar')
      .sort({ createdAt: 1 });
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { conversationId, content, attachment } = req.body;
    const textContent = content?.trim() || (attachment?.type === 'image' ? 'Sent an image' : attachment ? 'Sent an attachment' : '');
    const message = await Message.create({
      conversation: conversationId,
      sender: (req as any).user.userId,
      content: textContent,
      attachment,
    });
    await Conversation.findByIdAndUpdate(conversationId, { lastMessage: message._id });
    // Populate sender before returning
    await message.populate('sender', 'name email avatar');
    
    // Get other participants to notify them via socket.io
    const convObj = await Conversation.findById(conversationId);
    if (convObj) {
      const io = getIo();
      convObj.participants.forEach(pId => {
        io.to(pId.toString()).emit('receive_message', message);
      });
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getConversations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'name email avatar')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createConversation = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const currentUserId = (req as any).user.userId;
    
    if (!userId || String(userId) === String(currentUserId)) {
      return res.status(400).json({ success: false, message: 'Cannot create conversation with yourself' });
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, userId], $size: 2 },
    }).populate('participants', 'name email avatar').populate('lastMessage');

    if (!conversation) {
      conversation = await Conversation.create({ participants: [currentUserId, userId] });
      conversation = await conversation.populate('participants', 'name email avatar');
    }

    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getGroups = async (req: Request, res: Response) => {
  try {
    const groups = await Group.find()
      .populate('admins', 'name email avatar')
      .populate('members', 'name email avatar');
    res.json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getGroupById = async (req: Request, res: Response) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('admins', 'name email avatar')
      .populate('members', 'name email avatar');
    if (!group) return res.status(404).json({ success: false, message: 'Group not found' });
    res.json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createGroup = async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const group = await Group.create({
      name,
      description,
      admins: [(req as any).user.userId],
      members: [(req as any).user.userId],
    });
    res.status(201).json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const joinGroup = async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.userId;
    const group = await Group.findByIdAndUpdate(
      groupId,
      { $addToSet: { members: userId } },
      { new: true }
    );
    res.json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const leaveGroup = async (req: Request, res: Response) => {
  try {
    const groupId = req.params.id;
    const userId = (req as any).user.userId;
    const group = await Group.findByIdAndUpdate(
      groupId,
      { $pull: { members: userId } },
      { new: true }
    );
    res.json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const serializeEvent = (event: any, userId?: string, studentMap?: Map<string, any>) => {
  const rawAttendees: any[] = event.attendees || [];
  const attendeesCount = rawAttendees.length;
  const isRegistered = userId ? rawAttendees.some((a) => String(a._id || a) === String(userId)) : false;

  const registeredStudents = rawAttendees.map((a: any) => {
    const uId = String(a._id || a);
    const s = studentMap?.get(uId);
    return {
      id: uId,
      name: s?.name || a.name || 'Student',
      email: s?.email || a.email || '',
      studentId: s?.studentId || '',
      department: s?.department || '',
      batch: s?.batch || '',
      phone: s?.phone || a.phone || '',
      avatar: s?.avatar || a.avatar || '',
    };
  });

  const json = typeof event.toJSON === 'function' ? event.toJSON() : event;
  return {
    ...json,
    attendeesCount,
    isRegistered,
    registeredStudents,
  };
};

export const getEvents = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const filter: Record<string, unknown> = {};
    if (user.role !== 'SUPER_ADMIN') {
      if (!user.tenantId) {
        res.json({ success: true, data: [] });
        return;
      }
      filter.collegeId = user.tenantId;
    }

    const events = await Event.find(filter)
      .populate('organizer', 'name email avatar')
      .populate('attendees', 'name email avatar phone')
      .sort({ date: 1 });

    const attendeeUserIds = Array.from(
      new Set(
        events.flatMap((e) => (e.attendees || []).map((a: any) => String(a._id || a)))
      )
    );

    const students = await Student.find({ userId: { $in: attendeeUserIds } })
      .select('userId studentId department batch name email phone avatar');

    const studentMap = new Map(students.map((s) => [String(s.userId), s]));

    res.json({
      success: true,
      data: events.map((event) => serializeEvent(event, user.userId, studentMap)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createEvent = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user.tenantId) {
      res.status(400).json({ success: false, message: 'Your account is not linked to a college' });
      return;
    }

    const { title, description, date, startTime, endTime, location, type, speaker, speakerRole, speakerAvatar, image } = req.body;
    if (!title || !date || !startTime || !endTime || !location || !type || !speaker) {
      res.status(400).json({ success: false, message: 'Title, date, time, venue, type, and speaker are required' });
      return;
    }

    const event = await Event.create({
      title,
      description: description || '',
      date: new Date(`${date}T12:00:00`),
      startTime,
      endTime,
      location,
      type,
      speaker,
      speakerRole: speakerRole || '',
      speakerAvatar: speakerAvatar || undefined,
      image: image || undefined,
      organizer: user.userId,
      collegeId: user.tenantId,
    });

    res.status(201).json({ success: true, data: serializeEvent(event, user.userId) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const registerForEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const event = await Event.findById(req.params.id);
    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }

    const already = event.attendees.some((id) => String(id) === String(userId));
    if (already) {
      event.attendees = event.attendees.filter((id) => String(id) !== String(userId));
    } else {
      event.attendees.push(userId);
    }
    await event.save();

    await event.populate('attendees', 'name email avatar phone');
    const attendeeUserIds = (event.attendees || []).map((a: any) => String(a._id || a));
    const students = await Student.find({ userId: { $in: attendeeUserIds } })
      .select('userId studentId department batch name email phone avatar');
    const studentMap = new Map(students.map((s) => [String(s.userId), s]));

    res.json({ success: true, data: serializeEvent(event, userId, studentMap) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const event = await Event.findById(req.params.id);
    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }
    if (user.role !== 'SUPER_ADMIN' && String(event.collegeId) !== String(user.tenantId)) {
      res.status(403).json({ success: false, message: 'You can only remove events from your college' });
      return;
    }

    await event.deleteOne();
    res.json({ success: true, message: 'Event removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateEvent = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const event = await Event.findById(req.params.id);
    if (!event) {
      res.status(404).json({ success: false, message: 'Event not found' });
      return;
    }
    if (user.role !== 'SUPER_ADMIN' && String(event.collegeId) !== String(user.tenantId)) {
      res.status(403).json({ success: false, message: 'You can only edit events from your college' });
      return;
    }

    const { title, description, date, startTime, endTime, location, type, speaker, speakerRole, speakerAvatar, image } = req.body;
    if (title !== undefined) event.title = title;
    if (description !== undefined) event.description = description;
    if (date !== undefined) event.date = new Date(`${date}T12:00:00`);
    if (startTime !== undefined) event.startTime = startTime;
    if (endTime !== undefined) event.endTime = endTime;
    if (location !== undefined) event.location = location;
    if (type !== undefined) event.type = type;
    if (speaker !== undefined) event.speaker = speaker;
    if (speakerRole !== undefined) event.speakerRole = speakerRole;
    if (speakerAvatar !== undefined) event.speakerAvatar = speakerAvatar;
    if (image !== undefined) event.image = image;

    await event.save();

    await event.populate('attendees', 'name email avatar phone');
    const attendeeUserIds = (event.attendees || []).map((a: any) => String(a._id || a));
    const students = await Student.find({ userId: { $in: attendeeUserIds } })
      .select('userId studentId department batch name email phone avatar');
    const studentMap = new Map(students.map((s) => [String(s.userId), s]));

    res.json({ success: true, data: serializeEvent(event, user.userId, studentMap) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const exploreStudents = async (req: Request, res: Response) => {
  try {
    const { Student } = await import('../models/Student');
    const students = await Student.find()
      .populate('userId', 'name email avatar')
      .populate('collegeId', 'name city');
    res.json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getOpportunities = async (req: Request, res: Response) => {
  try {
    // You could query a Job or similar model here
    res.json({ success: true, data: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
