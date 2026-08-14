import { useCallback, useRef, useState } from 'react';
import { STRUCTURE_WRITE_SCOPES } from '../services/structureServices.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Incremental authorization for Drive writes.
 *
 * Search and Classify run on `drive.readonly`. The write scopes are requested only when an
 * administrator actually opens the Create workflow, so the ordinary reader never consents to
 * anything that can modify the Shared Drive.
 *
 * The elevated token lives in this hook's state for the session only: it is never written to
 * localStorage, never logged, and never sent anywhere except Google's own APIs. RADAR holds
 * no service-account key and no long-lived credential of any kind.
 *
 * The token is not the authorization decision. Holding it only means Google agreed to issue
 * it — whether a folder may actually be created is decided by the user's Shared Drive role
 * and enforced by Google on the write itself.
 */
export function useElevatedAuth() {
  const [token, setToken] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState(null);
  const clientRef = useRef(null);

  const getClient = useCallback(() => {
    if (clientRef.current) return clientRef.current;
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) return null;

    clientRef.current = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: STRUCTURE_WRITE_SCOPES.join(' '),
      // Carry the already-granted read scope forward so one token serves the whole session.
      include_granted_scopes: true,
      callback: (response) => {
        setRequesting(false);
        if (response.error) {
          setError('Google did not grant the permissions needed to create folders.');
          return;
        }
        setError(null);
        setToken(response.access_token);
      },
      error_callback: () => {
        // Also fires when the consent popup is dismissed, which is a normal user choice.
        setRequesting(false);
        setError('Permission to create folders was not granted.');
      },
    });
    return clientRef.current;
  }, []);

  const requestAccess = useCallback(() => {
    const client = getClient();
    if (!client) {
      setError('Google Identity Services is not available. Reload the page and try again.');
      return;
    }
    setError(null);
    setRequesting(true);
    client.requestAccessToken();
  }, [getClient]);

  /** Drop the elevated token, returning the session to read-only. */
  const clearAccess = useCallback(() => {
    setToken(null);
    setError(null);
  }, []);

  return { token, requesting, error, requestAccess, clearAccess };
}
