const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Message = require('./models/Message');
const GroupMessage = require('./models/GroupMessage');
const Call = require('./models/Call');
const { sendPushNotification } = require('./utils/firebase');
const { createNotification } = require('./controllers/notificationController');

const initSocket = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: true,
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = await User.findById(decoded.id).select('-password');
      if (!socket.user) return next(new Error('User not found'));
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 [Socket.io] User connected: ${socket.user.fullName}`);

    // Join personal room for private notifications
    socket.join(socket.user._id.toString());

    // Join college room for multicast/broadcast updates
    if (socket.user.collegeCode) {
      socket.join(socket.user.collegeCode.toUpperCase());
    }

    // Join section-specific room for students (e.g. ECE_5_F)
    if (socket.user.role === 'student') {
      const dept = (socket.user.branch || socket.user.department || '').toUpperCase().trim();
      const sem = socket.user.semester;
      const sec = (socket.user.section || '').toUpperCase().trim();
      if (dept && sem && sec) {
        const sectionRoom = `${dept}_${sem}_${sec}`;
        socket.join(sectionRoom);
        console.log(`🔌 [Socket.io] Student ${socket.user.fullName} joined section room: ${sectionRoom}`);
      }
    }

    // Join HOD department room for real-time attendance monitoring
    if (socket.user.role === 'hod' && socket.user.collegeCode && socket.user.assignedDepartment) {
      const hodRoom = `${socket.user.collegeCode.toUpperCase()}_HOD_${socket.user.assignedDepartment.toUpperCase()}`;
      socket.join(hodRoom);
      console.log(`🔌 [Socket.io] HOD ${socket.user.fullName} joined department room: ${hodRoom}`);
    }

    // Principal joins all department rooms for cross-dept oversight
    if (socket.user.role === 'principal' && socket.user.collegeCode) {
      const principalRoom = `${socket.user.collegeCode.toUpperCase()}_PRINCIPAL`;
      socket.join(principalRoom);
      console.log(`🔌 [Socket.io] Principal ${socket.user.fullName} joined principal room: ${principalRoom}`);
    }

    // Join a specific chat room (either 1-on-1 or group)
    socket.on('join_room', (roomId) => {
      socket.join(roomId);
      console.log(`[Socket.io] User joined room: ${roomId}`);
    });

    socket.on('leave_room', (roomId) => {
      socket.leave(roomId);
    });

    socket.on('send_message', async (data, callback) => {
      // data: { roomId, recipient, isGroup, content, fileUrl, fileType, fileName, replyTo, forwardedFrom }
      try {
        let populatedMessage;

        if (data.isGroup) {
          const groupMsg = await GroupMessage.create({
            group: data.recipient,
            sender: socket.user._id,
            content: data.content,
            fileUrl: data.fileUrl,
            fileType: data.fileType,
            fileName: data.fileName,
            replyTo: data.replyTo || null,
            forwardedFrom: data.forwardedFrom || null,
            seenBy: [socket.user._id]
          });

          populatedMessage = await GroupMessage.findById(groupMsg._id)
            .populate('sender', 'fullName avatar')
            .populate({
              path: 'replyTo',
              select: 'content sender',
              populate: { path: 'sender', select: 'fullName' }
            });

          // Broadcast to the group room
          io.to(data.roomId).emit('receive_message', populatedMessage);
        } else {
          const recipientUser = await User.findById(data.recipient).select('blockedUsers');
          const senderUser = await User.findById(socket.user._id).select('blockedUsers');
          
          const isBlockedByRecipient = recipientUser?.blockedUsers.some(b => b.toString() === socket.user._id.toString());
          const isBlockedBySender = senderUser?.blockedUsers.some(b => b.toString() === data.recipient.toString());
          if (isBlockedByRecipient || isBlockedBySender) {
            if (callback) callback({ success: false, error: 'User blocked' });
            return;
          }

          const message = await Message.create({
            sender: socket.user._id,
            recipient: data.recipient,
            isGroup: false,
            content: data.content,
            fileUrl: data.fileUrl,
            fileType: data.fileType,
            fileName: data.fileName,
          });

          populatedMessage = await Message.findById(message._id).populate('sender', 'fullName avatar');

          // Broadcast to the private room
          io.to(data.roomId).emit('receive_message', populatedMessage);

          socket.to(data.recipient.toString()).emit('new_message_notification', {
            message: populatedMessage,
            roomId: data.roomId
          });

          // Create in-DB notification for private message
          const preview = data.content ? data.content.substring(0, 60) : 'Sent a file';
          await createNotification(io, data.recipient, {
            title: `${socket.user.fullName}`,
            message: preview,
            type: 'message',
            senderId: socket.user._id,
            senderName: socket.user.fullName,
            senderAvatar: socket.user.avatar || '',
            relatedId: data.roomId,
            link: '/community'
          });
        }

        if (callback) {
          callback({ success: true, message: populatedMessage });
        }
      } catch (error) {
        console.error('Socket send_message error:', error);
        if (callback) {
          callback({ success: false, error: error.message });
        }
      }
    });

    socket.on('typing', (data) => {
      socket.to(data.roomId).emit('user_typing', { userId: socket.user._id, isTyping: data.isTyping });
    });

    // ── WebRTC Voice Call Signaling ───────────────────────────────────────
    
    // Caller requests a call
    socket.on('call-request', async ({ recipientId }) => {
      try {
        const caller = await User.findById(socket.user._id);
        const receiver = await User.findById(recipientId).select('blockedUsers friends fcmTokens');
        
        console.log(`📞 [Socket.io] Call request from ${caller.fullName} (${caller._id}) to receiver (${recipientId})`);

        // 1. Check if they are friends
        const isFriend = receiver?.friends.some(f => f.toString() === caller._id.toString());
        if (!isFriend) {
          console.log(`❌ [Socket.io] Call failed: Users not friends. Caller: ${caller._id}, Receiver: ${recipientId}`);
          return socket.emit('call-error', { message: 'You can only call accepted friends.' });
        }
        
        // 2. Check blocks
        const isCallerBlocked = receiver.blockedUsers.some(b => b.toString() === caller._id.toString());
        const isReceiverBlocked = caller.blockedUsers.some(b => b.toString() === receiver._id.toString());
        if (isCallerBlocked || isReceiverBlocked) {
          console.log(`❌ [Socket.io] Call failed: Blocked user. Caller: ${caller._id}, Receiver: ${recipientId}`);
          return socket.emit('call-error', { message: 'Cannot call this user.' });
        }

        // 3. Create a Call log in DB
        const callLog = await Call.create({
          caller: caller._id,
          receiver: receiver._id,
          status: 'missed', // default, will update if accepted
          startedAt: new Date()
        });

        // 4. Send ringing to recipient via Socket (if online)
        socket.to(recipientId.toString()).emit('incoming-call', {
          callId: callLog._id,
          caller: {
            _id: caller._id,
            fullName: caller.fullName,
            avatar: caller.avatar
          }
        });

        // 5. Send Push Notification for Background/Offline Ringing
        if (receiver.fcmTokens && receiver.fcmTokens.length > 0) {
          sendPushNotification(
            receiver.fcmTokens,
            'Incoming Voice Call',
            `📞 ${caller.fullName} is calling you`,
            {
              type: 'INCOMING_CALL',
              callId: callLog._id.toString(),
              callerId: caller._id.toString()
            }
          );
        }
      } catch (err) {
        console.error('Call request error:', err);
      }
    });

    // Receiver accepts call
    socket.on('call-accept', async ({ callId, callerId }) => {
      try {
        console.log(`📞 [Socket.io] Call accepted. CallId: ${callId}, Receiver: ${socket.user.fullName} (${socket.user._id}), CallerId: ${callerId}`);
        await Call.findByIdAndUpdate(callId, { status: 'completed' });
        socket.to(callerId.toString()).emit('call-accepted', { callId, receiverId: socket.user._id });
      } catch (err) {}
    });

    // Receiver rejects call — notify caller of rejection
    socket.on('call-reject', async ({ callId, callerId }) => {
      try {
        console.log(`📞 [Socket.io] Call rejected. CallId: ${callId}, Receiver: ${socket.user.fullName} (${socket.user._id}), CallerId: ${callerId}`);
        await Call.findByIdAndUpdate(callId, { status: 'rejected', endedAt: new Date() });
        socket.to(callerId.toString()).emit('call-rejected', { callId });
      } catch (err) {}
    });

    // Caller cancels unanswered call — create missed call notification for receiver
    socket.on('call-cancel', async ({ callId, receiverId }) => {
      try {
        const call = await Call.findByIdAndUpdate(callId, { status: 'missed', endedAt: new Date() }, { new: true });
        socket.to(receiverId.toString()).emit('call-cancelled', { callId });

        // Create missed call notification
        await createNotification(io, receiverId, {
          title: 'Missed Call',
          message: `Missed call from ${socket.user.fullName}`,
          type: 'missed_call',
          senderId: socket.user._id,
          senderName: socket.user.fullName,
          senderAvatar: socket.user.avatar || '',
          relatedId: callId ? callId.toString() : '',
          link: '/community'
        });
      } catch (err) { console.error('call-cancel error:', err); }
    });

    // End call (by either party)
    socket.on('call-end', async ({ callId, otherUserId, duration }) => {
      try {
        const call = await Call.findByIdAndUpdate(callId, { endedAt: new Date(), duration: duration || 0 }, { new: true });
        
        // If the call was never answered (duration 0 or null), treat as missed
        if (!duration && call.status !== 'completed') {
            await Call.findByIdAndUpdate(callId, { status: 'missed' });
            await createNotification(io, otherUserId, {
              title: 'Missed Call',
              message: `Missed call from ${socket.user.fullName}`,
              type: 'missed_call',
              senderId: socket.user._id,
              senderName: socket.user.fullName,
              senderAvatar: socket.user.avatar || '',
              relatedId: callId ? callId.toString() : '',
              link: '/community'
            });
        }
        
        socket.to(otherUserId.toString()).emit('call-ended', { callId });
      } catch (err) {}
    });

    // WebRTC SDP Offer
    socket.on('webrtc-offer', ({ targetId, offer }) => {
      socket.to(targetId.toString()).emit('webrtc-offer', {
        callerId: socket.user._id,
        offer
      });
    });

    // WebRTC SDP Answer
    socket.on('webrtc-answer', ({ targetId, answer }) => {
      socket.to(targetId.toString()).emit('webrtc-answer', {
        receiverId: socket.user._id,
        answer
      });
    });

    // WebRTC ICE Candidate
    socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
      socket.to(targetId.toString()).emit('webrtc-ice-candidate', {
        senderId: socket.user._id,
        candidate
      });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.io] User disconnected: ${socket.user.fullName}`);
    });
  });

  return io;
};

module.exports = initSocket;
