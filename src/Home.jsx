// PLACEHOLDER: the next page goes here.
// `user` has: username, email, score, data
// Call onLogout() to log the user out.
export default function Home({ user, onLogout }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="title">Hi, {user.username}</h1>
        <p className="subtitle">You're logged in. The next page goes here.</p>
        <button className="primary" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}