import { useEffect, useState } from 'react';
import { loadCaptcha } from '../api/captcha';

export default function CaptchaField({ onChange }) {
  const [challenge, setChallenge] = useState(null);
  const [answer, setAnswer] = useState('');

  const refresh = async () => {
    const data = await loadCaptcha();
    setChallenge(data);
    setAnswer('');
    onChange({ captchaId: data.captchaId, captchaAnswer: '' });
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="field captcha-field">
      <label htmlFor="captcha-answer">Security check</label>
      <div className="captcha-row">
        <span className="captcha-question">{challenge?.question || 'Loading…'}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>↻</button>
      </div>
      <input
        id="captcha-answer"
        className="input"
        value={answer}
        onChange={(e) => {
          setAnswer(e.target.value);
          onChange({ captchaId: challenge?.captchaId, captchaAnswer: e.target.value });
        }}
        placeholder="Answer"
        required
      />
    </div>
  );
}
