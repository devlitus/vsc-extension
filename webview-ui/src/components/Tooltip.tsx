import React, { useState, useRef, type ReactNode } from 'react';

const TOOLTIP_SHOW_DELAY_MS = 400;
const TOOLTIP_BACKGROUND = '#333';
const TOOLTIP_COLOR = '#fff';
const TOOLTIP_FONT_SIZE = '12px';
const TOOLTIP_PADDING = '4px 8px';
const TOOLTIP_BORDER_RADIUS = 4;
const TOOLTIP_OPACITY_TRANSITION_MS = 150;

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  children: ReactNode;
  text: string;
  position?: TooltipPosition;
}

export function Tooltip({
  children,
  text,
  position = 'top',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, TOOLTIP_SHOW_DELAY_MS);
  };

  const hideTooltip = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  const getTooltipStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      background: TOOLTIP_BACKGROUND,
      color: TOOLTIP_COLOR,
      fontSize: TOOLTIP_FONT_SIZE,
      padding: TOOLTIP_PADDING,
      borderRadius: TOOLTIP_BORDER_RADIUS,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      opacity: isVisible ? 1 : 0,
      transition: `opacity ${TOOLTIP_OPACITY_TRANSITION_MS}ms ease-in-out`,
      zIndex: 1000,
    };

    switch (position) {
      case 'bottom':
        return { ...baseStyle, top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4 };
      case 'left':
        return { ...baseStyle, right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 4 };
      case 'right':
        return { ...baseStyle, left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 4 };
      case 'top':
      default:
        return { ...baseStyle, bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 4 };
    }
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      <div style={getTooltipStyle()}>
        {text}
      </div>
    </div>
  );
}
