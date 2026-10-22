package com.prathamesh.portfolio.auth;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/** Login-gated: every route here requires a valid JWT and is scoped to its owner.
 *  The site itself stays public — only saved portfolios live behind login. */
@RestController
@RequestMapping("/api/portfolios")
public class SavedPortfolioController {

    private final PortfolioRepository portfolios;

    public SavedPortfolioController(PortfolioRepository portfolios) {
        this.portfolios = portfolios;
    }

    private AuthPrincipal me() {
        return (AuthPrincipal) SecurityContextHolder.getContext()
                .getAuthentication().getPrincipal();
    }

    /** List my saved portfolios, newest first. */
    @GetMapping
    public Map<String, Object> list() throws Exception {
        return Map.of("portfolios", portfolios.listByUser(me().userId()));
    }

    /** Save a portfolio: {name, payload}. Payload is any JSON (tickers, weights, params). */
    @PostMapping
    public Map<String, Object> save(@RequestBody Map<String, Object> body) throws Exception {
        String name = String.valueOf(body.getOrDefault("name", "")).trim();
        Object payload = body.get("payload");
        if (name.isEmpty() || name.length() > 255 || payload == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "name and payload are required");
        }
        long id = portfolios.save(me().userId(), name, payload);
        return Map.of("id", id, "name", name);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@PathVariable long id) {
        if (!portfolios.delete(me().userId(), id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "portfolio not found");
        }
        return Map.of("deleted", id);
    }
}
