import { useState, useEffect, useCallback } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

/**
 * Hook that manages Google OAuth 2.0 via Google Identity Services
 */
export function useAuth() {
  const [user, setUser] = useState(null);       // { name, email, picture }
  const [token, setToken] = useState(null);      // access_token string
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize the token client
  const [tokenClient, setTokenClient] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(interval);

        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (response) => {
            if (response.error) {
              setError(response.error);
              setLoading(false);
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
                setLoading(false);
              })
              .catch(() => setLoading(false));
          },
        });

        setTokenClient(client);
        setLoading(false);
      }
    }, 100);

    // Timeout after 10s
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (!window.google?.accounts?.oauth2) {
        setError('Google Identity Services failed to load. Check your internet connection.');
        setLoading(false);
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const signIn = useCallback(() => {
    if (tokenClient) {
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

  return { user, token, loading, error, signIn, signOut };
}
