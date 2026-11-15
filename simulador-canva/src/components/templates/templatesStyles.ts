import type { CSSProperties } from 'react';

export const pageStyle: CSSProperties = {
    minHeight: '100vh',
    background: '#1c262b',
    color: '#eceff1',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    padding: '32px 16px',
    boxSizing: 'border-box',
};

export const columnStyle: CSSProperties = {
    maxWidth: 760,
    margin: '0 auto',
};

export const headerRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
};

export const headerActionsStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
};

export const titleStyle: CSSProperties = {
    fontSize: 22,
    margin: '0 0 4px',
};

export const closeSessionButtonStyle: CSSProperties = {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #455a64',
    background: 'transparent',
    color: '#b0bec5',
    fontSize: 12,
    cursor: 'pointer',
};

export const openLinkStyle: CSSProperties = {
    color: '#80cbc4',
    fontSize: 13,
    textDecoration: 'none',
};

export const introStyle: CSSProperties = {
    color: '#90a4ae',
    fontSize: 13,
    margin: '0 0 20px',
    lineHeight: 1.5,
};

export const mutedStyle: CSSProperties = {
    color: '#90a4ae',
};

export const errorBoxStyle: CSSProperties = {
    background: '#37474f',
    border: '1px solid #ff8a80',
    borderRadius: 10,
    padding: '16px 18px',
};

export const errorTitleStyle: CSSProperties = {
    color: '#ff8a80',
    fontWeight: 700,
    marginBottom: 6,
};

export const errorMessageStyle: CSSProperties = {
    fontSize: 13,
    marginBottom: 12,
};

export const retryButtonStyle: CSSProperties = {
    padding: '8px 14px',
    borderRadius: 6,
    border: 'none',
    background: '#1565c0',
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
};

export const cardStyle: CSSProperties = {
    display: 'block',
    background: '#263238',
    border: '1px solid #37474f',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 12,
    textDecoration: 'none',
    color: 'inherit',
};

export const cardHeaderStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
};

export const cardTitleStyle: CSSProperties = {
    fontSize: 15,
    color: '#eceff1',
};

export const cardUpdatedStyle: CSSProperties = {
    fontSize: 11,
    color: '#90a4ae',
    whiteSpace: 'nowrap',
};

export const cardDescriptionStyle: CSSProperties = {
    margin: '6px 0 0',
    fontSize: 13,
    color: '#b0bec5',
    lineHeight: 1.5,
};

export const cardActionStyle: CSSProperties = {
    display: 'inline-block',
    marginTop: 10,
    fontSize: 12,
    color: '#80cbc4',
    fontWeight: 700,
};
