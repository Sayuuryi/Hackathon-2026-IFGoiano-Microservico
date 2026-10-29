package com.ninho.shared;
import java.util.*;import jakarta.validation.Valid;import jakarta.validation.constraints.*;import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;import org.springframework.security.core.annotation.AuthenticationPrincipal;import org.springframework.security.oauth2.jwt.Jwt;import org.springframework.web.bind.annotation.*;
@RestController @ConditionalOnProperty(name="ninho.game-kind") @RequestMapping("/api/games/${ninho.game-kind}") public class GameController {
 private final GameService service;public GameController(GameService service){this.service=service;}
 public record Start(@NotNull UUID id,@NotBlank @Size(max=40)String definitionId){}
 public record Action(@NotNull UUID requestId,@Min(0)int version,@NotBlank @Size(max=30)String action,@Size(max=50)String value){}
 @GetMapping("/availability") public Object availability(){return service.availability();}
 @GetMapping("/catalog") public Object catalog(){return Map.of("items",service.catalog());}
 @PostMapping("/sessions") public Object start(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Start body){return service.start(body.id(),UUID.fromString(jwt.getSubject()),body.definitionId());}
 @GetMapping("/sessions/{id}") public Object get(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.get(id,UUID.fromString(jwt.getSubject()));}
 @PostMapping("/sessions/{id}/actions") public Object action(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody Action body){return service.action(id,UUID.fromString(jwt.getSubject()),body.requestId(),body.version(),body.action(),body.value());}
 @GetMapping("/history") public Object history(@AuthenticationPrincipal Jwt jwt){return Map.of("items",service.history(UUID.fromString(jwt.getSubject())));}
}