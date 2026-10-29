package com.ninho.shared;
public interface GameRules {void start(GameState game,long now);void act(GameState game,String action,String value,long now);}
