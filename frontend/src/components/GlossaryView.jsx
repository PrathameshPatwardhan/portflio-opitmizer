const TERMS = [
    {
        name: "Sharpe Ratio",
        tag: "Frontier tab",
        text: `The Sharpe ratio tells you how much return you're getting per unit of bumpiness. It's the portfolio's return minus the safe baseline (the risk-free rate), divided by its volatility. A Sharpe of 1.0 means one unit of return for each unit of risk — higher is better, and it's the number the optimizer maximizes on the Frontier tab.`,
        images: [
            { src: "https://static.twentyoverten.com/61ab74382899e66a28e8023a/FDEtMCdEQNc/1747476136459.png", caption: "Sharpe ratio illustration", credit: "Kardinal Financial" },
        ],
    },
    {
        name: "Volatility",
        tag: "Frontier tab · x-axis",
        text: `Volatility is how wildly an investment's returns swing around — technically the standard deviation of returns. High volatility means a bumpier ride: bigger up days, but also bigger down days. It's the optimizer's default yardstick for "risk," and it's what the x-axis of the efficient frontier measures.`,
        images: [
            { src: "https://cdn1.investingdaily.com/uploads/2022/08/INVESTING_DAILY_STW_08312022_VIX.png", caption: "VIX — the market's fear index, a live gauge of volatility", credit: "Investing Daily" },
        ],
    },
    {
        name: "Expected Return",
        tag: "Everywhere",
        text: `The average yearly return you'd expect based on the data — not a promise, just the historical average stretched forward. If a portfolio's expected return is 8%, think "about 8% a year on average, with plenty of better and worse years mixed in." Every optimization on the site starts by estimating this from past prices.`,
        images: [
            { src: "https://imgproxy.gamma.app/resize/quality:80/resizing_type:fit/width:2000/https://cdn.gamma.app/15oo94rm2ykk2vp/e77297defa624560a79a82127cb8b75a/original/return_distrubution.png", caption: "Distribution of stock market returns — the average is the expected return", credit: "AlgoTrade" },
        ],
    },
    {
        name: "Efficient Frontier",
        tag: "Frontier tab",
        text: `Plot every possible portfolio as a dot with risk on one axis and return on the other, and the dots form a cloud. The upper-left edge of that cloud is the efficient frontier — the set of portfolios where you can't get more return without taking more risk. Anything below the curve is leaving money (or safety) on the table, which is exactly why the site draws it for you.`,
        images: [
            { src: "https://upload.wikimedia.org/wikipedia/commons/5/50/Markowitz_efficient_frontier_diagram.svg", caption: `The efficient frontier (the "Markowitz bullet")`, credit: "Wikimedia Commons" },
            { src: "https://upload.wikimedia.org/wikipedia/commons/f/f4/Mean-variance_analysis.gif", caption: "Animated: how the frontier is traced out", credit: "Wikimedia Commons" },
        ],
    },
    {
        name: "CVaR — Conditional Value at Risk",
        tag: "Tail Risk tab",
        text: `CVaR answers the question investors actually lose sleep over: "On my worst days, how much do I lose on average?" CVaR 95% is the average loss across the worst 5% of days. Unlike volatility, it doesn't punish upside jumps — it only cares about the left tail, the crashes. The site's Tail Risk tab finds the portfolio mix that minimizes exactly this number.`,
        images: [
            { src: "https://media.fe.training/2025/10/x5ojzgsn-Cvar.png", caption: "CVaR: the shaded tail is the worst days; the dotted line is their average loss", credit: "Financial Edge Training" },
        ],
    },
    {
        name: "VaR — Value at Risk",
        tag: "Tail Risk tab",
        text: `VaR is a line in the sand: "95% of the time, I won't lose more than X." It's a threshold, not an average — it tells you where the bad days start but says nothing about how bad they get past that line. That's VaR's famous blind spot, and it's the reason CVaR exists: CVaR measures the average damage beyond the VaR line.`,
        images: [
            { src: "https://zandersgroup.com/app/uploads/2024/06/var_vs_es.png", caption: "VaR vs. Expected Shortfall (CVaR) on a loss distribution", credit: "Zanders Group" },
        ],
    },
    {
        name: "Maximum Drawdown",
        tag: "Portfolio tab",
        text: `The biggest fall from a peak to the next trough — the worst ride you would have endured holding this portfolio. A 30% max drawdown means at some point your money dropped 30% before recovering. Investors watch it because it measures pain, not just wiggle: a portfolio can have modest volatility and still suffer a brutal drawdown.`,
        images: [
            { src: "https://www.fundsindia.com/blog/wp-content/uploads/2020/05/Max-drawdown-chart-1024x576.jpg", caption: "Maximum drawdown: peak-to-trough decline", credit: "FundsIndia" },
        ],
    },
    {
        name: "Rebalancing",
        tag: "Rebalance tab",
        text: `Over time, your winners grow and your portfolio drifts away from the mix you chose — 60% stocks can quietly become 80%. Rebalancing means periodically trimming the winners and topping up the laggards to restore your target weights. It keeps your risk where you intended it instead of letting the market decide for you. The site's Rebalance tab simulates doing this quarterly or yearly.`,
        images: [
            { src: "https://www.wallstreetmojo.com/wp-content/uploads/2019/08/What-Is-Portfolio-Rebalancing.jpg", caption: "Portfolio rebalancing: selling high, buying low, back to target weights", credit: "WallStreetMojo" },
        ],
    },
    {
        name: "Long-Only vs. Long-Short",
        tag: "Inputs panel",
        text: `Long-only means you only buy — every weight is between 0% and 100%, the way a normal brokerage account works. Long-short also lets you short (bet against) assets, giving them negative weights funded by the long positions — it can hedge or juice returns, but losses on shorts are uncapped and most retail accounts can't do it. The optimizer defaults to long-only; that's the "longOnly" toggle in the inputs panel.`,
        images: [
            { src: "https://volity.io/wp-content/uploads/2026/05/glossary-what-is-going-long-vs-going-short-650x362.webp", caption: "Going long vs. going short, explained", credit: "Volity" },
        ],
    },
    {
        name: "Risk-Free Rate",
        tag: "Inputs panel",
        text: `The return you'd earn doing absolutely nothing risky — usually the yield on short-term US Treasury bills, the closest thing finance has to a sure thing. It's the baseline every investment is measured against: the Sharpe ratio subtracts it because only returns above this rate count as compensation for taking risk. The site defaults it to 4%, and you can change it in the inputs panel.`,
        images: [
            { src: "https://get.ycharts.com/wp-content/uploads/2024/12/US-Treasury-Yield-Curve-December-2024-1024x893.png", caption: "US Treasury yield curve — short-term T-bill yields anchor the risk-free rate", credit: "YCharts" },
        ],
    },
    {
        name: "Correlation & Diversification",
        tag: "Frontier tab",
        text: `Correlation measures whether two assets zig together (+1), zag apart (−1), or ignore each other (0). Diversification's magic is pure math: combine assets that don't move in lockstep and the portfolio's bumps partly cancel out — so the whole is calmer than the average of its parts. That's the "free lunch" behind the optimizer: it hunts for mixes whose correlations diversify risk away without sacrificing return.`,
        images: [
            { src: "https://www.iasg.com/wp-content/uploads/2018/05/Diversification-Power.png", caption: "Diversification: imperfectly correlated assets smooth the ride", credit: "IASG" },
        ],
    },
    {
        name: "Alpha — the Tail Level",
        tag: "Tail Risk tab",
        text: `On the Tail Risk tab, "alpha" is just a knob that picks which worst days count: 95% means "the worst 5% of days," 99% means "the worst 1%." Crank it to 99% and you're optimizing against rarer, nastier crashes — but with fewer data points, so the answer gets noisier. Heads-up: this is not the CAPM "alpha" that means beating the market — same Greek letter, totally different job.`,
        images: [
            { src: "https://upload.wikimedia.org/wikipedia/commons/7/74/Normal_Distribution_PDF.svg", caption: "A return distribution: alpha picks how far into the left tail you look", credit: "Wikimedia Commons" },
            { src: "https://zandersgroup.com/app/uploads/2024/06/var_vs_es.png", caption: "Same idea on a loss distribution: the shaded tail beyond the VaR line", credit: "Zanders Group" },
        ],
    },
];

export default function GlossaryView() {
    return (
        <div>
            <p className="hint" style={{ marginTop: 0 }}>
                Finance terms, in plain English — for a smart reader with no finance background.
            </p>
            {TERMS.map((t) => (
                <article key={t.name} style={{ marginBottom: 28 }}>
                    <h3 style={{ margin: "0 0 4px" }}>{t.name}</h3>
                    <p className="hint" style={{ margin: "0 0 8px" }}>{t.tag}</p>
                    <p style={{ margin: "0 0 12px" }}>{t.text}</p>
                    {t.images.map((img) => (
                        <figure key={img.src} style={{ margin: "0 0 16px" }}>
                            <img
                                src={img.src}
                                alt={img.caption}
                                loading="lazy"
                                style={{ maxWidth: "100%", borderRadius: 8 }}
                            />
                            <figcaption className="hint">
                                {img.caption} — Source: {img.credit}
                            </figcaption>
                        </figure>
                    ))}
                </article>
            ))}
        </div>
    );
}
