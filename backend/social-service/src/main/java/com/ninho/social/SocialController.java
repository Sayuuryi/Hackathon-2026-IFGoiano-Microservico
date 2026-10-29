package com.ninho.social;
import java.util.*;import jakarta.validation.Valid;import jakarta.validation.constraints.*;import org.springframework.security.core.annotation.AuthenticationPrincipal;import org.springframework.security.oauth2.jwt.Jwt;import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("/api/friends") public class SocialController {
 private final SocialService service;public SocialController(SocialService service){this.service=service;}
 public record Invite(@NotNull UUID id){}
 public record Envelope(@Min(1)@Max(1)int v,@NotNull @Pattern(regexp="[A-Za-z0-9_-]{22}")String id,@NotNull @Pattern(regexp="[A-Za-z0-9_-]{16}")String iv,@NotNull @Pattern(regexp="[A-Za-z0-9_-]{20,8192}")String ciphertext){}
 private UUID user(Jwt jwt){return UUID.fromString(jwt.getSubject());}
 private String name(Jwt jwt){return Objects.toString(jwt.getClaimAsString("name"),"Uma companhia");}
 @GetMapping Object list(@AuthenticationPrincipal Jwt jwt){return service.list(user(jwt));}
 @PostMapping("/invites")Object create(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Invite body){return service.create(body.id(),user(jwt),name(jwt));}
 @GetMapping("/{id}/preview")Object preview(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.preview(id,user(jwt));}
 @PostMapping("/{id}/accept")Object accept(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.accept(id,user(jwt),name(jwt));}
 @PostMapping("/{id}/decline")Object decline(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.decline(id,user(jwt));}
 @GetMapping("/{id}/messages")Object messages(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@RequestParam(defaultValue="0")@Min(0)long after){return service.messages(id,user(jwt),after);}
 @PostMapping("/{id}/messages")Object send(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id,@Valid @RequestBody Envelope e){return service.send(id,user(jwt),e.id(),e.iv(),e.ciphertext());}
 @PostMapping("/{id}/block")Object block(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.block(id,user(jwt),true);}
 @PostMapping("/{id}/unblock")Object unblock(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.block(id,user(jwt),false);}
 @DeleteMapping("/{id}")Object remove(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){return service.remove(id,user(jwt));}
}