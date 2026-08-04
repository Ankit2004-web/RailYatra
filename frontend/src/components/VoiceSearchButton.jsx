import { Mic } from 'lucide-react';

export default function VoiceSearchButton({ onResult }) {
  const start = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice search is not supported in this browser.');
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'en-IN';
    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onResult?.(text);
    };
    rec.start();
  };

  return (
    <button type="button" className="btn btn-ghost btn-sm voice-search-btn" onClick={start} aria-label="Voice search">
      <Mic size={16} /> Voice
    </button>
  );
}
