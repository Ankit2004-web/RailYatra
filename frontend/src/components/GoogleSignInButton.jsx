import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Google Sign-In')), { once: true });
      if (window.google?.accounts?.id) resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google Sign-In'));
    document.head.appendChild(script);
  });
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.1-3.5 5.5-6.6 6.5l6.3 5.3C37.8 37.3 44 32 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export default function GoogleSignInButton({ onCredential, onError, disabled = false }) {
  const overlayRef = useRef(null);
  const wrapRef = useRef(null);
  const callbacksRef = useRef({ onCredential, onError });
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);

  callbacksRef.current = { onCredential, onError };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        const config = await api.get('/oauth/google/config').catch(() => ({ clientId: '', enabled: false }));
        const clientId = String(config.clientId || envClientId || '').trim();
        if (!clientId || cancelled) {
          setEnabled(false);
          return;
        }

        await loadGoogleIdentity();
        if (cancelled || !window.google?.accounts?.id) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            try {
              if (!response?.credential) {
                throw new Error('Google did not return a sign-in token');
              }
              await callbacksRef.current.onCredential(response.credential);
            } catch (err) {
              callbacksRef.current.onError?.(err);
            }
          },
          ux_mode: 'popup',
          use_fedcm_for_prompt: true,
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true
        });

        if (!cancelled) {
          setEnabled(true);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setEnabled(false);
          callbacksRef.current.onError?.(err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !overlayRef.current || !window.google?.accounts?.id) return;

    const render = () => {
      if (!overlayRef.current || !wrapRef.current) return;
      overlayRef.current.innerHTML = '';
      const width = Math.max(240, Math.min(400, Math.floor(wrapRef.current.clientWidth || 320)));
      window.google.accounts.id.renderButton(overlayRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'left',
        width
      });
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, [ready]);

  const handleFallbackClick = () => {
    if (disabled) return;
    window.google?.accounts?.id?.prompt();
  };

  if (!enabled) return null;

  return (
    <div className={`google-signin-block${disabled ? ' is-disabled' : ''}`}>
      <p className="auth-divider">or</p>
      <div className="google-signin-custom-wrap" ref={wrapRef}>
        <button
          type="button"
          className="btn btn-outline btn-block auth-register-btn google-signin-custom"
          disabled={disabled}
          onClick={handleFallbackClick}
        >
          <GoogleMark />
          Continue with Google
        </button>
        <div className="google-signin-hit" ref={overlayRef} aria-hidden="true" />
      </div>
    </div>
  );
}
