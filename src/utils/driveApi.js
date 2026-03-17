/**
 * Google Drive API v3 — client-side wrapper
 *
 * All calls go directly to the REST API using the OAuth access token.
 * No gapi client library needed.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/**
 * Generic fetch wrapper with auth header
 */
async function driveRequest(endpoint, token, params = {}) {
  const url = new URL(`${DRIVE_API}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Drive API error: ${res.status}`);
  }

  return res.json();
}

/**
 * Search files in the Shared Drive.
 *
 * @param {string} token - OAuth access token
 * @param {object} options
 * @param {string} options.sharedDriveId - The Shared Drive ID
 * @param {string} [options.query] - Search text (searches name + fullText)
 * @param {string} [options.folderId] - Restrict to files inside this folder
 * @param {string} [options.mimeType] - e.g. 'application/vnd.google-apps.document'
 * @param {string} [options.owner] - Owner email to filter by
 * @param {string} [options.modifiedAfter] - ISO date string
 * @param {string} [options.modifiedBefore] - ISO date string
 * @param {string} [options.pageToken] - For pagination
 * @param {number} [options.pageSize] - Results per page (max 100)
 * @param {string} [options.orderBy] - e.g. 'modifiedTime desc'
 */
export async function searchFiles(token, options = {}) {
  const {
    sharedDriveId,
    query,
    folderId,
    mimeType,
    owner,
    modifiedAfter,
    modifiedBefore,
    pageToken,
    pageSize = 50,
    orderBy = 'modifiedTime desc',
  } = options;

  // Build the query string
  const conditions = ['trashed = false'];

  if (query) {
    // fullText search covers file name + content for Google Docs/Sheets/Slides
    conditions.push(`fullText contains '${query.replace(/'/g, "\\'")}'`);
  }

  if (folderId) {
    conditions.push(`'${folderId}' in parents`);
  }

  if (mimeType) {
    if (mimeType === 'folder') {
      conditions.push(`mimeType = 'application/vnd.google-apps.folder'`);
    } else if (mimeType === 'document') {
      conditions.push(`(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/pdf' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')`);
    } else if (mimeType === 'spreadsheet') {
      conditions.push(`(mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')`);
    } else if (mimeType === 'presentation') {
      conditions.push(`(mimeType = 'application/vnd.google-apps.presentation' or mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation')`);
    } else if (mimeType === 'image') {
      conditions.push(`mimeType contains 'image/'`);
    } else {
      conditions.push(`mimeType = '${mimeType}'`);
    }
  }

  if (owner) {
    conditions.push(`'${owner}' in owners`);
  }

  if (modifiedAfter) {
    conditions.push(`modifiedTime > '${modifiedAfter}'`);
  }

  if (modifiedBefore) {
    conditions.push(`modifiedTime < '${modifiedBefore}'`);
  }

  const q = conditions.join(' and ');

  const result = await driveRequest('/files', token, {
    q,
    corpora: 'drive',
    driveId: sharedDriveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink, iconLink, owners, parents, createdTime, lastModifyingUser, starred)',
    pageSize,
    pageToken,
    orderBy,
  });

  return {
    files: result.files || [],
    nextPageToken: result.nextPageToken || null,
  };
}

/**
 * Get a single file's metadata (including full path)
 */
export async function getFile(token, fileId) {
  return driveRequest(`/files/${fileId}`, token, {
    supportsAllDrives: true,
    fields: 'id, name, mimeType, modifiedTime, size, webViewLink, iconLink, owners, parents, createdTime, lastModifyingUser',
  });
}

/**
 * Recursively resolve the folder path for a file
 */
export async function getFilePath(token, fileId, sharedDriveId) {
  const parts = [];
  let currentId = fileId;

  while (currentId && currentId !== sharedDriveId) {
    try {
      const file = await driveRequest(`/files/${currentId}`, token, {
        supportsAllDrives: true,
        fields: 'id, name, parents',
      });
      parts.unshift(file.name);
      currentId = file.parents?.[0] || null;
    } catch {
      break;
    }
  }

  return parts;
}

/**
 * List all unique owners/contributors in the Shared Drive
 * (samples recent files to extract owner info)
 */
export async function listOwners(token, sharedDriveId) {
  const result = await searchFiles(token, {
    sharedDriveId,
    pageSize: 100,
    orderBy: 'modifiedTime desc',
  });

  const owners = new Map();
  for (const file of result.files) {
    if (file.owners) {
      for (const o of file.owners) {
        if (o.emailAddress && !owners.has(o.emailAddress)) {
          owners.set(o.emailAddress, {
            email: o.emailAddress,
            name: o.displayName || o.emailAddress,
            photoLink: o.photoLink || null,
          });
        }
      }
    }
    if (file.lastModifyingUser?.emailAddress) {
      const u = file.lastModifyingUser;
      if (!owners.has(u.emailAddress)) {
        owners.set(u.emailAddress, {
          email: u.emailAddress,
          name: u.displayName || u.emailAddress,
          photoLink: u.photoLink || null,
        });
      }
    }
  }

  return Array.from(owners.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * List top-level folders in the Shared Drive (for the area filter)
 */
export async function listTopFolders(token, sharedDriveId) {
  const result = await driveRequest('/files', token, {
    q: `'${sharedDriveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    corpora: 'drive',
    driveId: sharedDriveId,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    fields: 'files(id, name)',
    pageSize: 50,
    orderBy: 'name',
  });

  return result.files || [];
}

/**
 * Get Shared Drive metadata
 */
export async function getDriveInfo(token, sharedDriveId) {
  const res = await fetch(`${DRIVE_API}/drives/${sharedDriveId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Could not fetch drive info');
  return res.json();
}
