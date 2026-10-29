package com.ninho.cooking;
import com.ninho.shared.*;import java.util.*;import org.springframework.stereotype.Component;
@Component public class CookingRules implements GameRules {
 private final Map<String,List<String>> ingredients=Map.of("soup",List.of("carrot","potato","pumpkin"),"cookies",List.of("flour","oats","banana"));
 public void start(GameState g,long now){if(!ingredients.containsKey(g.definitionId))throw DomainException.invalid("Essa receita ainda não chegou.");g.state="INGREDIENTS";}
 public void act(GameState g,String action,String value,long now){
  if(g.state.equals("INGREDIENTS")&&action.equals("ingredient")){if(!ingredients.get(g.definitionId).contains(value))throw DomainException.invalid("Vamos guardar esse ingrediente para outra receita?");if(g.selected.contains(value))throw DomainException.conflict("Esse ingrediente já está na bancada.");g.selected.add(value);g.progress=g.selected.size();if(g.selected.size()==3){g.state="MIXING";g.progress=0;}return;}
  if(g.state.equals("MIXING")&&action.equals("mix")){g.progress++;if(g.progress==3){g.state="COOKING";g.readyAt=now+12000;}return;}
  if(g.state.equals("COOKING")&&action.equals("finish")){if(now<g.readyAt)throw DomainException.conflict("Falta só um pouquinho para a receita ficar pronta.");g.state="FINISHED";g.resultId=g.definitionId;return;}
  throw DomainException.invalid("Vamos seguir a etapa atual da nossa receita.");
 }
}
