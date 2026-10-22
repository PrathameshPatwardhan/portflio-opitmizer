import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { login as apiLogin, signup as apiSignup, me as apiMe } from "./api.js";

const AuthContext = createContext(null);

export function useAuth() {
    return useContext(AuthContext);
}

const TOKEN_KEY = "po-token";

/** Auth state for the whole app. Token lives in localStorage; every request
 *  carries it via api.js. The site stays public — login only gates extras. */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null); // { email } or null
    const [authReady, setAuthReady] = useState(false);

    // Restore the session on load: a stored token is valid only if /me accepts it.
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const token = localStorage.getItem(TOKEN_KEY);
                if (token) {
                    const u = await apiMe();
                    if (alive) setUser({ email: u.email });
                }
            } catch {
                try { localStorage.removeItem(TOKEN_KEY); } catch {}
            }
            if (alive) setAuthReady(true);
        })();
        return () => { alive = false; };
    }, []);

    const saveSession = useCallback((data) => {
        try { localStorage.setItem(TOKEN_KEY, data.token); } catch {}
        setUser({ email: data.email });
    }, []);

    const login = useCallback(async (email, password) => {
        saveSession(await apiLogin(email, password));
    }, [saveSession]);

    const signup = useCallback(async (email, password) => {
        saveSession(await apiSignup(email, password));
    }, [saveSession]);

    const logout = useCallback(() => {
        try { localStorage.removeItem(TOKEN_KEY); } catch {}
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, authReady, login, signup, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
