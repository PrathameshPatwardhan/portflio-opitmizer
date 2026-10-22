import { useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";

/** Login / signup screen in the fintech theme. onBack returns to the app. */
export default function AuthScreen({ onBack }) {
    const { user, login, signup } = useAuth();
    const [mode, setMode] = useState("login"); // "login" | "signup"
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const friendlyAuthError = (e) => {
        if (e.status === 401) return 'Invalid email or password. Double-check and try again, or create an account below.';
        if (e.status === 409) return 'An account with this email already exists — try logging in instead.';
        return 'Something went wrong. Please try again.';
    };

    // As soon as auth succeeds, head back to the app.
    useEffect(() => {
        if (user && onBack) onBack();
    }, [user, onBack]);

    async function submit(e) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            if (mode === "login") await login(email.trim(), password);
            else await signup(email.trim(), password);
        } catch (err) {
            setError(friendlyAuthError(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
                <p className="hint" style={{ marginTop: 0 }}>
                    {mode === "login"
                        ? "Log in to save and reload your portfolios."
                        : "One account — save portfolios, reload them anytime."}
                </p>

                {error && <div className="error">{error}</div>}

                <form onSubmit={submit}>
                    <label className="field">
                        <span>Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                    </label>
                    <label className="field">
                        <span>Password{mode === "signup" ? " (min 8 characters)" : ""}</span>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete={mode === "login" ? "current-password" : "new-password"}
                            required
                            minLength={mode === "signup" ? 8 : 1}
                        />
                    </label>
                    <button type="submit" className="primary" disabled={busy}>
                        {busy ? "Working…" : mode === "login" ? "Log in" : "Sign up"}
                    </button>
                </form>

                <p className="hint" style={{ marginTop: 14 }}>
                    {mode === "login" ? (
                        <>New here?{" "}
                            <button type="button" className="auth-toggle" onClick={() => { setMode("signup"); setError(""); }}>
                                Create an account
                            </button>
                        </>
                    ) : (
                        <>Already have one?{" "}
                            <button type="button" className="auth-toggle" onClick={() => { setMode("login"); setError(""); }}>
                                Log in
                            </button>
                        </>
                    )}
                </p>

                <button type="button" className="secondary" onClick={onBack} style={{ width: "100%" }}>
                    Back to the optimizer
                </button>
            </div>
        </div>
    );
}

/** Turn "API 400: ..." into something a human wants to read. */
function friendlyError(msg) {
    const m = String(msg || "");
    if (m.includes("email already registered")) return "That email is already registered — try logging in.";
    if (m.includes("invalid email or password")) return "Invalid email or password.";
    if (m.includes("at least 8 characters")) return "Password must be at least 8 characters.";
    if (m.includes("valid email")) return "Enter a valid email address.";
    const body = m.replace(/^API \d+: /, "");
    return body || "Something went wrong — try again.";
}
