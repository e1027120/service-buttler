import { Clock, FastForward, Pencil, Pin, Rewind, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Select, useToast } from '../../components/ui';
import type { Action, Service } from '../../lib/types';

interface Props {
  actions: Action[];
  services: Service[];
  selectedServiceId: string;
  onSelectService: (id: string) => void;
  onUpdateOffsets: (actionId: string, start: number | null, end: number | null) => Promise<void>;
  onNudge: (actionId: string, deltaMinutes: number) => Promise<void>;
  onPin: (action: Action) => void;
  liveActionId: string | null;
  onEditAction: (action: Action) => void;
  timezone?: string;
}

const MIN_START = -20; // 20m before service starts
const MAX_END = 100; // 100m after start
const TOTAL_MINUTES = MAX_END - MIN_START; // 120 minutes total

function parseBaseTime(timeStr?: string | null): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return { hours: h, minutes: m };
}

export function formatOffsetClock(baseTimeStr: string | null | undefined, offsetMinutes: number): string {
  const base = parseBaseTime(baseTimeStr) || { hours: 9, minutes: 0 };
  let total = base.hours * 60 + base.minutes + offsetMinutes;
  total = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function formatMinuteWithTime(offsetMinutes: number, baseTimeStr?: string | null): string {
  const clock = formatOffsetClock(baseTimeStr, offsetMinutes);
  const prefix = offsetMinutes === 0 ? '0m' : offsetMinutes > 0 ? `+${offsetMinutes}m` : `${offsetMinutes}m`;
  return `${prefix} (${clock})`;
}

export interface NowInZone {
  hours: number;
  minutes: number;
  seconds: number;
  timeStr: string;
  dayOfWeek: number;
  dateStr: string;
}

function getNowInZone(timezone?: string): NowInZone {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

    const h = parseInt(getPart('hour') || '0', 10);
    const m = parseInt(getPart('minute') || '0', 10);
    const s = parseInt(getPart('second') || '0', 10);
    const cleanH = h === 24 ? 0 : h;

    const year = getPart('year') || String(now.getFullYear());
    const month = getPart('month') || String(now.getMonth() + 1).padStart(2, '0');
    const day = getPart('day') || String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const weekdayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const weekdayStr = getPart('weekday');
    const dayOfWeek = weekdayStr in weekdayMap ? weekdayMap[weekdayStr] : now.getDay();

    return {
      hours: cleanH,
      minutes: m,
      seconds: s,
      timeStr: `${cleanH}:${m.toString().padStart(2, '0')}`,
      dayOfWeek,
      dateStr,
    };
  } catch {
    const y = now.getFullYear();
    const mth = (now.getMonth() + 1).toString().padStart(2, '0');
    const d = now.getDate().toString().padStart(2, '0');
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    return {
      hours: h,
      minutes: m,
      seconds: s,
      timeStr: `${h}:${m.toString().padStart(2, '0')}`,
      dayOfWeek: now.getDay(),
      dateStr: `${y}-${mth}-${d}`,
    };
  }
}

export interface BestServiceTimeResult {
  timeStr: string;
  serviceName?: string;
  serviceId?: string;
}

export function findBestServiceTime(
  services: Service[],
  targetServiceId: string | null | undefined,
  nowInZone: NowInZone,
): BestServiceTimeResult {
  const candidateServices =
    targetServiceId && targetServiceId !== 'all' && targetServiceId !== 'church'
      ? services.filter((s) => s.id === targetServiceId)
      : services.filter((s) => s.is_active !== false);

  const effectiveServices = candidateServices.length > 0 ? candidateServices : services;
  const nowMinutesFromMidnight = nowInZone.hours * 60 + nowInZone.minutes + nowInZone.seconds / 60;

  interface CandidateMatch {
    service: Service;
    timeStr: string;
    diffMinutes: number;
    isToday: boolean;
    isInLiveWindow: boolean;
  }

  const matches: CandidateMatch[] = [];

  for (const s of effectiveServices) {
    for (const t of s.service_times || []) {
      if (t.is_active === false || !t.start_time) continue;
      const parsed = parseBaseTime(t.start_time);
      if (!parsed) continue;

      const baseMinutes = parsed.hours * 60 + parsed.minutes;
      let diff = nowMinutesFromMidnight - baseMinutes;
      if (diff < -720) diff += 1440;
      if (diff > 720) diff -= 1440;

      const isToday =
        Boolean(t.specific_date && t.specific_date === nowInZone.dateStr) ||
        Boolean(t.day_of_week !== null && t.day_of_week === nowInZone.dayOfWeek) ||
        (t.specific_date === null && t.day_of_week === null);

      const isInLiveWindow = diff >= MIN_START && diff <= MAX_END;

      matches.push({
        service: s,
        timeStr: t.start_time.slice(0, 5),
        diffMinutes: diff,
        isToday,
        isInLiveWindow,
      });
    }
  }

  if (matches.length === 0) {
    for (const s of services) {
      for (const t of s.service_times || []) {
        if (t.is_active !== false && t.start_time) {
          return { timeStr: t.start_time.slice(0, 5), serviceName: s.name, serviceId: s.id };
        }
      }
    }
    return { timeStr: '09:00' };
  }

  matches.sort((a, b) => {
    const aLiveToday = a.isToday && a.isInLiveWindow;
    const bLiveToday = b.isToday && b.isInLiveWindow;
    if (aLiveToday && !bLiveToday) return -1;
    if (!aLiveToday && bLiveToday) return 1;

    if (a.isInLiveWindow && !b.isInLiveWindow) return -1;
    if (!a.isInLiveWindow && b.isInLiveWindow) return 1;

    if (a.isToday && !b.isToday) return -1;
    if (!a.isToday && b.isToday) return 1;

    return Math.abs(a.diffMinutes) - Math.abs(b.diffMinutes);
  });

  const best = matches[0];
  return {
    timeStr: best.timeStr,
    serviceName: best.service.name,
    serviceId: best.service.id,
  };
}

export function WaterfallTimeline({
  actions,
  services,
  selectedServiceId,
  onSelectService,
  onUpdateOffsets,
  onNudge,
  onPin,
  liveActionId,
  onEditAction,
  timezone,
}: Props) {
  const toast = useToast();
  const trackRef = useRef<HTMLDivElement>(null);

  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{
    actionId: string;
    edge: 'start' | 'end' | 'move';
    initialMouseX: number;
    initialStart: number;
    initialEnd: number;
  } | null>(null);

  // Temporary drag values for fluid 60fps rendering
  const [dragOffsets, setDragOffsets] = useState<Record<string, { start: number; end: number }>>({});

  // Current real-time clock tracking
  const [nowInZone, setNowInZone] = useState(() => getNowInZone(timezone));
  const [scrubbedMinute, setScrubbedMinute] = useState<number | null>(null);
  const [scrubbingCursor, setScrubbingCursor] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowInZone(getNowInZone(timezone));
    }, 1000);
    return () => clearInterval(timer);
  }, [timezone]);

  const svcActions = actions.filter((a) => {
    if (selectedServiceId === 'all') return true;
    if (selectedServiceId === 'church') return a.service_id === null;
    return a.service_id === selectedServiceId;
  });

  // Calculate pixel to minute conversion
  const getMinutesFromMouseEvent = useCallback(
    (e: MouseEvent | TouchEvent, initialMouseX: number) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const dx = clientX - initialMouseX;
      const minutesPerPixel = TOTAL_MINUTES / rect.width;
      return Math.round(dx * minutesPerPixel);
    },
    [],
  );

  // Mouse move and up handlers during drag of action bars
  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const deltaMins = getMinutesFromMouseEvent(e, dragging.initialMouseX);
      if (dragging.edge === 'start') {
        const newStart = Math.min(
          dragging.initialEnd - 2,
          Math.max(MIN_START, dragging.initialStart + deltaMins),
        );
        setDragOffsets((prev) => ({
          ...prev,
          [dragging.actionId]: { start: newStart, end: dragging.initialEnd },
        }));
      } else if (dragging.edge === 'end') {
        const newEnd = Math.max(
          dragging.initialStart + 2,
          Math.min(MAX_END, dragging.initialEnd + deltaMins),
        );
        setDragOffsets((prev) => ({
          ...prev,
          [dragging.actionId]: { start: dragging.initialStart, end: newEnd },
        }));
      } else if (dragging.edge === 'move') {
        const duration = dragging.initialEnd - dragging.initialStart;
        const newStart = Math.max(
          MIN_START,
          Math.min(MAX_END - duration, dragging.initialStart + deltaMins),
        );
        setDragOffsets((prev) => ({
          ...prev,
          [dragging.actionId]: { start: newStart, end: newStart + duration },
        }));
      }
    };

    const onUp = async () => {
      const current = dragOffsets[dragging.actionId];
      setDragging(null);
      if (current) {
        try {
          await onUpdateOffsets(dragging.actionId, current.start, current.end);
        } catch {
          toast('Failed to update timing', 'error');
        }
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging, dragOffsets, getMinutesFromMouseEvent, onUpdateOffsets, toast]);

  // Mouse move and up handlers during cursor scrubbing
  const startScrubCursor = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setScrubbingCursor(true);
  };

  useEffect(() => {
    if (!scrubbingCursor) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      const minute = MIN_START + (x / rect.width) * TOTAL_MINUTES;
      const clamped = Math.max(MIN_START, Math.min(MAX_END, Math.round(minute)));
      setScrubbedMinute(clamped);
    };

    const onUp = () => {
      setScrubbingCursor(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [scrubbingCursor]);

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const minute = MIN_START + (clientX / rect.width) * TOTAL_MINUTES;
    const clamped = Math.max(MIN_START, Math.min(MAX_END, Math.round(minute)));
    setScrubbedMinute(clamped);
  };

  const startDrag = (
    e: React.MouseEvent | React.TouchEvent,
    action: Action,
    edge: 'start' | 'end' | 'move',
  ) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const s = action.start_offset_minutes ?? 0;
    const endVal = action.end_offset_minutes ?? (s + 20);
    setDragging({
      actionId: action.id,
      edge,
      initialMouseX: clientX,
      initialStart: s,
      initialEnd: endVal,
    });
    setDragOffsets((prev) => ({
      ...prev,
      [action.id]: { start: s, end: endVal },
    }));
  };

  const selectedAction = actions.find((a) => a.id === selectedActionId);

  // Time markers: -15, 0, 15, 30, 45, 60, 75, 90
  const ticks = [-15, 0, 15, 30, 45, 60, 75, 90];

  const bestMatch = findBestServiceTime(services, selectedServiceId, nowInZone);
  const defaultServiceTime = bestMatch.timeStr;

  // Calculate live playhead minute relative to service start
  const baseTime = parseBaseTime(defaultServiceTime) || { hours: 9, minutes: 0 };
  const baseMinutesFromMidnight = baseTime.hours * 60 + baseTime.minutes;
  const nowMinutesFromMidnight = nowInZone.hours * 60 + nowInZone.minutes + nowInZone.seconds / 60;

  let liveDiffMinutes = nowMinutesFromMidnight - baseMinutesFromMidnight;
  if (liveDiffMinutes < -720) liveDiffMinutes += 1440;
  if (liveDiffMinutes > 720) liveDiffMinutes -= 1440;

  const isLiveInRange = liveDiffMinutes >= MIN_START && liveDiffMinutes <= MAX_END;

  // Active cursor minute: scrubbed takes precedence; otherwise live if in range; else default to 15
  let cursorMinute: number;
  let isSimulated: boolean;

  if (scrubbedMinute !== null) {
    cursorMinute = scrubbedMinute;
    isSimulated = true;
  } else if (isLiveInRange) {
    cursorMinute = liveDiffMinutes;
    isSimulated = false;
  } else {
    cursorMinute = 15;
    isSimulated = true;
  }

  const cursorLeftPercent = ((cursorMinute - MIN_START) / TOTAL_MINUTES) * 100;
  const cursorLabel = formatMinuteWithTime(Math.round(cursorMinute), defaultServiceTime);

  return (
    <div className="card overflow-hidden mb-6 border border-slate-200">
      {/* Top Header / Quick AV Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-sm">
            <Clock className="h-4 w-4 text-brand" />
            <span>Waterfall Timeline</span>
          </div>

          <Select
            value={selectedServiceId}
            onChange={(e) => onSelectService(e.target.value)}
            className="w-auto py-1 text-xs"
          >
            <option value="all">All Scopes</option>
            <option value="church">Church-wide</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>

          {/* Live Clock / Cursor Status Indicator */}
          <div className="flex items-center gap-1.5">
            {scrubbedMinute !== null ? (
              <Button
                variant="secondary"
                size="sm"
                className="px-2 py-0.5 text-xs h-7 text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={() => setScrubbedMinute(null)}
                title="Reset cursor to current live clock time"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                <span>Snap to Clock</span>
              </Button>
            ) : isLiveInRange ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live: {bestMatch.serviceName ? `${bestMatch.serviceName} ` : ''}({nowInZone.timeStr})
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 font-medium">
                Clock: {nowInZone.timeStr} ({defaultServiceTime})
              </span>
            )}
          </div>
        </div>

        {/* Real-time AV Live Nudge Tools for selected action */}
        {selectedAction ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 truncate max-w-[200px]">
              {selectedAction.title} ({formatMinuteWithTime(selectedAction.start_offset_minutes ?? 0, selectedAction.service_id ? findBestServiceTime(services, selectedAction.service_id, nowInZone).timeStr : defaultServiceTime)}):
            </span>
            <Button
              variant="secondary"
              size="sm"
              className="px-2 py-1 text-xs h-7"
              onClick={() => onNudge(selectedAction.id, -5)}
              title="Nudge -5 minutes"
            >
              <Rewind className="h-3 w-3" /> -5m
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="px-2 py-1 text-xs h-7"
              onClick={() => onNudge(selectedAction.id, 5)}
              title="Nudge +5 minutes (e.g. if worship runs long)"
            >
              <FastForward className="h-3 w-3" /> +5m
            </Button>
            <Button
              variant={liveActionId === selectedAction.id ? 'primary' : 'secondary'}
              size="sm"
              className="px-2.5 py-1 text-xs h-7"
              onClick={() => onPin(selectedAction)}
            >
              <Pin className="h-3 w-3" /> {liveActionId === selectedAction.id ? 'Pinned' : 'Push Live'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 py-1 text-xs h-7 text-slate-600 hover:text-slate-900"
              onClick={() => onEditAction(selectedAction)}
            >
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Click any action below to adjust live or nudge timing</p>
        )}
      </div>

      {/* Timeline view */}
      <div className="p-4 overflow-x-auto">
        <div className="min-w-[680px] relative pt-2">
          {/* Current Service Time Cursor (Playhead) */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-30 transition-all duration-150 ease-linear"
            style={{ left: `${Math.max(0, Math.min(100, cursorLeftPercent))}%` }}
          >
            {/* Playhead Head / Badge at top */}
            <div className="absolute -top-3.5 left-0 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-ew-resize select-none">
              <div
                onMouseDown={startScrubCursor}
                onTouchStart={startScrubCursor}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold shadow-lg ring-2 ring-white transition transform active:scale-95 ${
                  !isSimulated
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                }`}
                title={
                  !isSimulated
                    ? `Current Live Time: ${cursorLabel}. Drag to scrub.`
                    : `Cursor: ${cursorLabel}. Drag to scrub or click 'Snap to Clock'.`
                }
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    !isSimulated ? 'bg-white animate-ping' : 'bg-slate-950'
                  }`}
                />
                <span>{!isSimulated ? 'LIVE' : 'TIME'} {cursorLabel}</span>
              </div>
              <div
                className={`w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] ${
                  !isSimulated ? 'border-t-rose-600' : 'border-t-amber-500'
                }`}
              />
            </div>

            {/* Vertical cursor line spanning all rows */}
            <div
              className={`w-0.5 h-full -translate-x-1/2 ${
                !isSimulated
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                  : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
              }`}
            />
          </div>

          {/* Ticks header */}
          <div
            ref={trackRef}
            onClick={handleTrackClick}
            className="relative h-8 w-full border-b border-slate-200 cursor-pointer"
            title="Click anywhere along the time ruler to place cursor"
          >
            {ticks.map((t) => {
              const leftPercent = ((t - MIN_START) / TOTAL_MINUTES) * 100;
              const isStart = t === 0;
              const label = formatMinuteWithTime(t, defaultServiceTime);
              return (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 flex flex-col items-center -translate-x-1/2 pointer-events-none"
                  style={{ left: `${leftPercent}%` }}
                >
                  <span
                    className={`text-[10px] whitespace-nowrap font-bold tracking-tight ${
                      isStart ? 'text-brand font-black' : 'text-slate-500'
                    }`}
                  >
                    {label}
                  </span>
                  <div
                    className={`w-px flex-1 ${
                      isStart ? 'bg-brand w-0.5' : 'bg-slate-200'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Waterfall Action Bars */}
          <div className="relative mt-3 space-y-2.5 py-2">
            {/* Zero vertical guide line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-brand/30 pointer-events-none z-0"
              style={{
                left: `${((0 - MIN_START) / TOTAL_MINUTES) * 100}%`,
              }}
            />

            {svcActions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No scheduled actions found for this service.
              </div>
            ) : (
              svcActions.map((action) => {
                const isSelected = selectedActionId === action.id;
                const isPinned = liveActionId === action.id;
                const isDragging = dragging?.actionId === action.id;

                const liveOffsets = dragOffsets[action.id];
                const startMins = liveOffsets ? liveOffsets.start : (action.start_offset_minutes ?? 0);
                const endMins = liveOffsets ? liveOffsets.end : (action.end_offset_minutes ?? (startMins + 20));

                const leftPercent = Math.max(
                  0,
                  Math.min(100, ((startMins - MIN_START) / TOTAL_MINUTES) * 100),
                );
                const rightPercent = Math.max(
                  0,
                  Math.min(100, ((endMins - MIN_START) / TOTAL_MINUTES) * 100),
                );
                const widthPercent = Math.max(4, rightPercent - leftPercent);

                const actionBaseTime = action.service_id
                  ? findBestServiceTime(services, action.service_id, nowInZone).timeStr
                  : defaultServiceTime;
                const startDisplay = formatMinuteWithTime(startMins, actionBaseTime);
                const endDisplay = formatMinuteWithTime(endMins, actionBaseTime);

                const isUnderCursor =
                  Math.round(startMins) <= Math.round(cursorMinute) &&
                  Math.round(cursorMinute) < Math.round(endMins);

                return (
                  <div
                    key={action.id}
                    onClick={() => setSelectedActionId(action.id)}
                    className="relative h-10 w-full group select-none cursor-pointer"
                  >
                    <div
                      style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                      className={`absolute top-0 bottom-0 rounded-xl transition-shadow flex items-center justify-between px-2 text-xs font-semibold shadow-xs ${
                        isPinned
                          ? 'bg-rose-500 text-white ring-2 ring-rose-400 shadow-rose-200 z-10'
                          : isSelected
                          ? 'bg-brand text-white ring-2 ring-brand/40 shadow-brand/20 z-10'
                          : isDragging
                          ? 'bg-brand/90 text-white ring-2 ring-brand/50 shadow-md z-20'
                          : isUnderCursor
                          ? 'bg-white text-slate-900 border-2 border-rose-400 shadow-sm ring-2 ring-rose-300/40'
                          : 'bg-white text-slate-800 border border-slate-200 hover:border-brand/40 hover:bg-slate-50'
                      }`}
                    >
                      {/* Floating indicator while dragging edge or moving */}
                      {isDragging && (
                        <div
                          className={`absolute -top-7.5 z-30 pointer-events-none whitespace-nowrap rounded-md bg-slate-900 text-white px-2 py-0.5 text-[10px] font-bold shadow-lg ring-1 ring-white/10 ${
                            dragging.edge === 'start'
                              ? 'left-0'
                              : dragging.edge === 'end'
                              ? 'right-0'
                              : 'left-1/2 -translate-x-1/2'
                          }`}
                        >
                          {dragging.edge === 'start'
                            ? `Start: ${startDisplay}`
                            : dragging.edge === 'end'
                            ? `End: ${endDisplay}`
                            : `${startDisplay} → ${endDisplay}`}
                        </div>
                      )}

                      {/* Left Drag Handle */}
                      <div
                        onMouseDown={(e) => startDrag(e, action, 'start')}
                        onTouchStart={(e) => startDrag(e, action, 'start')}
                        title={`Drag to change start time (currently ${startDisplay})`}
                        className={`h-full w-4 flex items-center justify-center cursor-ew-resize hover:bg-black/10 rounded-l-lg -ml-2 ${
                          isDragging && dragging.edge === 'start' ? 'bg-black/20 text-white' : ''
                        }`}
                      >
                        <div className="w-1 h-3 rounded-full bg-current opacity-50" />
                      </div>

                      {/* Bar Content */}
                      <div
                        onMouseDown={(e) => startDrag(e, action, 'move')}
                        onTouchStart={(e) => startDrag(e, action, 'move')}
                        className="flex-1 min-w-0 mx-1.5 flex items-center justify-between gap-1.5 cursor-grab active:cursor-grabbing overflow-hidden"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          {isUnderCursor && (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" title="Active at current cursor time" />
                          )}
                          <span className="truncate font-semibold">{action.title}</span>
                        </div>
                        <span className="shrink-0 text-[10px] whitespace-nowrap opacity-90 flex items-center gap-1 font-mono">
                          {isDragging && dragging.edge === 'start' ? (
                            <>
                              <span className="font-bold underline text-[11px] bg-black/20 px-1 py-0.5 rounded">
                                {startDisplay}
                              </span>
                              <span className="opacity-60">→</span>
                              <span className="opacity-75">{endDisplay}</span>
                            </>
                          ) : isDragging && dragging.edge === 'end' ? (
                            <>
                              <span className="opacity-75">{startDisplay}</span>
                              <span className="opacity-60">→</span>
                              <span className="font-bold underline text-[11px] bg-black/20 px-1 py-0.5 rounded">
                                {endDisplay}
                              </span>
                            </>
                          ) : (
                            <span>
                              {startDisplay} → {endDisplay}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Right Drag Handle */}
                      <div
                        onMouseDown={(e) => startDrag(e, action, 'end')}
                        onTouchStart={(e) => startDrag(e, action, 'end')}
                        title={`Drag to change end time (currently ${endDisplay})`}
                        className={`h-full w-4 flex items-center justify-center cursor-ew-resize hover:bg-black/10 rounded-r-lg -mr-2 ${
                          isDragging && dragging.edge === 'end' ? 'bg-black/20 text-white' : ''
                        }`}
                      >
                        <div className="w-1 h-3 rounded-full bg-current opacity-50" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 px-5 py-2.5 border-t border-slate-200 text-xs text-slate-500">
        <span className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand" />
            <span>Drag edges to adjust timing</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Red Line = Current Time in Service</span>
          </span>
        </span>
        <span className="hidden sm:inline">
          {formatMinuteWithTime(0, defaultServiceTime)} = Official Service Start Time
        </span>
      </div>
    </div>
  );
}
