import React, { useEffect, useRef } from 'react';

const DISMISS_TIMEOUT_MS = 5000;
const BANNER_BACKGROUND = '#ffcc00';
const BANNER_COLOR = '#000';
const BANNER_FONT_SIZE = '14px';
const BANNER_PADDING = '8px 16px';

interface MigrationNoticeProps {
  visible: boolean;
  onDismiss: () => void;
}

export function MigrationNotice({ visible, onDismiss }: MigrationNoticeProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    timeoutRef.current = setTimeout(() => {
      onDismiss();
    }, DISMISS_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [visible, onDismiss]);

  if (!visible) {
    return null;
  }

  const bannerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    background: BANNER_BACKGROUND,
    color: BANNER_COLOR,
    fontSize: BANNER_FONT_SIZE,
    padding: BANNER_PADDING,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  };

  const textStyle: React.CSSProperties = {
    flex: 1,
    textAlign: 'center',
  };

  const buttonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: BANNER_FONT_SIZE,
    padding: '0 8px',
    color: BANNER_COLOR,
  };

  return (
    <div style={bannerStyle}>
      <span style={textStyle}>Layout was reset due to a format update</span>
      <button
        style={buttonStyle}
        onClick={onDismiss}
        aria-label="Dismiss notice"
      >
        ✕
      </button>
    </div>
  );
}
