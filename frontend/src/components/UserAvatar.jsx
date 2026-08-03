export function getInitials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase();
}

export default function UserAvatar({ user, size = 36, className = '' }) {
  const initials = getInitials(user?.name);
  const twoLetters = initials.length > 1;
  const style = {
    width: size,
    height: size,
    fontSize: Math.round(size * (twoLetters ? 0.34 : 0.4))
  };

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt=""
        className={`user-avatar user-avatar--img ${className}`.trim()}
        style={style}
      />
    );
  }

  return (
    <span
      className={`user-avatar user-avatar--fallback ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}
