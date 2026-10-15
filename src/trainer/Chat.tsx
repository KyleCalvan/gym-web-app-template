import React from 'react';
import { ChatView } from '../shared/chat/ChatView';
import { CONVERSATIONS, MESSAGES } from '../data';
import type { Conversation, Message, ViewProps } from '../types';

type TrainerChatProps = Pick<ViewProps, 'role' | 'currentUser' | 'toast'>;

export default function TrainerChat({ role, currentUser, toast }: TrainerChatProps) {
  const [conversations, setConversations] = React.useState<Conversation[]>(CONVERSATIONS);
  const [messages, setMessages] = React.useState<Message[]>(MESSAGES);

  const handleSendMessage = (convId: string, content: string, fileUrl?: string) => {
    const newMessage = {
      id: 'msg-' + Date.now(),
      conversationId: convId,
      senderId: currentUser.id || currentUser.name,
      senderName: currentUser.name,
      content,
      attachmentUrl: fileUrl,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMessage]);

    // Update conversation last message
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, lastMessage: content, updatedAt: new Date().toISOString() } : c
    ));

    toast('Message sent to member');
  };

  return (
    <ChatView
      role={role}
      currentUser={currentUser}
      conversations={conversations}
      messages={messages}
      onSendMessage={handleSendMessage}
      toast={toast}
    />
  );
}
