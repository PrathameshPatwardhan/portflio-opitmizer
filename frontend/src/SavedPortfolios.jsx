import { useEffect, useState } from "react";
import { listPortfolios, deletePortfolio } from "./api.js";

/** Saved-portfolios tab: list mine, load one back into the panel, or delete it.
 *  onLoad(payload) restores the saved tickers + settings so you can re-run. */
export default function SavedPortfolios({ onLoad }) {
    const [items, setItems] = useState(null); // null = loading
    const [error, setError] = useState("");
    const [deleting, setDeleting] = useState(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const data = await listPortfolios();
                if (alive) setItems(data.portfolios || []);
            } catch (e) {
                if (alive) setError(e.message);
            }
        })();
        return () => { alive = false; };
    }, []);

    async function handleDelete(id) {
        if (!window.confirm("Delete this saved portfolio?")) return;
        setDeleting(id);
        try {
            await deletePortfolio(id);
            setItems((prev) => prev.filter((p) => p.id !== id));
        } catch (e) {
            setError(e.message);
        } finally {
            setDeleting(null);
        }
    }

    if (items === null && !error) return <p className="hint">Loading your portfolios…</p>;
    if (error) return <div className="error">{error}</div>;
    if (items.length === 0) {
        return (
            <p className="hint">
                Nothing saved yet. Run an optimization, open the Portfolio tab, and hit
                “Save this portfolio”.
            </p>
        );
    }

    return (
        <div>
            <h3 style={{ margin: "0 0 8px" }}>Your saved portfolios</h3>
            <table className="weights-table">
                <thead>
                <tr>
                    <th>Name</th>
                    <th>Tickers</th>
                    <th>Saved</th>
                    <th></th>
                </tr>
                </thead>
                <tbody>
                {items.map((p) => {
                    const tickers = Array.isArray(p.payload?.inputs?.tickers)
                        ? p.payload.inputs.tickers.join(", ")
                        : "—";
                    const when = p.created_at ? new Date(p.created_at).toLocaleDateString() : "—";
                    return (
                        <tr key={p.id}>
                            <td><strong>{p.name}</strong></td>
                            <td>{tickers}</td>
                            <td>{when}</td>
                            <td style={{ whiteSpace: "nowrap" }}>
                                <button
                                    type="button"
                                    className="secondary"
                                    style={{ marginTop: 0, marginRight: 8 }}
                                    onClick={() => onLoad(p.payload)}
                                >
                                    Load
                                </button>
                                <button
                                    type="button"
                                    className="secondary"
                                    style={{ marginTop: 0 }}
                                    disabled={deleting === p.id}
                                    onClick={() => handleDelete(p.id)}
                                >
                                    {deleting === p.id ? "…" : "Delete"}
                                </button>
                            </td>
                        </tr>
                    );
                })}
                </tbody>
            </table>
        </div>
    );
}
