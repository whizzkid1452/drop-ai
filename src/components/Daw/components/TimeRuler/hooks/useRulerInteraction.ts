import { useState, useRef, useEffect, type RefObject } from 'react';
import { useAudioCommand } from '@/logics/audio';
import { AudioCommandType } from '@/types/audioCommand.schema';
import { useErrorBoundary } from 'react-error-boundary';

interface UseRulerInteractionProps {
  pixelsPerSecond: number;
  containerRef: RefObject<HTMLDivElement>;
}

export const useRulerInteraction = ({ pixelsPerSecond, containerRef }: UseRulerInteractionProps) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<number | null>(null);
  const currentDragRangeRef = useRef<{ start: number; end: number } | null>(null);
  const [isDraggingRange, setIsDraggingRange] = useState(false);

  const { execute } = useAudioCommand();
  const { showBoundary } = useErrorBoundary();

  useEffect(() => {
    if (!isDraggingRange) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || dragStartPosRef.current === null || !overlayRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = Math.max(0, x / pixelsPerSecond);

      const start = Math.min(dragStartPosRef.current, time);
      const end = Math.max(dragStartPosRef.current, time);

      currentDragRangeRef.current = { start, end };

      overlayRef.current.style.left = `${start * pixelsPerSecond}px`;
      overlayRef.current.style.width = `${(end - start) * pixelsPerSecond}px`;
    };

    const handleWindowMouseUp = async () => {
      setIsDraggingRange(false);
      dragStartPosRef.current = null;

      if (currentDragRangeRef.current) {
        try {
          await execute({
            type: AudioCommandType.SET_EXPORT_RANGE,
            startTime: currentDragRangeRef.current.start,
            endTime: currentDragRangeRef.current.end,
          });
        } catch (error) {
          showBoundary(error);
        }
        currentDragRangeRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingRange, pixelsPerSecond, execute, showBoundary, containerRef]);

  const handleTopMouseDown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / pixelsPerSecond);

    dragStartPosRef.current = time;
    currentDragRangeRef.current = { start: time, end: time };

    try {
      await execute({
        type: AudioCommandType.SET_EXPORT_RANGE,
        startTime: time,
        endTime: time,
      });
    } catch (error) {
      showBoundary(error);
    }

    setIsDraggingRange(true);
  };

  const handleBottomMouseDown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = Math.max(0, x / pixelsPerSecond);

    try {
      await execute({
        type: AudioCommandType.SET_CURRENT_TIME,
        time,
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  const handleDoubleClick = async () => {
    try {
      await execute({
        type: AudioCommandType.CLEAR_EXPORT_RANGE,
      });
    } catch (error) {
      showBoundary(error);
    }
  };

  return {
    isDraggingRange,
    overlayRef,
    handleTopMouseDown,
    handleBottomMouseDown,
    handleDoubleClick,
  };
};
