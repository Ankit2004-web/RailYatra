import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { loadCaptcha } from '../api/captcha';

export default function CaptchaField({ onChange }) {
  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await loadCaptcha();
      setChallenge(data);
      setAnswer('');
      onChange({ captchaId: data.captchaId, captchaAnswer: '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="field captcha-field">
      <label htmlFor="captcha-answer">CAPTCHA</label>
      <div className="captcha-challenge">
        {challenge?.image ? (
          <img
            src={challenge.image}
            alt="CAPTCHA characters"
            className="captcha-image"
          />
        ) : (
          <span className="captcha-question">{loading ? 'Loading CAPTCHA…' : 'Could not load CAPTCHA'}</span>
        )}
        <button
          type="button"
          className="captcha-refresh"
          onClick={refresh}
          aria-label="Refresh CAPTCHA"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>
      <input
        id="captcha-answer"
        className="input"
        value={answer}
        onChange={(e) => {
          const value = e.target.value.toUpperCase();
          setAnswer(value);
          onChange({ captchaId: challenge?.captchaId, captchaAnswer: value });
        }}
        placeholder="Enter the characters shown"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck="false"
        maxLength={6}
        required
      />
    </div>
  );
}
