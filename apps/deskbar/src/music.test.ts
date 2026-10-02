import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { mockClient, resetMockState } from './mockClient';
import { lyricIndex, useBrowseTracks, useLyrics, useLyricsPreference } from './music';

beforeEach(() => resetMockState());

describe('lyricIndex', () => {
  const lines = [
    { startMs: 1000, text: 'one' },
    { startMs: 5000, text: 'two' },
    { startMs: 9000, text: 'three' },
  ];

  it('is -1 before the first line starts', () => {
    expect(lyricIndex(lines, 500)).toBe(-1);
  });

  it('holds a line until the next one starts', () => {
    expect(lyricIndex(lines, 1000)).toBe(0);
    expect(lyricIndex(lines, 4999)).toBe(0);
    expect(lyricIndex(lines, 5000)).toBe(1);
    expect(lyricIndex(lines, 60_000)).toBe(2);
  });
});

describe('useLyrics', () => {
  it('returns synced lines for the track playing', async () => {
    const { result } = renderHook(() => useLyrics(mockClient, 'spotify:track:mock-0'));
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('synced'));
  });

  it('reports a track with no lyrics', async () => {
    await act(async () => mockClient.player.skipNext());
    const { result } = renderHook(() => useLyrics(mockClient, 'spotify:track:mock-1'));
    await waitFor(() => expect(result.current.status).toBe('none'));
  });

  it('drops a reply for a different track than the one asked about', async () => {
    const { result } = renderHook(() => useLyrics(mockClient, 'spotify:track:mock-4'));
    await new Promise(r => setTimeout(r, 20));
    expect(result.current.status).toBe('loading');
  });
});

describe('useBrowseTracks', () => {
  it("lists the artist's tracks", async () => {
    const { result } = renderHook(() => useBrowseTracks(mockClient, 'spotify:artist:mock-auto-reply', 30));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const state = result.current;
    expect(state.status === 'ready' && state.items.map(t => t.title)).toEqual(['Inbox Zero', 'Async by Default']);
  });

  it("lists a playlist's tracks in order", async () => {
    const { result } = renderHook(() => useBrowseTracks(mockClient, 'spotify:playlist:mock-deep-work', 500));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const state = result.current;
    expect(state.status === 'ready' && state.items).toHaveLength(6);
  });

  it('caps the list at the given maximum', async () => {
    const { result } = renderHook(() => useBrowseTracks(mockClient, 'spotify:playlist:mock-deep-work', 2));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const state = result.current;
    expect(state.status === 'ready' && state.items.map(t => t.title)).toEqual([
      'Heads Down',
      'Five More Minutes (Calendar Invite Declined Remix)',
    ]);
  });

  it('reports an error when the phone cannot browse the artist', async () => {
    const { result } = renderHook(() => useBrowseTracks(mockClient, 'spotify:artist:unknown', 30));
    await waitFor(() => expect(result.current.status).toBe('error'));
  });
});

describe('useLyricsPreference', () => {
  it('starts on, and remembers being turned off across a remount', async () => {
    const first = renderHook(() => useLyricsPreference(mockClient));
    expect(first.result.current[0]).toBe(true);
    act(() => first.result.current[1]());
    expect(first.result.current[0]).toBe(false);
    first.unmount();

    const second = renderHook(() => useLyricsPreference(mockClient));
    await waitFor(() => expect(second.result.current[0]).toBe(false));
    act(() => second.result.current[1]());
    expect(second.result.current[0]).toBe(true);
  });
});
