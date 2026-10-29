package com.ninho.shared;
public final class DomainException extends RuntimeException {
 public final int status; public final String code;
 public DomainException(int status,String code,String message){super(message);this.status=status;this.code=code;}
 public static DomainException invalid(String message){return new DomainException(400,"INVALID_ACTION",message);}
 public static DomainException missing(){return new DomainException(404,"NOT_FOUND","Esse cantinho não está disponível para sua conta.");}
 public static DomainException conflict(String message){return new DomainException(409,"CONFLICT",message);}
}