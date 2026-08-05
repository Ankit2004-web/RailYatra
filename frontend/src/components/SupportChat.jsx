import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Send, Bot } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function SupportChat() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!user) return undefined;
    setConnecting(true);
    setError('');
    api.post('/support/chat/session')
      .then((res) => {
        setSessionId(res.sessionId);
        setMessages(res.welcome ? [res.welcome] : []);
        setAiEnabled(Boolean(res.aiEnabled));
      })
      .catch(() => setError('Could not start chat session. Please try again.'))
      .finally(() => setConnecting(false));
    return undefined;
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !sessionId || sending) return;
    const outgoing = text.trim();
    setSending(true);
    setError('');
    setText('');
    try {
      const res = await api.post(`/support/chat/${sessionId}`, { message: outgoing });
      setMessages((prev) => [...prev, res.userMsg, res.agentMsg]);
      if (res.provider && res.provider !== 'fallback') setAiEnabled(true);
    } catch (err) {
      setText(outgoing);
      setError(err.message || 'Message failed to send.');
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <section className="support-chat card support-panel">
        <div className="support-panel-head">
          <div>
            <h2><MessageCircle size={18} aria-hidden="true" /> Live Chat</h2>
            <p>Chat with our support team in real time</p>
          </div>
        </div>
        <div className="support-chat-guest">
          <p>Sign in to start a secure live chat session about bookings, refunds, or ticket issues.</p>
          <Link to="/login" className="btn btn-primary btn-sm">Login for live chat</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="support-chat card support-panel">
      <div className="support-panel-head">
        <div>
          <h2>
            {aiEnabled ? <Bot size={18} aria-hidden="true" /> : <MessageCircle size={18} aria-hidden="true" />}
            {' '}
            {aiEnabled ? 'AI Support Assistant' : 'Live Chat'}
          </h2>
          <p>{aiEnabled ? 'Powered by AI — ask anything about RailYatra' : 'Ask about bookings, refunds, or PNR status'}</p>
        </div>
        <span className="support-chat-status">
          <span className="support-chat-status-dot" aria-hidden="true" />
          {aiEnabled ? 'AI Online' : 'Online'}
        </span>
      </div>

      <div className="support-chat-messages">
        {connecting && messages.length === 0 && (
          <p className="support-chat-empty">Connecting to support…</p>
        )}
        {!connecting && messages.length === 0 && (
          <p className="support-chat-empty">
            <Bot size={28} aria-hidden="true" />
            Send a message to start the conversation.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble chat-${m.sender}`}>{m.message}</div>
        ))}
        {sending && (
          <div className="chat-bubble chat-agent chat-typing" aria-live="polite">
            <span className="typing-dots"><span /><span /><span /></span>
            {aiEnabled ? 'AI is typing…' : 'Support is typing…'}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="chat-error">{error}</p>}

      <form className="support-chat-input" onSubmit={send}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={aiEnabled ? 'Ask the AI assistant…' : 'Type your message…'}
          disabled={!sessionId || connecting || sending}
          aria-label="Chat message"
        />
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={!sessionId || connecting || sending || !text.trim()}
          aria-label="Send message"
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
