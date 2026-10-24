import { useEffect, useRef, useState } from "react";

/** Small ⓘ button that opens a tooltip card.
 *  Tap toggles it (hover doesn't exist on phones); clicking anywhere else
 *  or pressing Escape closes it. */
export default function InfoTip({ text }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open ]);

    return (
        <span className="infotip" ref={ref}>
      <button
          type="button"
          className="infotip-btn"
          aria-label="More info"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
      >
        ⓘ
      </button>
            {open && (
                <span className="infotip-card" role="tooltip">
          {text}
        </span>
            )}
    </span>
    );
}
