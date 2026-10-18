import { Clock, FastForward, Pencil, Pin, Rewind } from 'lucide-react';
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
}

const MIN_START = -20; // 20m before service starts
const MAX_END = 100; // 100m after start
const TOTAL_MINUTES = MAX_END - MIN_START; // 120 minutes total

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

  // Mouse move and up handlers during drag
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

  return (
    <div className="card overflow-hidden mb-6 border border-slate-200">
      {/* Top Header / Quick AV Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-3">
        <div className="flex items-center gap-3">
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
        </div>

        {/* Real-time AV Live Nudge Tools for selected action */}
        {selectedAction ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-600 truncate max-w-[140px]">
              {selectedAction.title}:
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
        <div className="min-w-[650px]">
          {/* Ticks header */}
          <div ref={trackRef} className="relative h-7 w-full border-b border-slate-200">
            {ticks.map((t) => {
              const leftPercent = ((t - MIN_START) / TOTAL_MINUTES) * 100;
              const isStart = t === 0;
              return (
                <div
                  key={t}
                  className="absolute top-0 bottom-0 flex flex-col items-center -translate-x-1/2"
                  style={{ left: `${leftPercent}%` }}
                >
                  <span
                    className={`text-[10px] font-bold ${
                      isStart ? 'text-brand font-black' : 'text-slate-400'
                    }`}
                  >
                    {isStart ? '0:00 (Start)' : t < 0 ? `${t}m` : `+${t}m`}
                  </span>
                  <div
                    className={`w-px flex-1 ${
                      isStart ? 'bg-brand' : 'bg-slate-200'
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
                          ? 'bg-rose-500 text-white ring-2 ring-rose-400 shadow-rose-200'
                          : isSelected
                          ? 'bg-brand text-white ring-2 ring-brand/40 shadow-brand/20'
                          : 'bg-white text-slate-800 border border-slate-200 hover:border-brand/40 hover:bg-slate-50'
                      }`}
                    >
                      {/* Left Drag Handle */}
                      <div
                        onMouseDown={(e) => startDrag(e, action, 'start')}
                        onTouchStart={(e) => startDrag(e, action, 'start')}
                        title="Drag to change start minute"
                        className="h-full w-4 flex items-center justify-center cursor-ew-resize hover:bg-black/10 rounded-l-lg -ml-2"
                      >
                        <div className="w-1 h-3 rounded-full bg-current opacity-40" />
                      </div>

                      {/* Bar Content */}
                      <div
                        onMouseDown={(e) => startDrag(e, action, 'move')}
                        onTouchStart={(e) => startDrag(e, action, 'move')}
                        className="flex-1 truncate mx-1.5 flex items-center gap-1.5 cursor-grab active:cursor-grabbing"
                      >
                        <span className="truncate">{action.title}</span>
                        <span className="opacity-75 text-[10px] hidden sm:inline">
                          ({startMins}m → {endMins}m)
                        </span>
                      </div>

                      {/* Right Drag Handle */}
                      <div
                        onMouseDown={(e) => startDrag(e, action, 'end')}
                        onTouchStart={(e) => startDrag(e, action, 'end')}
                        title="Drag to change end minute"
                        className="h-full w-4 flex items-center justify-center cursor-ew-resize hover:bg-black/10 rounded-r-lg -mr-2"
                      >
                        <div className="w-1 h-3 rounded-full bg-current opacity-40" />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between bg-slate-50 px-5 py-2.5 border-t border-slate-200 text-xs text-slate-500">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand" />
          <span>Drag left or right edges to adjust start & end service timing</span>
        </span>
        <span className="hidden sm:inline">0:00 = Official Service Start Time</span>
      </div>
    </div>
  );
}
