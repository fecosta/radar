/**
 * @vitest-environment jsdom
 *
 * Wizard tests. The global vitest environment stays `node` (the classifier suite needs no
 * DOM and benefits from the speed); UI files opt in with the docblock above.
 *
 * Drive, Registry and audit are the in-memory doubles, so no Google credentials are needed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Imported here rather than through a global setup file, so the node-environment suites
// (which have no DOM) are unaffected.
import '@testing-library/jest-dom/vitest';
import { render, screen, within, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CreateStructure from './CreateStructure.jsx';
import { resetOperationStore } from '../../services/operationStore.js';
import { createFakeDrive, createFakeRegistry, createFakeAudit } from '../../services/__fixtures__/fakeDrive.js';
import { DriveError, ERROR_CODE } from '../../services/driveErrors.js';

const CONFIG = {
  sharedDriveId: 'test-shared-drive',
  registrySheetId: 'registry-sheet',
  auditSheetId: 'audit-sheet',
};

const USER = { name: 'Admin', email: 'admin@velezreyesmas.example' };

/** Stub Google Identity Services so the elevated-permission gate can be passed. */
function stubGis({ grant = true } = {}) {
  const requestAccessToken = vi.fn();
  window.google = {
    accounts: {
      oauth2: {
        initTokenClient: ({ callback, error_callback: errorCallback }) => ({
          requestAccessToken: () => {
            requestAccessToken();
            if (grant) callback({ access_token: 'elevated-token' });
            else errorCallback({ type: 'popup_closed' });
          },
        }),
      },
    },
  };
  return requestAccessToken;
}

function setup({ drive, registry, audit, grant = true } = {}) {
  const services = {
    drive: drive || createFakeDrive(),
    registry: registry || createFakeRegistry(),
    audit: audit || createFakeAudit(),
  };
  stubGis({ grant });
  const user = userEvent.setup();
  render(
    <CreateStructure user={USER} config={CONFIG} servicesFactory={() => services} />
  );
  return { user, services };
}

/** Walk from the permission gate to the details step for a pipeline organization. */
async function openPipelineDetails(user) {
  await user.click(screen.getByRole('button', { name: /grant permission/i }));
  await user.click(screen.getByRole('radio', { name: /Pipeline organization/i }));
  await user.click(screen.getByRole('button', { name: /^continue$/i }));
}

async function fillPipeline(user, { name = 'Fundación Luminar', theme = 'Education' } = {}) {
  await user.type(screen.getByLabelText(/Organization name/i), name);
  await user.selectOptions(screen.getByLabelText(/^Theme/i), theme);
}

beforeEach(() => {
  resetOperationStore();
});

afterEach(() => {
  cleanup();
  delete window.google;
});

describe('configuration and permission gates', () => {
  it('refuses to run without a configured Shared Drive', () => {
    stubGis();
    render(<CreateStructure user={USER} config={{ sharedDriveId: '' }} servicesFactory={() => ({})} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/No Shared Drive is configured/i);
  });

  it('asks for elevated permission before showing the wizard, naming the scopes', () => {
    setup();
    expect(screen.getByText(/Search and Classify are read-only/i)).toBeInTheDocument();
    expect(screen.getByText('https://www.googleapis.com/auth/drive')).toBeInTheDocument();
    expect(screen.getByText('https://www.googleapis.com/auth/spreadsheets')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Pipeline organization/i })).not.toBeInTheDocument();
  });

  it('states that RADAR cannot exceed the user’s own Drive role', () => {
    setup();
    expect(screen.getByText(/never do more than your Drive role already allows/i)).toBeInTheDocument();
  });

  it('reports a declined consent without entering the wizard', async () => {
    const { user } = setup({ grant: false });
    await user.click(screen.getByRole('button', { name: /grant permission/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not granted/i);
    expect(screen.queryByRole('radio', { name: /Pipeline organization/i })).not.toBeInTheDocument();
  });
});

describe('structure type step', () => {
  it('offers exactly the six approved structures', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /grant permission/i }));

    const options = screen.getAllByRole('radio');
    // The first child div is the option's title; the second is its description.
    expect(options.map((o) => o.firstChild.textContent)).toEqual([
      'Pipeline organization',
      'Venture Building initiative',
      'In-house program',
      'Policy',
      'Formal governance meeting',
      'Annual OKR cycle',
    ]);
  });

  it('never offers Portfolio creation or a root bootstrap', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /grant permission/i }));

    expect(screen.queryByRole('radio', { name: /portfolio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /bootstrap|seed|example/i })).not.toBeInTheDocument();
  });

  it('is operable with the keyboard as a radio group', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /grant permission/i }));

    const first = screen.getAllByRole('radio')[0];
    first.focus();
    await user.keyboard('{ArrowDown}');

    expect(screen.getByRole('radio', { name: /Venture Building/i })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('conditional fields', () => {
  it('shows object fields for a pipeline organization', async () => {
    const { user } = setup();
    await openPipelineDetails(user);

    expect(screen.getByLabelText(/Organization name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Theme/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Owner/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Strategic focus/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Meeting log year/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Forum/i)).not.toBeInTheDocument();
  });

  it('shows only a name for a policy', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /grant permission/i }));
    await user.click(screen.getByRole('radio', { name: /Policy/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByLabelText(/Policy name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Theme/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Meeting log year/i)).not.toBeInTheDocument();
  });

  it('shows forum and date for a governance meeting, and only approved forums', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /grant permission/i }));
    await user.click(screen.getByRole('radio', { name: /Formal governance meeting/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    const forum = screen.getByLabelText(/Forum/i);
    const labels = within(forum)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels).toEqual(['Select a forum', 'Board', 'Leadership Team', 'All Team', 'Offsites']);
    expect(labels.join(' ')).not.toMatch(/concept review|investment committee/i);
    expect(screen.getByLabelText(/Meeting date/i)).toBeInTheDocument();
  });

  it('marks strategic focus as metadata that never becomes a folder', async () => {
    const { user } = setup();
    await openPipelineDetails(user);
    expect(screen.getByText(/strategic focus never becomes a folder/i)).toBeInTheDocument();
  });

  it('defaults the OKR year to the current year', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /grant permission/i }));
    await user.click(screen.getByRole('radio', { name: /Annual OKR cycle/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    expect(screen.getByLabelText(/OKR year/i)).toHaveValue(String(new Date().getFullYear()));
  });
});

describe('validation messages', () => {
  it('reports invalid input instead of previewing', async () => {
    const { user, services } = setup();
    await openPipelineDetails(user);
    await user.type(screen.getByLabelText(/Organization name/i), 'a/b');
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    expect(await screen.findByText(/cannot contain/i)).toBeInTheDocument();
    // Invalid input never reaches Drive at all.
    expect(services.drive._calls.findExactChildren).toBe(0);
  });

  it('associates each error with its field for assistive technology', async () => {
    const { user } = setup();
    await openPipelineDetails(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    const nameField = await screen.findByLabelText(/Organization name/i);
    await waitFor(() => expect(nameField).toHaveAttribute('aria-invalid', 'true'));
    const describedBy = nameField.getAttribute('aria-describedby');
    expect(document.getElementById(describedBy.split(' ').pop())).toHaveTextContent(/is required/i);
  });

  it('accepts a name with accents, a plus sign and an ampersand', async () => {
    const { user } = setup();
    await openPipelineDetails(user);
    await fillPipeline(user, { name: 'Educação & Futuro+' });
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    expect(await screen.findByText(/02_INVESTMENTS_AND_PROGRAMS\/01_PIPELINE\/Education\/Educação & Futuro\+/)).toBeInTheDocument();
  });
});

describe('preview', () => {
  it('shows the destination, counts and full tree', async () => {
    const { user } = setup();
    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    expect(await screen.findByRole('tree', { name: /planned structure/i })).toBeInTheDocument();
    expect(screen.getByText(/17 items will be created/i)).toBeInTheDocument();
    expect(screen.getAllByRole('treeitem')).toHaveLength(17);
    expect(screen.getByText('04_Diligence')).toBeInTheDocument();
  });

  it('labels each item in words, not by colour alone', async () => {
    const { user } = setup();
    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    await screen.findByRole('tree');
    expect(screen.getAllByText('Will create')).toHaveLength(17);
  });

  it('distinguishes items that already exist from items to create', async () => {
    const drive = createFakeDrive();
    drive._seedPath('02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Fundación Luminar');
    const { user } = setup({ drive });

    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    await screen.findByRole('tree');
    expect(screen.getAllByText('Already exists')).toHaveLength(1);
    expect(screen.getAllByText('Will create')).toHaveLength(16);
  });

  it('announces a blocking drift error and refuses to continue', async () => {
    const drive = createFakeDrive({ paths: ['02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE'] });
    const { user } = setup({ drive });

    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/will not create canonical roots/i);
    expect(screen.getByRole('button', { name: /continue to confirmation/i })).toBeDisabled();
  });

  it('shows a loading status while checking Drive', async () => {
    let release;
    const drive = createFakeDrive();
    const slow = {
      ...drive,
      verifySharedDrive: () => new Promise((resolve) => {
        release = () => resolve({ id: CONFIG.sharedDriveId, name: 'RADAR (test)' });
      }),
    };
    const { user } = setup({ drive: slow });

    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Checking the Shared Drive/i);
    release();
  });

  it('surfaces a Drive failure as an actionable message', async () => {
    const drive = createFakeDrive();
    drive.verifySharedDrive = async () => {
      throw new DriveError(ERROR_CODE.PERMISSION_DENIED);
    };
    const { user } = setup({ drive });

    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Content Manager access/i);
  });
});

describe('confirmation gate', () => {
  async function reachConfirm(user) {
    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));
    await screen.findByRole('tree');
    await user.click(screen.getByRole('button', { name: /continue to confirmation/i }));
  }

  it('keeps Create disabled until the operation is explicitly confirmed', async () => {
    const { user, services } = setup();
    await reachConfirm(user);

    const create = screen.getByRole('button', { name: /create structure/i });
    expect(create).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /I confirm creating/i }));
    expect(create).toBeEnabled();
    expect(services.drive._calls.createFolder).toBe(0);
  });

  it('restates exactly what will be created and where', async () => {
    const { user } = setup();
    await reachConfirm(user);

    expect(screen.getByText(/17 new items in RADAR \(test\)/i)).toBeInTheDocument();
    // The path appears twice by design: once as the destination, once inside the
    // confirmation sentence the administrator ticks.
    expect(
      screen.getAllByText('02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Fundación Luminar')
    ).toHaveLength(2);
    expect(screen.getByText(/no automatic rollback/i)).toBeInTheDocument();
  });

  it('requires the sensitive-folder warning to be acknowledged separately', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /grant permission/i }));
    await user.click(screen.getByRole('radio', { name: /In-house program/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.type(screen.getByLabelText(/Program name/i), 'Talento Futuro');
    await user.selectOptions(screen.getByLabelText(/^Theme/i), 'Education');
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));
    await screen.findByRole('tree');

    expect(screen.getByText('RESTRICTED')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue to confirmation/i }));

    const create = screen.getByRole('button', { name: /create structure/i });
    await user.click(screen.getByRole('checkbox', { name: /I confirm creating/i }));
    // Confirmed, but the restricted-folder warning is still unacknowledged.
    expect(create).toBeDisabled();

    await user.click(screen.getByRole('checkbox', { name: /cannot configure its access/i }));
    expect(create).toBeEnabled();
  });

  it('invalidates the preview when an input changes afterwards', async () => {
    const { user } = setup();
    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));
    await screen.findByRole('tree');

    await user.click(screen.getByRole('button', { name: /^back$/i }));
    await user.type(screen.getByLabelText(/Organization name/i), ' Renamed');
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    expect(
      await screen.findByText(/02_INVESTMENTS_AND_PROGRAMS\/01_PIPELINE\/Education\/Fundación Luminar Renamed/)
    ).toBeInTheDocument();
  });
});

describe('execution and results', () => {
  async function createPipeline(user) {
    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));
    await screen.findByRole('tree');
    await user.click(screen.getByRole('button', { name: /continue to confirmation/i }));
    await user.click(screen.getByRole('checkbox', { name: /I confirm creating/i }));
    await user.click(screen.getByRole('button', { name: /create structure/i }));
  }

  it('reports success with a link, counts and the Registry result', async () => {
    const { user, services } = setup();
    await createPipeline(user);

    expect(await screen.findByText(/Structure created/i)).toBeInTheDocument();
    expect(screen.getByText(/17 items created/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open folder in drive/i })).toHaveAttribute('href');
    expect(screen.getByText(/A Master Registry record was created/i)).toBeInTheDocument();
    expect(services.registry._rows).toHaveLength(1);
    expect(services.audit._events).toHaveLength(1);
  });

  it('lists created items for the audit reader', async () => {
    const { user } = setup();
    await createPipeline(user);

    await screen.findByText(/Structure created/i);
    await user.click(screen.getByText(/^Created \(17\)$/));
    expect(
      screen.getByText('02_INVESTMENTS_AND_PROGRAMS/01_PIPELINE/Education/Fundación Luminar/02_Sourcing')
    ).toBeInTheDocument();
  });

  it('prevents a double submit while the operation is running', async () => {
    const drive = createFakeDrive();
    let resolveCreate;
    const original = drive.createFolder.bind(drive);
    let first = true;
    drive.createFolder = async (parentId, name) => {
      if (first) {
        first = false;
        await new Promise((resolve) => {
          resolveCreate = resolve;
        });
      }
      return original(parentId, name);
    };

    const { user } = setup({ drive });
    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));
    await screen.findByRole('tree');
    await user.click(screen.getByRole('button', { name: /continue to confirmation/i }));
    await user.click(screen.getByRole('checkbox', { name: /I confirm creating/i }));

    const create = screen.getByRole('button', { name: /create structure/i });
    await user.click(create);

    // While in flight the button is disabled and the busy state is announced.
    await waitFor(() => expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled());
    expect(screen.getByText(/Do not close this tab/i)).toBeInTheDocument();

    resolveCreate();
    await screen.findByText(/Structure created/i);
    expect(drive._calls.createFolder).toBe(16);
  });

  it('reports partial success precisely and never implies a rollback', async () => {
    const drive = createFakeDrive();
    drive._failOnCreate('02_Sourcing', new DriveError(ERROR_CODE.RATE_LIMITED, { status: 429 }));
    const { user } = setup({ drive });

    await createPipeline(user);

    expect(await screen.findByText(/Partly completed/i)).toBeInTheDocument();
    expect(screen.getByText(/left in place — nothing was deleted or rolled back/i)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/rate-limiting/i);
  });

  it('offers a safe retry after a failure and completes on the second run', async () => {
    const drive = createFakeDrive();
    drive._failOnCreate('02_Sourcing', new DriveError(ERROR_CODE.RATE_LIMITED, { status: 429 }));
    const { user } = setup({ drive });

    await createPipeline(user);
    await screen.findByText(/Partly completed/i);

    await user.click(screen.getByRole('button', { name: /retry safely/i }));
    await screen.findByRole('tree');
    await user.click(screen.getByRole('button', { name: /continue to confirmation/i }));
    await user.click(screen.getByRole('checkbox', { name: /I confirm creating/i }));
    await user.click(screen.getByRole('button', { name: /create structure/i }));

    expect(await screen.findByText(/Structure created/i)).toBeInTheDocument();
    // The items from the first partial run were reused rather than duplicated.
    expect(screen.getByText(/Reused \(already existed\) \(\d+\)/)).toBeInTheDocument();
  });

  it('names why the audit write failed instead of a generic message', async () => {
    // Regression: this used to render "Tell the RADAR owner" for every cause, so a wrong
    // spreadsheet ID was indistinguishable from a bad header row or a missing scope.
    const audit = createFakeAudit({ failOnRecord: new DriveError(ERROR_CODE.NOT_FOUND) });
    const { user } = setup({ audit });
    await createPipeline(user);

    expect(await screen.findByText(/Structure created/i)).toBeInTheDocument();
    expect(screen.getByText(/VITE_RADAR_AUDIT_SHEET_ID/)).toBeInTheDocument();
    expect(screen.queryByText(/^The audit entry could not be written\./)).not.toBeInTheDocument();
  });

  it('tells the reader the Drive change happened even though it went unrecorded', async () => {
    const audit = createFakeAudit({ failOnRecord: new DriveError(ERROR_CODE.CONFIGURATION) });
    const { user } = setup({ audit });
    await createPipeline(user);

    expect(await screen.findByText(/header row is missing required columns/i)).toBeInTheDocument();
    expect(screen.getByText(/DID happen but are not recorded/i)).toBeInTheDocument();
  });

  it('says plainly when no durable audit trail exists', async () => {
    const { user } = setup({ audit: createFakeAudit({ configured: false }) });
    await createPipeline(user);

    expect(await screen.findByText(/Structure created/i)).toBeInTheDocument();
    expect(screen.getByText(/not recorded in a durable audit trail/i)).toBeInTheDocument();
  });

  it('reports a pending Registry rather than pretending it was written', async () => {
    const { user } = setup({ registry: createFakeRegistry({ configured: false }) });
    await createPipeline(user);

    expect(await screen.findByText(/Structure created/i)).toBeInTheDocument();
    expect(screen.getByText(/no Registry record was written. This is still pending/i)).toBeInTheDocument();
  });

  it('never claims access was restricted for the sensitive folder', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /grant permission/i }));
    await user.click(screen.getByRole('radio', { name: /In-house program/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    await user.type(screen.getByLabelText(/Program name/i), 'Talento Futuro');
    await user.selectOptions(screen.getByLabelText(/^Theme/i), 'Education');
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));
    await screen.findByRole('tree');
    await user.click(screen.getByRole('button', { name: /continue to confirmation/i }));
    await user.click(screen.getByRole('checkbox', { name: /cannot configure its access/i }));
    await user.click(screen.getByRole('checkbox', { name: /I confirm creating/i }));
    await user.click(screen.getByRole('button', { name: /create structure/i }));

    await screen.findByText(/Structure created/i);
    expect(document.body.textContent).not.toMatch(/access (has been|was) restricted/i);
  });
});

describe('accessibility', () => {
  it('marks the current step for assistive technology', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /grant permission/i }));

    const nav = screen.getByRole('navigation', { name: /progress/i });
    expect(within(nav).getByText('Structure type').closest('li')).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByRole('radio', { name: /Policy/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));
    expect(within(nav).getByText('Details').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('moves focus to the heading on each step change', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /grant permission/i }));
    await user.click(screen.getByRole('radio', { name: /Policy/i }));
    await user.click(screen.getByRole('button', { name: /^continue$/i }));

    await waitFor(() => expect(document.activeElement.tagName).toBe('H3'));
    expect(document.activeElement).toHaveTextContent(/Policy/);
  });

  it('gives the preview tree proper ARIA levels', async () => {
    const { user } = setup();
    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    const tree = await screen.findByRole('tree');
    const items = within(tree).getAllByRole('treeitem');
    expect(items[0]).toHaveAttribute('aria-level', '1');
    expect(items[0]).toHaveAttribute('aria-expanded', 'true');
    expect(items[1]).toHaveAttribute('aria-level', '2');
    // Leaves advertise no expanded state.
    expect(items[1]).not.toHaveAttribute('aria-expanded');
  });

  it('lets the keyboard move through the tree with a single tab stop', async () => {
    const { user } = setup();
    await openPipelineDetails(user);
    await fillPipeline(user);
    await user.click(screen.getByRole('button', { name: /validate and preview/i }));

    const tree = await screen.findByRole('tree');
    const items = within(tree).getAllByRole('treeitem');
    expect(items.filter((i) => i.getAttribute('tabindex') === '0')).toHaveLength(1);

    items[0].focus();
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);
    await user.keyboard('{End}');
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('labels every form control', async () => {
    const { user } = setup();
    await openPipelineDetails(user);

    for (const control of screen.getAllByRole('textbox')) {
      expect(control).toHaveAccessibleName();
    }
    expect(screen.getByRole('combobox')).toHaveAccessibleName();
  });
});
