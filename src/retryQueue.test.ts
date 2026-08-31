import { beforeEach, describe, expect, it } from 'vitest';
import { loadPendingWorklogs, queuePendingWorklog, removePendingWorklog } from './retryQueue';
import { resetMockState } from './mockClient';

beforeEach(() => {
  resetMockState();
});

describe('queuePendingWorklog / loadPendingWorklogs / removePendingWorklog', () => {
  it('starts empty', async () => {
    expect(await loadPendingWorklogs()).toEqual([]);
  });

  it('assigns an id and persists queued entries', async () => {
    await queuePendingWorklog({ issueKey: 'DESK-1', seconds: 900, createdAt: 1 });
    const pending = await loadPendingWorklogs();

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ issueKey: 'DESK-1', seconds: 900, createdAt: 1 });
    expect(pending[0].id).toBeTruthy();
  });

  it('queues multiple entries independently', async () => {
    await queuePendingWorklog({ issueKey: 'DESK-1', seconds: 900, createdAt: 1 });
    await queuePendingWorklog({ issueKey: 'DESK-2', seconds: 300, createdAt: 2 });

    const pending = await loadPendingWorklogs();
    expect(pending).toHaveLength(2);
    expect(pending.map(p => p.issueKey)).toEqual(['DESK-1', 'DESK-2']);
  });

  it('removes only the entry with the matching id', async () => {
    await queuePendingWorklog({ issueKey: 'DESK-1', seconds: 900, createdAt: 1 });
    await queuePendingWorklog({ issueKey: 'DESK-2', seconds: 300, createdAt: 2 });
    const [toRemove] = await loadPendingWorklogs();

    await removePendingWorklog(toRemove.id);

    const after = await loadPendingWorklogs();
    expect(after).toHaveLength(1);
    expect(after[0].issueKey).toBe('DESK-2');
  });
});
