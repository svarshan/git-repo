package ru.moolva.kino;
import org.junit.Test;
import java.util.List;
import static org.junit.Assert.*;

public class RuTrackerSearchTest {
    @Test public void readsResultsAndRejectsNonNumericIds() throws Exception {
        String html="<table id='tor-tbl'><tbody><tr><td><a class='tLink' data-topic_id='123'>Sintel test</a></td><td class='tor-size'>1 GB</td><td class='seedmed'><b>4</b></td></tr><tr><td><a class='tLink' data-topic_id='../x'>Bad</a></td></tr></tbody></table>";
        List<TorrentResults.Item> out=RuTrackerSearch.parse(html);assertEquals(1,out.size());assertEquals("123",out.get(0).id);assertEquals("4",out.get(0).seeds);
    }
    @Test public void loginPageIsNotAnEmptySearch() throws Exception {
        try{RuTrackerSearch.parse("<form id='login-form-full' action='login.php'></form>");fail("expected login");}catch(java.io.IOException e){assertEquals("LOGIN_REQUIRED",e.getMessage());}
    }
    @Test public void readsMagnetOrFallbackHash(){
        assertEquals("magnet:?xt=urn:btih:0123456789012345678901234567890123456789",RuTrackerSearch.magnet("<a href='magnet:?xt=urn:btih:0123456789012345678901234567890123456789'>x</a>"));
        assertTrue(RuTrackerSearch.magnet("<span id='tor-hash'>0123456789012345678901234567890123456789</span>").startsWith("magnet:?xt=urn:btih:"));
        assertEquals("",RuTrackerSearch.magnet("<a href='https://evil.example'>x</a>"));
    }
}
