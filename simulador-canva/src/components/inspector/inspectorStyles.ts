import type { CSSProperties } from 'react';

export const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 11,
    color: '#546e7a',
    marginBottom: 3,
};

export const inputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    fontSize: 12,
    padding: '3px 6px',
    border: '1px solid #b0bec5',
    borderRadius: 4,
    background: '#fff',
};

export const panelStyle: CSSProperties = {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 252,
    maxHeight: 'calc(100% - 20px)',
    overflowY: 'auto',
    background: 'rgba(255,255,255,0.97)',
    border: '1px solid #b0bec5',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    padding: '10px 12px',
    boxSizing: 'border-box',
    fontSize: 12,
    color: '#263238',
    fontFamily: 'inherit',
    zIndex: 10,
};
