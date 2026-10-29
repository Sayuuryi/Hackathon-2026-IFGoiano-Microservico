package com.ninho.fishing;
import com.ninho.shared.*;import java.util.*;import java.util.concurrent.ThreadLocalRandom;import org.springframework.stereotype.Component;
@Component public class FishingRules implements GameRules {
 public void start(GameState g,long now){g.state="WAITING";g.readyAt=now+30000+ThreadLocalRandom.current().nextInt(20001);}
 public void act(GameState g,String action,String value,long now){if(!action.equals("catch")||!g.state.equals("WAITING"))throw DomainException.invalid("Lance uma nova linha antes de recolher.");if(now<g.readyAt)throw DomainException.conflict("A boia ainda está tranquila. O papo pode continuar.");g.state="FINISHED";g.progress=1;g.resultId=List.of("sunfish","moonfish","mintfish","coralfish").get(ThreadLocalRandom.current().nextInt(4));}
}