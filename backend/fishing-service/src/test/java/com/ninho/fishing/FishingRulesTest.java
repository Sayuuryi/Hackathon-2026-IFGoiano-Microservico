package com.ninho.fishing;
import com.ninho.shared.*;import org.junit.jupiter.api.Test;import static org.junit.jupiter.api.Assertions.*;
class FishingRulesTest{@Test void invalidActionsDoNotCompleteAnActivity(){var g=new GameState();new FishingRules().start(g,1000);assertThrows(DomainException.class,()->new FishingRules().act(g,"catch",null,2000));assertEquals("WAITING",g.state);new FishingRules().act(g,"catch",null,60000);assertEquals("FINISHED",g.state);}}
