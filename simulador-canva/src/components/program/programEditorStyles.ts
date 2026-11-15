import type { CSSProperties } from 'react';

export const sectionStyle: CSSProperties = {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    flex: 1,
    minHeight: 0,
    boxSizing: 'border-box',
};

export const subtitleStyle: CSSProperties = {
    fontSize: 11,
    color: '#546e7a',
    marginTop: -4,
};

export const buttonStyle: CSSProperties = {
    padding: '6px 10px',
    cursor: 'pointer',
    fontWeight: 600,
};

export const statusStyle: CSSProperties = {
    fontSize: 11,
    color: '#546e7a',
    flexShrink: 0,
};

export const collapsedStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
};

export const collapsedHintStyle: CSSProperties = {
    margin: 0,
    fontSize: 11,
    color: '#78909c',
    lineHeight: 1.4,
};

export const fallbackStyle: CSSProperties = {
    padding: 12,
    background: '#263238',
    color: '#eceff1',
    borderRadius: 6,
};

export const editorFrameStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    border: '1px solid #263238',
    borderRadius: 6,
    overflow: 'hidden',
};

export const closeButtonStyle: CSSProperties = {
    padding: '4px 8px',
    cursor: 'pointer',
    alignSelf: 'flex-start',
};

export const librariesButtonStyle: CSSProperties = {
    padding: '6px 10px',
    cursor: 'pointer',
    width: '100%',
    flexShrink: 0,
};

export const loadButtonStyle: CSSProperties = {
    padding: '6px 10px',
    cursor: 'pointer',
    fontWeight: 600,
    flexShrink: 0,
};
