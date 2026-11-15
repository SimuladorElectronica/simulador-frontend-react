import type { CSSProperties } from 'react';

export const sectionStyle: CSSProperties = {
    borderBottom: '1px solid #37474f',
    paddingBottom: 12,
    marginBottom: 12,
};

export const headingStyle: CSSProperties = {
    margin: '0 0 8px',
    fontSize: 13,
};

export const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: 10,
    color: '#90a4ae',
    marginBottom: 4,
};

export const inputStyle: CSSProperties = {
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

export const submitButtonStyle = (isLoading: boolean): CSSProperties => ({
    width: '100%',
    padding: '8px 10px',
    borderRadius: 6,
    border: 'none',
    background: isLoading ? '#5c6bc0' : '#1565c0',
    color: '#fff',
    fontWeight: 700,
    fontSize: 12,
    cursor: isLoading ? 'wait' : 'pointer',
});

export const errorStyle: CSSProperties = {
    marginTop: 8,
    fontSize: 11,
    color: '#ff8a80',
    wordBreak: 'break-word',
};

export const registerHintStyle: CSSProperties = {
    marginTop: 8,
    fontSize: 10,
    color: '#90a4ae',
};

export const registerLinkStyle: CSSProperties = {
    color: '#80cbc4',
};

export const userRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
};

export const avatarStyle: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#1565c0',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
};

export const userNameStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: '#eceff1',
};

export const userEmailStyle: CSSProperties = {
    fontSize: 10,
    color: '#90a4ae',
    wordBreak: 'break-all',
};

export const roleBadgeStyle: CSSProperties = {
    display: 'inline-block',
    marginTop: 2,
    padding: '1px 6px',
    borderRadius: 10,
    background: '#37474f',
    color: '#80cbc4',
    fontSize: 9,
};

export const actionsRowStyle: CSSProperties = {
    display: 'flex',
    gap: 6,
};

export const dashboardButtonStyle: CSSProperties = {
    flex: 1,
    padding: '7px 8px',
    borderRadius: 6,
    border: 'none',
    background: '#5c6bc0',
    color: '#fff',
    fontWeight: 700,
    fontSize: 11,
    cursor: 'pointer',
};

export const logoutButtonStyle: CSSProperties = {
    padding: '7px 10px',
    fontSize: 11,
};

export const guestNoticeStyle: CSSProperties = {
    marginTop: 10,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #455a64',
    background: '#1c262b',
    fontSize: 10,
    color: '#b0bec5',
    lineHeight: 1.5,
};

export const guestActionsStyle: CSSProperties = {
    display: 'flex',
    gap: 6,
};

export const useAccountButtonStyle: CSSProperties = {
    flex: 1,
    padding: '6px 8px',
    borderRadius: 6,
    border: 'none',
    background: '#1565c0',
    color: '#fff',
    fontWeight: 700,
    fontSize: 10,
    cursor: 'pointer',
};

export const guestLogoutButtonStyle: CSSProperties = {
    padding: '6px 10px',
    fontSize: 10,
};

export const initialsOf = (name: string): string =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');
