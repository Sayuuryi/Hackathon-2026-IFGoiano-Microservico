package com.ninho.park;
import com.ninho.shared.*;import java.util.*;import org.springframework.stereotype.Component;
@Component public class ParkRules implements GameRules {
 private final Map<String,List<String>> stops=Map.of("park-lake",List.of("bird","water","bench"),"park-flowers",List.of("flower","butterfly","tree"));
 public void start(GameState g,long now){if(!stops.containsKey(g.definitionId))throw DomainException.invalid("Escolha um caminho disponível.");g.state="WALKING";}
 public void act(GameState g,String action,String value,long now){if(!g.state.equals("WALKING")||!action.equals("observe"))throw DomainException.invalid("Vamos começar um novo passeio?");var route=stops.get(g.definitionId);if(!route.get(g.progress).equals(value))throw DomainException.conflict("A próxima descoberta está um pouquinho adiante.");g.selected.add(value);g.progress++;if(g.progress==route.size()){g.state="FINISHED";g.resultId=g.definitionId;}}
}