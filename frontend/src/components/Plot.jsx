import { useEffect, useRef } from "react";
import Plotly from "plotly.js-dist-min";

/** Thin wrapper around plotly.js. Re-renders when data/layout change. */
export default function Plot({ data, layout, style }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      Plotly.react(ref.current, data, layout, {
        responsive: true,
        displaylogo: false,
      });
    }
  }, [data, layout]);

  useEffect(() => {
    const el = ref.current;
    return () => {
      if (el) Plotly.purge(el);
    };
  }, []);

  return <div ref={ref} style={style} />;
}
