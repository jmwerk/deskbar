import { describe, expect, it } from 'vitest';
import { parseConfig } from './config';

describe('parseConfig', () => {
  it('leaves jira null when any of the three fields is missing', () => {
    const config = parseConfig({ jiraBaseUrl: 'https://x.atlassian.net', jiraEmail: 'a@b.com' });
    expect(config.jira).toBeNull();
  });

  it('builds jira config once all three fields are present', () => {
    const config = parseConfig({
      jiraBaseUrl: 'https://x.atlassian.net',
      jiraEmail: 'a@b.com',
      jiraApiToken: 'tok',
    });
    expect(config.jira).toEqual({ baseUrl: 'https://x.atlassian.net', email: 'a@b.com', apiToken: 'tok' });
  });

  it('falls back to the default JQL and 25-minute default when unset', () => {
    const config = parseConfig({});
    expect(config.jiraJql).toMatch(/assignee = currentUser/);
    expect(config.defaultFocusMinutes).toBe(25);
  });

  it('parses an overridden default focus length', () => {
    expect(parseConfig({ defaultFocusMinutes: '45' }).defaultFocusMinutes).toBe(45);
  });

  it('defaults the webhook format to json when unset', () => {
    expect(parseConfig({}).focusWebhookFormat).toBe('json');
  });

  it('accepts a configured webhook format', () => {
    expect(parseConfig({ focusWebhookFormat: 'slack' }).focusWebhookFormat).toBe('slack');
    expect(parseConfig({ focusWebhookFormat: 'teams' }).focusWebhookFormat).toBe('teams');
  });

  it('falls back to json for an unrecognized webhook format value', () => {
    expect(parseConfig({ focusWebhookFormat: 'discord' }).focusWebhookFormat).toBe('json');
  });

  it('leaves timezone unset when not configured', () => {
    expect(parseConfig({}).timezone).toBeUndefined();
  });

  it('accepts a valid IANA timezone', () => {
    expect(parseConfig({ timezone: 'America/New_York' }).timezone).toBe('America/New_York');
  });

  it('discards an invalid timezone rather than let it break every date computation', () => {
    expect(parseConfig({ timezone: 'Not/AZone' }).timezone).toBeUndefined();
  });

  it('reads 12-hour unless 24h is chosen', () => {
    expect(parseConfig({}).hour12).toBe(true);
    expect(parseConfig({ clockFormat: '24h' }).hour12).toBe(false);
  });

  it('accepts a known clock face and falls back to digital otherwise', () => {
    expect(parseConfig({ clockFace: 'analog' }).clockFace).toBe('analog');
    expect(parseConfig({ clockFace: 'sundial' }).clockFace).toBe('digital');
  });
});

describe('parseConfig, time tracking options', () => {
  it('cleans up a pasted Jira link and stray spaces in the credentials', () => {
    const config = parseConfig({
      jiraBaseUrl: 'team.atlassian.net/browse/DESK-2',
      jiraEmail: ' a@b.com ',
      jiraApiToken: 'tok ',
    });
    expect(config.jira).toEqual({ baseUrl: 'https://team.atlassian.net', email: 'a@b.com', apiToken: 'tok' });
  });

  it('defaults to no rounding, no target and no nudge', () => {
    const config = parseConfig({});
    expect(config).toMatchObject({ roundToMinutes: 0, dailyTargetS: 0 });
    expect(config.nudgeAt).toBeUndefined();
    expect(config.startStatus).toBeUndefined();
  });

  it('reads statuses, rounding, target and nudge time', () => {
    const config = parseConfig({
      startStatus: 'In Progress',
      doneStatus: ' Done ',
      roundTo: '15',
      dailyTargetHours: '6.5',
      nudgeAt: '17:30',
    });
    expect(config).toMatchObject({
      startStatus: 'In Progress',
      doneStatus: 'Done',
      roundToMinutes: 15,
      dailyTargetS: 6.5 * 3600,
      nudgeAt: '17:30',
    });
  });

  it('ignores a malformed nudge time or target', () => {
    const config = parseConfig({ nudgeAt: '5pm', dailyTargetHours: '-2' });
    expect(config.nudgeAt).toBeUndefined();
    expect(config.dailyTargetS).toBe(0);
  });
});
