package com.ninho.shared;
import java.net.URI;
import java.util.Set;
import jakarta.servlet.http.HttpServletRequest;
final class OriginPolicy {
 static int port(URI uri){return uri.getPort()!=-1?uri.getPort():"https".equalsIgnoreCase(uri.getScheme())?443:80;}
 static boolean same(String supplied,String expected){
  if(supplied==null||expected==null)return false;
  try{URI a=URI.create(supplied),b=URI.create(expected);return a.getHost()!=null&&b.getHost()!=null&&a.getUserInfo()==null&&a.getRawQuery()==null&&a.getFragment()==null&&(a.getPath()==null||a.getPath().isEmpty())&&Set.of("http","https").contains(a.getScheme())&&a.getScheme().equalsIgnoreCase(b.getScheme())&&a.getHost().equalsIgnoreCase(b.getHost())&&port(a)==port(b);}catch(IllegalArgumentException e){return false;}
 }
 static boolean accepts(HttpServletRequest request,String configured){
  String expected=configured;
  if("auto".equalsIgnoreCase(configured))try{expected=new URI(request.getScheme(),null,request.getServerName(),request.getServerPort(),null,null,null).toString();}catch(Exception e){return false;}
  return same(request.getHeader("Origin"),expected);
 }
}
