export default function UserAvatar({ user, fallback = 'M', className = '' }) {
  return <span className={`user-avatar ${className}`.trim()} aria-hidden="true">
    {user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer"/> : fallback}
  </span>;
}
