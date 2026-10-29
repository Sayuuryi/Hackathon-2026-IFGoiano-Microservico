package com.ninho.account;
import com.ninho.shared.*;import java.util.*;import java.time.Duration;import java.util.concurrent.ConcurrentHashMap;
import jakarta.servlet.http.*;import jakarta.validation.Valid;import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;import org.springframework.http.*;import org.springframework.security.core.annotation.AuthenticationPrincipal;import org.springframework.security.oauth2.jwt.Jwt;import org.springframework.web.bind.annotation.*;
@RestController public class AccountController {
 private final AccountService service;private final boolean secure;private final ConcurrentHashMap<String,long[]>attempts=new ConcurrentHashMap<>();
 public AccountController(AccountService service,@Value("${ninho.secure-cookie}")boolean secure){this.service=service;this.secure=secure;}
 public record Signup(@NotBlank @Size(max=30)String name,@NotBlank @Email @Size(max=200)String email,@NotBlank @Size(min=10,max=72)String password,@Min(18)@Max(120)int age,@NotBlank @Size(max=20)String petName,@Min(0)@Max(2)int petColor,@NotBlank String accessory,@NotBlank String environment){}
 public record Login(@NotBlank @Email @Size(max=200)String email,@NotBlank @Size(max=72)String password){}
 public record Preferences(boolean voice,boolean reducedMotion){}
 public record Profile(@NotBlank @Size(max=30)String userDisplayName,@Min(18)@Max(120)int userAge,@NotBlank @Size(max=20)String petName,@Min(0)@Max(2)int petColor,@NotBlank String accessory,@NotBlank String environment,@NotNull Preferences preferences){}
 public record Presence(@NotBlank @Size(max=20)String kind){} public record Memory(@NotNull UUID id,@NotBlank @Size(max=40)String kind){}
 private void throttle(String email,HttpServletRequest request){long now=System.currentTimeMillis();String key=AccountService.hash(email.toLowerCase(Locale.ROOT))+"|"+request.getRemoteAddr();if(attempts.size()>10000)attempts.clear();var slot=attempts.compute(key,(k,v)->v==null||now-v[0]>600000?new long[]{now,1}:new long[]{v[0],v[1]+1});if(slot[1]>20)throw new DomainException(429,"RATE_LIMITED","Vamos com calma. Tente entrar novamente em alguns minutos.");}
 private String cookie(HttpServletRequest request,String name){if(request.getCookies()!=null)for(Cookie c:request.getCookies())if(c.getName().equals(name))return c.getValue();return null;}
 private void setCookie(HttpServletResponse response,String name,String value,long seconds){response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from(name,value).httpOnly(true).secure(secure).sameSite("Lax").path("/").maxAge(Duration.ofSeconds(seconds)).build().toString());}
 private Object signed(AccountService.SignedIn result,HttpServletResponse response){setCookie(response,"ninho_session",result.access(),900);setCookie(response,"ninho_refresh",result.refresh(),604800);return Map.of("user",result.user(),"profile",service.profile((UUID)result.user().get("id")));}
 @GetMapping("/api/auth/status")Object readiness(){return service.readiness();}
 @PostMapping("/api/auth/register")Object register(@Valid @RequestBody Signup body,HttpServletRequest req,HttpServletResponse res){throttle(body.email(),req);return signed(service.register(body.name(),body.email(),body.password(),body.age(),body.petName(),body.petColor(),body.accessory(),body.environment()),res);}
 @PostMapping("/api/auth/login")Object login(@Valid @RequestBody Login body,HttpServletRequest req,HttpServletResponse res){throttle(body.email(),req);return signed(service.login(body.email(),body.password()),res);}
 @PostMapping("/api/auth/refresh")Object refresh(HttpServletRequest req,HttpServletResponse res){return signed(service.refresh(cookie(req,"ninho_refresh")),res);}
 @PostMapping("/api/auth/logout")Object logout(HttpServletRequest req,HttpServletResponse res){setCookie(res,"ninho_session","",0);setCookie(res,"ninho_refresh","",0);service.logout(cookie(req,"ninho_refresh"));return Map.of("signedOut",true);}
 @PostMapping({"/api/auth/request-password-reset","/api/auth/send-verification-email"})Object mail(){throw new DomainException(503,"EMAIL_NOT_CONFIGURED","O envio de e-mail ainda não foi configurado. Sua senha não foi alterada.");}
 @GetMapping("/api/me")Object me(@AuthenticationPrincipal Jwt jwt){return service.me(jwt);}
 @PutMapping("/api/profile")Object profile(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Profile p){return service.updateProfile(UUID.fromString(jwt.getSubject()),p.userDisplayName(),p.userAge(),p.petName(),p.petColor(),p.accessory(),p.environment(),p.preferences().voice(),p.preferences().reducedMotion());}
 @PostMapping("/api/presence")Object presence(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Presence p){return service.presence(UUID.fromString(jwt.getSubject()),p.kind());}
 @GetMapping("/api/memories")Object memories(@AuthenticationPrincipal Jwt jwt){return service.memories(UUID.fromString(jwt.getSubject()));}
 @PostMapping("/api/memories")Object memory(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody Memory body){return service.remember(UUID.fromString(jwt.getSubject()),body.id(),body.kind());}
 @DeleteMapping("/api/memories/{id}")Object removeMemory(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id){service.removeMemory(UUID.fromString(jwt.getSubject()),id);return Map.of("removed",true);}
}