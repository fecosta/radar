import { useState, useEffect, useCallback, useRef } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

// Fallback in case GIS answers the silent request through neither callback
// (happens when third-party cookies are blocked). Without it the app would
// sit on the splash forever with no way to sign in.
const SILENT_TIMEOUT_MS = 8000;

/**
 * Hook that manages Google OAuth 2.0 via Google Identity Services
 *
 * On load it asks GIS for a token silently: if the browser still has a live Google
 * session and the user previously consented, they are signed straight back in. Nothing
 * is persisted by this app — the session lives in Google's own cookie.
 */
export function useAuth() {
  const [user, setUser] = useState(null);       // { name, email, picture }
  const [token, setToken] = useState(null);      // access_token string
  const [initializing, setInitializing] = useState(true); // GIS loading + silent attempt
  const [loading, setLoading] = useState(false); // interactive sign-in in flight
  const [error, setError] = useState(null);

  // Initialize the token client
  const [tokenClient, setTokenClient] = useState(null);

  // These refs deliberately survive StrictMode's mount/cleanup/mount cycle, so the
  // silent request fires exactly once even though the effect body runs twice in dev.
  const silentRef = useRef(false);   // silent request already fired
  const settledRef = useRef(false);  // initializing already resolved
  const safetyRef = useRef(null);    // silent-request fallback timer

  useEffect(() => {
    // Resolve the startup phase exactly once, whichever path gets here first.
    const finishInit = () => {
      if (settledRef.current) return;
      settledRef.current = true;
      clearTimeout(safetyRef.current);
      setInitializing(false);
    };

    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);
        clearTimeout(timeout);

        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response) => {
            setLoading(false);
            if (response.error) {
              setError(response.error);
              finishInit();
              return;
            }
            setToken(response.access_token);
            // Fetch user info
            fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            })
              .then(r => r.json())
              .then(info => {
                setUser({
                  name: info.name,
                  email: info.email,
                  picture: info.picture,
                });
                finishInit();
              })
              .catch(() => finishInit());
          },
          error_callback: () => {
            // Fires when a silent request cannot be fulfilled (no Google session, consent
            // not previously granted, interaction required) and when an interactive popup
            // is dismissed. Expected on a first visit, so it must not set `error` — the
            // LoginScreen renders that string verbatim.
            setLoading(false);
            finishInit();
          },
        });

        setTokenClient(client);

        // Silent re-auth: return a token without any UI if GIS can, otherwise fall
        // through to error_callback and let the LoginScreen render.
        if (!silentRef.current) {
          silentRef.current = true;
          client.requestAccessToken({ prompt: '' });
          safetyRef.current = setTimeout(finishInit, SILENT_TIMEOUT_MS);
        }
      }
    }, 100);

    // Timeout after 10s
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!window.google?.accounts?.oauth2) {
        setError('Google Identity Services failed to load. Check your internet connection.');
        finishInit();
      }
    }, 10000);

    // The safety timer is intentionally not cleared here — a StrictMode teardown would
    // otherwise disarm the only thing that can rescue a silent request that never answers.
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const signIn = useCallback(() => {
    if (tokenClient) {
      setError(null);
      setLoading(true);
      tokenClient.requestAccessToken();
    }
  }, [tokenClient]);

  const signOut = useCallback(() => {
    if (token) {
      window.google.accounts.oauth2.revoke(token);
    }
    setToken(null);
    setUser(null);
  }, [token]);

  return { user, token, initializing, loading, error, signIn, signOut };
}
