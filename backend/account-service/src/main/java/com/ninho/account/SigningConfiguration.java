package com.ninho.account;
import java.nio.file.*;import java.security.*;import java.security.interfaces.*;import java.security.spec.*;import java.util.*;
import com.ninho.shared.SecurityConfiguration;import com.nimbusds.jose.jwk.*;import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import org.springframework.context.annotation.*;import org.springframework.beans.factory.annotation.Value;import org.springframework.security.oauth2.jwt.*;
@Configuration public class SigningConfiguration {
 @Bean JwtEncoder jwtEncoder(@Value("${ninho.public-key}")String pub,@Value("${ninho.private-key}")String key)throws Exception{String text=Files.readString(Path.of(key)).replaceAll("-----[^-]+-----","").replaceAll("\\s","");var privateKey=(RSAPrivateKey)KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(text)));var rsa=new com.nimbusds.jose.jwk.RSAKey.Builder(SecurityConfiguration.publicKey(pub)).privateKey(privateKey).keyID("ninho-local").build();return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(rsa)));}
}