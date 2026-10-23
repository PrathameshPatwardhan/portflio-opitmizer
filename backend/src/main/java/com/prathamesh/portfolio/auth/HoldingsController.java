package com.prathamesh.portfolio.auth;

import com.prathamesh.portfolio.service.QuantServiceClient;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Login-gated: the user's real-world holdings plus the rebalance analysis.
 *  Holdings are private to the owner; the math itself runs in the quant service. */
@RestController
@RequestMapping("/api/holdings")
public class HoldingsController {

    private final HoldingRepository holdings;
    private final QuantServiceClient quant;

    public HoldingsController(HoldingRepository holdings, QuantServiceClient quant) {
        this.holdings = holdings;
        this.quant = quant;
    }

    private AuthPrincipal me() {
        return (AuthPrincipal) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
    }

    /** My holdings, alphabetical. */
    @GetMapping
    public Map<String, Object> list() {
        return Map.of("holdings", holdings.listByUser(me().userId()));
    }

    /** Add or update one holding: {ticker, shares, avgPrice}. */
    @PostMapping
    public Map<String, Object> save(@RequestBody Map<String, Object> body) {
        String ticker = String.valueOf(body.getOrDefault("ticker", "")).trim().toUpperCase();
        double shares = toDouble(body.get("shares"));
        double avgPrice = toDouble(body.get("avgPrice"));
        if (ticker.isEmpty() || ticker.length() > 16 || shares <= 0 || avgPrice <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "ticker, shares (>0) and avgPrice (>0) are required");
        }
        long id = holdings.upsert(me().userId(), ticker, shares, avgPrice);
        return Map.of("id", id, "ticker", ticker);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable long id) {
        if (!holdings.delete(me().userId(), id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "holding not found");
        }
        return Map.of("deleted", id);
    }

    /** Full analysis. Body: {holdings: [{ticker, shares, avg_price}],
     *  target_weights: {TICKER: w}, region: "US"|"IN"}. */
    @PostMapping("/analyze")
    public Map<String, Object> analyze(@RequestBody Map<String, Object> body) {
        return quant.analyzeHoldings(body);
    }

    private static double toDouble(Object v) {
        if (v instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(v));
        } catch (Exception e) {
            return -1;
        }
    }
}
