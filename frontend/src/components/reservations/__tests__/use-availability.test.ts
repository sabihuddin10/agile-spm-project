import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAvailability } from '@/components/reservations/use-availability';
import { reservationApi } from '@/lib/api';

vi.mock('@/lib/api', () => ({ reservationApi: { availability: vi.fn() } }));

describe('useAvailability', () => {
  it('is disabled (no fetch) until a date and valid party size are given', () => {
    // Arrange / Act
    const { result } = renderHook(() => useAvailability('', 2));

    // Assert
    expect(result.current.ready).toBe(false);
    expect(reservationApi.availability).not.toHaveBeenCalled();
  });

  it('loads slots for the given date and party size', async () => {
    // Arrange
    vi.mocked(reservationApi.availability).mockResolvedValue({ date: '2026-10-10', partySize: 2, slots: [{ time: '19:00', available: true }] });

    // Act
    const { result } = renderHook(() => useAvailability('2026-10-10', 2));

    // Assert
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.slots).toEqual([{ time: '19:00', available: true }]);
    expect(reservationApi.availability).toHaveBeenCalledWith('2026-10-10', 2);
  });

  it('surfaces a load error and clears the slots', async () => {
    // Arrange
    vi.mocked(reservationApi.availability).mockRejectedValue(new Error('network down'));

    // Act
    const { result } = renderHook(() => useAvailability('2026-10-10', 2));

    // Assert
    await waitFor(() => expect(result.current.error).toBe('network down'));
    expect(result.current.slots).toEqual([]);
  });

  it('does not show stale slots from a previous date while the next one loads', async () => {
    // Arrange — queue both responses up front so the stale first call resolves
    // after the second one, regardless of exact effect timing.
    let resolveFirst: (v: { date: string; partySize: number; slots: { time: string; available: boolean }[] }) => void = () => {};
    vi.mocked(reservationApi.availability)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => Promise.resolve({ date: '2026-10-11', partySize: 2, slots: [{ time: '20:00', available: true }] }));
    const { result, rerender } = renderHook(({ date }) => useAvailability(date, 2), { initialProps: { date: '2026-10-10' } });

    // Act — switch date while the first request is still in flight
    rerender({ date: '2026-10-11' });

    // Assert — the stale in-flight response for the old date must not populate slots for the new one
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.slots).toEqual([{ time: '20:00', available: true }]);
    resolveFirst({ date: '2026-10-10', partySize: 2, slots: [{ time: '12:00', available: true }] });
  });
});
