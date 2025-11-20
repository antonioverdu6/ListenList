import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import '../styles/styles_detalle.css';

export default function UserListPopover({ title, users, onClose, onToggleFollow, dataTestId }) {
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const navigate = useNavigate();

  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef(null);
  const closingRef = useRef(false);
  const navTimer = useRef(null);

  // Stable triggerClose so hooks can depend on it
  const triggerClose = useCallback((delay = 180) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimer.current = setTimeout(() => {
      setVisible(false);
      closingRef.current = false;
      onClose();
    }, delay);
  }, [onClose]);

  useEffect(() => {
    // small delay to allow CSS transition from initial state -> visible
    const t = setTimeout(() => setVisible(true), 12);
    if (closeBtnRef.current) closeBtnRef.current.focus();

    function onKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        triggerClose();
      }
      // Basic focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (navTimer.current) clearTimeout(navTimer.current);
    };
  }, [triggerClose]);

  // (removed duplicate triggerClose - using stable useCallback version above)

  const handleOutside = useCallback((e) => {
    // overlay click should animate close
    triggerClose();
  }, [triggerClose]);

  return (
    <div className={`userlist-overlay ${visible && !closing ? 'enter' : ''} ${closing ? 'exit' : ''}`} onMouseDown={handleOutside}>
      <div
        ref={dialogRef}
        className={`userlist-dialog ${visible && !closing ? 'enter' : ''} ${closing ? 'exit' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="userlist-title"
        data-testid={dataTestId}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="userlist-header">
          <h3 id="userlist-title">{title}</h3>
          <div className="userlist-header-actions">
            <button
              ref={closeBtnRef}
              className="close-x"
              onClick={() => triggerClose()}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="userlist-body">
          {(!users || users.length === 0) ? (
            <p className="muted">No hay usuarios para mostrar.</p>
          ) : (
            <ul className="userlist-items">
              {users.map(u => (
                  <li
                    key={u.id}
                    className="userlist-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => { triggerClose(); if (navTimer.current) clearTimeout(navTimer.current); navTimer.current = setTimeout(() => navigate(`/perfil/${u.username}`), 190); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerClose(); if (navTimer.current) clearTimeout(navTimer.current); navTimer.current = setTimeout(() => navigate(`/perfil/${u.username}`), 190); } }}
                  >
                    <div className="userlist-left">
                      { (u.avatarUrl || u.fotoPerfil) ? (
                        <img src={u.avatarUrl || u.fotoPerfil} alt={u.username} className="userlist-avatar" />
                      ) : (
                        <div className="userlist-avatar userlist-avatar-placeholder">{(u.username||'U')[0].toUpperCase()}</div>
                      )}
                    </div>
                    <div className="userlist-main">
                      <div className="userlist-username">{u.username}</div>
                    </div>
                    <div className="userlist-action">
                      <button
                        className={`btn-seguir ${u.isFollowing ? 'siguiendo' : ''}`}
                        onClick={(ev) => { ev.stopPropagation(); onToggleFollow && onToggleFollow(u.username); }}
                        aria-pressed={u.isFollowing ? 'true' : 'false'}
                      >
                        {u.isFollowing ? 'Siguiendo' : 'Seguir'}
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

UserListPopover.propTypes = {
  title: PropTypes.string.isRequired,
  users: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    username: PropTypes.string.isRequired,
    avatarUrl: PropTypes.string,
    isFollowing: PropTypes.bool,
  })),
  onClose: PropTypes.func.isRequired,
  onToggleFollow: PropTypes.func,
  dataTestId: PropTypes.string,
};

UserListPopover.defaultProps = { users: [], onToggleFollow: null, dataTestId: undefined };

/*
  Notes:
  - Replace mock users by passing real `users` prop from parent (MiPerfil).
  - The component exposes `onToggleFollow(userId)` callback; actual follow/unfollow logic
    should be implemented by the parent (server call + optimistic UI updates).
*/
