import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Send } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function SupportChat() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    if (!user) return undefined;
    setLoading(true);
    setError('');
    api.post('/support/chat/session')
      .then((res) => {
        setSessionId(res.sessionId);
        setMessages(res.welcome ? [res.welcome] : []);
      })
      .catch(() => setError('Could not start chat session. Please try again.'))
      .finally(() => setLoading(false));
    return undefined;
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !sessionId || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post(`/support/chat/${sessionId}`, { message: text });
      setMessages((prev) => [...prev, res.userMsg, res.agentMsg]);
      setText('');
    } catch (err) {
      setError(err.message || 'Message failed to send.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <section className="support-chat card">
        <h2><MessageCircle size={18} aria-hidden="true" /> Live chat</h2>
        <div className="support-chat-guest">
          <p className="muted">Log in to chat with our support team in real time.</p>
          <Link to="/login" className="btn btn-primary btn-sm">Login for live chat</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="support-chat card">
      <h2><MessageCircle size={18} aria-hidden="true" /> Live chat</h2>
      <div className="support-chat-messages">
        {loading && messages.length === 0 && (
          <p className="muted">Connecting to support…</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble chat-${m.sender}`}>{m.message}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      {error && <p className="chat-error">{error}</p>}
      <form className="support-chat-input" onSubmit={send}>
        <input
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type your message…"
          disabled={!sessionId || loading}
        />
        <button type="submit" className="btn btn-primary btn-sm" disabled={!sessionId || loading || !text.trim()}>
          <Send size={14} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
