import type { CSSProperties } from 'react';

export const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'rgba(38, 50, 56, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
} as const;

export const dialogStyle = {
    background: '#ffffff',
    borderRadius: 8,
    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.35)',
    width: 'min(780px, 96vw)',
    maxHeight: '82vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    fontSize: 12,
    color: '#263238',
} as const;

export const closeButtonStyle: CSSProperties = {
    border: 'none',
    background: 'transparent',
    fontSize: 16,
    cursor: 'pointer',
    color: '#546e7a',
    padding: '2px 6px',
};

export function chipStyle(active: boolean) {
    return {
        padding: '3px 10px',
        fontSize: 11,
        borderRadius: 12,
        border: active ? '1px solid #1565c0' : '1px solid #cfd8dc',
        background: active ? '#1565c0' : '#ffffff',
        color: active ? '#ffffff' : '#546e7a',
        cursor: 'pointer',
    } as const;
}
