import type { CSSProperties } from 'react';

export const sectionStyle: CSSProperties = {
    borderBottom: '1px solid #37474f',
    paddingBottom: 12,
    marginBottom: 12,
};

export const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 10,
    color: '#90a4ae',
    marginBottom: 4,
};

export const titleInputStyle: CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '6px 8px',
    borderRadius: 4,
    border: '1px solid #455a64',
    background: '#1c262b',
    color: '#eceff1',
    fontSize: 12,
    marginBottom: 8,
};

export const infoStyle: CSSProperties = {
    fontSize: 10,
    color: '#90a4ae',
    marginBottom: 8,
    lineHeight: 1.5,
};

export function primaryButtonStyle(isExporting: boolean): CSSProperties {
    return {
        width: '100%',
        padding: '8px 10px',
        borderRadius: 6,
        border: 'none',
        background: isExporting ? '#5c6bc0' : '#1565c0',
        color: '#ffffff',
        fontWeight: 700,
        fontSize: 12,
        cursor: isExporting ? 'wait' : 'pointer',
    };
}

export const secondaryButtonStyle: CSSProperties = {
    width: '100%',
    marginTop: 6,
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #455a64',
    background: 'transparent',
    color: '#b0bec5',
    fontSize: 11,
    cursor: 'pointer',
};

export const forceButtonStyle: CSSProperties = {
    display: 'block',
    marginTop: 6,
    padding: '6px 10px',
    borderRadius: 6,
    border: 'none',
    background: '#37474f',
    color: '#eceff1',
    fontSize: 11,
    cursor: 'pointer',
};

export const errorStyle: CSSProperties = {
    marginTop: 8,
    fontSize: 11,
    color: '#ff8a80',
    wordBreak: 'break-word',
};

export const shareUrlInputStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: '6px 8px',
    borderRadius: 4,
    border: '1px solid #455a64',
    background: '#1c262b',
    color: '#80cbc4',
    fontSize: 11,
};
