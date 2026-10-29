package com.ninho.shared;
import java.io.IOException;import java.util.*;import jakarta.servlet.*;import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;import org.springframework.stereotype.Component;import org.springframework.web.filter.OncePerRequestFilter;
@org.springframework.core.annotation.Order(-200) @Component public class OriginGuardFilter extends OncePerRequestFilter {
 private final String origin,service;public OriginGuardFilter(@Value("${ninho.allowed-origin}")String origin,@Value("${spring.application.name}")String service){this.origin=origin;this.service=service;}
 @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
  String id=UUID.randomUUID().toString();request.setAttribute("requestId",id);response.setHeader("X-Request-Id",id);response.setHeader("X-Ninho-Service",service);response.setHeader("X-Ninho-Revision","2026-10-28-r5");
  if(Set.of("POST","PUT","PATCH","DELETE").contains(request.getMethod())&&!OriginPolicy.accepts(request,origin)){response.setStatus(403);response.setContentType("application/problem+json;charset=UTF-8");response.getWriter().write("{\"status\":403,\"code\":\"ORIGIN_REJECTED\",\"detail\":\"O endereço não corresponde à configuração de origem. Confira NINHO_ORIGIN ou use auto.\",\"requestId\":\""+id+"\"}");return;}
  chain.doFilter(request,response);
 }
}