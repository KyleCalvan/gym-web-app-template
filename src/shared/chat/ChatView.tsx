import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Conversation, Message } from '../../types.ts';

function ConversationAvatar({ src, name }: { src?: string; name: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="chat-conversation-avatar" aria-hidden="true">
      {src && !imageFailed ? (
        <img
          src={src}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{name.trim().charAt(0).toUpperCase() || '?'}</span>
      )}
    </div>
  );
}

export function ChatView({
  role,
  currentUser,
  conversations,
  messages,
  onSendMessage,
  toast
}: {
  role: string,
  currentUser: any,
  conversations: Conversation[],
  messages: Message[],
  onSendMessage: (convId: string, content: string, fileUrl?: string) => void,
  toast: (msg: string) => void
}) {
  const [activeConvId, setActiveConvId] = useState<string | null>(() => conversations[0]?.id ?? null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConv = conversations.find(c => c.id === activeConvId);
  const currentMessages = messages.filter(m => m.conversationId === activeConvId);
  const filteredConversations = conversations.filter(conv =>
    `${conv.participantName} ${conv.lastMessage}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [currentMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeConvId) return;
    onSendMessage(activeConvId, input);
    setInput('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;

    toast(`Uploading ${file.name}...`);

    setTimeout(() => {
      const mockUrl = URL.createObjectURL(file);
      onSendMessage(activeConvId, `Sent an attachment: ${file.name}`, mockUrl);
      toast('Attachment sent!');
    }, 1000);
  };

  return (
    <div
      className={`chat-container${activeConv ? ' has-active-conversation' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'row',
        flex: '1 1 auto',
        position: 'relative',
        width: '100%',
        height: 'auto',
        minHeight: 0,
        backgroundColor: 'var(--paper)',
        color: 'var(--ink)',
        overflow: 'hidden',
      }}
    >
      {/* Actual Chat Sidebar */}
      <div
        className="chat-sidebar"
        style={{
          width: '380px',
          height: '100%',
          minHeight: 0,
          borderRight: '1px solid var(--line)',
          backgroundColor: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          boxShadow: '4px 0 12px rgba(0,0,0,0.2)',
          zIndex: 20
        }}
      >
        <div
          className="sidebar-header"
          style={{ padding: '24px', borderBottom: '1px solid var(--line)' }}
        >
          <h2 style={{ fontSize: '26.4px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1.5px', margin: 0, color: 'var(--ink)' }}>
            Messages
          </h2>
          <div style={{ marginTop: '16px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search conversations"
              style={{
                width: '100%',
                backgroundColor: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '12px 16px',
                fontSize: '17.6px',
                color: 'var(--ink)',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--signal)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--line)'}
            />
          </div>
        </div>

        <div
          className="sidebar-list"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px' }}
        >
          {filteredConversations.length > 0 ? filteredConversations.map(conv => (
            <button
              key={conv.id}
              type="button"
              className="chat-conversation-item"
              onClick={() => setActiveConvId(conv.id)}
              aria-pressed={activeConvId === conv.id}
              style={{ backgroundColor: activeConvId === conv.id ? 'var(--court-soft)' : 'transparent' }}
              onMouseEnter={(e) => { if(activeConvId !== conv.id) e.currentTarget.style.backgroundColor = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { if(activeConvId !== conv.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <ConversationAvatar src={conv.participantAvatar} name={conv.participantName} />
              <div className="chat-conversation-content">
                <div className="chat-conversation-heading">
                  <span className="chat-conversation-name">
                    {conv.participantName}
                  </span>
                  <span className="chat-conversation-date">
                    {conv.updatedAt.split('T')[0]}
                  </span>
                </div>
                <div className="chat-conversation-preview-row">
                  <span className="chat-conversation-preview">
                    {conv.lastMessage}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span className="chat-conversation-unread">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )) : (
            <p className="chat-empty-search">No conversations found.</p>
          )}
        </div>
      </div>

      {/* Main Chat Window */}
      <div
        className={`chat-main${activeConv ? ' is-active' : ''}`}
        style={{ flex: '1 1 0%', width: 0, minWidth: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--paper)', position: 'relative' }}
      >
        {activeConv ? (
          <>
            <div
              className="chat-header"
              style={{ flexShrink: 0, padding: '16px 24px', borderBottom: '1px solid var(--line)', backgroundColor: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 }}
            >
              <button
                type="button"
                className="chat-back-button"
                onClick={() => setActiveConvId(null)}
                aria-label="Back to conversations"
              >
                ← <span>Messages</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <ConversationAvatar src={activeConv.participantAvatar} name={activeConv.participantName} />
                <div>
                  <h3 style={{ fontWeight: 'bold', fontSize: '20.9px', margin: 0, color: 'var(--ink)' }}>{activeConv.participantName}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--signal)', borderRadius: '50%', display: 'inline-block' }} />
                    <span style={{ fontSize: '15.4px', color: 'var(--steel)' }}>Active now</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="chat-messages"
              style={{
                flex: '1 1 0%',
                minHeight: 0,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                scrollBehavior: 'smooth'
              }}
            >
              <AnimatePresence initial={false}>
                {currentMessages.map(msg => {
                  const isOwn = currentUser?.id
                    ? msg.senderId === currentUser.id
                    : msg.senderName === currentUser?.name;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}
                    >
                      <div style={{
                        maxWidth: '70%',
                        padding: '14px 18px',
                        borderRadius: '20px',
                        backgroundColor: isOwn ? 'var(--signal)' : 'var(--surface)',
                        color: isOwn ? 'var(--on-signal)' : 'var(--ink)',
                        borderBottomRightRadius: isOwn ? '4px' : '20px',
                        borderBottomLeftRadius: isOwn ? '20px' : '4px',
                        boxShadow: isOwn ? '0 4px 12px rgba(155, 233, 42, 0.15)' : 'none',
                        border: isOwn ? 'none' : '1px solid var(--line)'
                      }}>
                        {msg.attachmentUrl && (
                          <div style={{ marginBottom: '12px' }}>
                            <img src={msg.attachmentUrl} alt="attachment" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px', border: '1px solid var(--line)' }} />
                          </div>
                        )}
                        <p style={{ fontSize: '17.6px', lineHeight: '1.6', margin: 0 }}>{msg.content}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' }}>
                          <span style={{ fontSize: '13.2px', opacity: 0.7 }}>{msg.createdAt.split('T')[1].substring(0, 5)}</span>
                          {isOwn && (
                            <span style={{ fontSize: '12.1px', fontWeight: 'bold' }}>
                              {msg.isRead ? '✓✓' : '✓'}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            <div
              className="chat-input-area"
              style={{ flexShrink: 0, width: '100%', marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--line)', backgroundColor: 'var(--surface)', zIndex: 5 }}
            >
              <form className="chat-compose-form" onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '1000px', margin: '0 auto' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  accept="image/*,application/pdf"
                />
                <button
                  type="button"
                  style={{
                    padding: '10px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--steel)',
                    cursor: 'pointer',
                    transition: 'color 0.2s'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--signal)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--steel)'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19"/><path d="M13 15h.01"/></svg>
                </button>
                <input
                  className="chat-message-input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  aria-label="Type a message"
                  style={{
                    flex: 1,
                    backgroundColor: 'var(--paper)',
                    border: '1px solid var(--line)',
                    borderRadius: '24px',
                    padding: '14px 24px',
                    fontSize: '17.6px',
                    color: 'var(--ink)',
                    outline: 'none',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                  }}
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  style={{
                    backgroundColor: 'var(--signal)',
                    color: 'var(--on-signal)',
                    fontWeight: 'bold',
                    padding: '12px 28px',
                    borderRadius: '24px',
                    fontSize: '17.6px',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: input.trim() ? 1 : 0.5,
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(155, 233, 42, 0.3)'
                  }}
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="chat-empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px', color: 'var(--steel)' }}>
            <div style={{ width: '100px', height: '100px', backgroundColor: 'var(--surface)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <h3 style={{ fontSize: '28.6px', fontWeight: '600', color: 'var(--ink)', margin: '0 0 12px 0' }}>Your Messages</h3>
            <p style={{ fontSize: '17.6px', maxWidth: '450px', margin: 0, lineHeight: '1.6', opacity: 0.8 }}>Select a conversation from the left to start chatting with your coach or member.</p>
          </div>
        )}
      </div>
    </div>
  );
}
