package ru.moolva.kino;
import org.junit.Test;
import static org.junit.Assert.*;

public class TorrentResultsTest {
    @Test public void acceptsGroupedProvidersAndReportsUnavailable() throws Exception {
        String s="{\"RuTracker\":[{\"Id\":\"42\",\"Name\":\"Sintel\",\"Size\":\"1 GB\",\"Seeds\":\"8\"},{\"Id\":\"42\",\"Name\":\"duplicate\"}],\"RuTor\":{\"Result\":\"no matches\"},\"Kinozal\":[],\"NoNameClub\":[]}";
        TorrentResults.Search r=TorrentResults.parse(s,"all");assertEquals(1,r.items.size());assertEquals("rutracker",r.items.get(0).provider);assertEquals("42",r.items.get(0).id);assertEquals(1,r.unavailable.size());
    }
    @Test public void rejectsUntrustedProviderAndBadIds() throws Exception {
        TorrentResults.Search r=TorrentResults.parse("[{\"Id\":\"../not-number\",\"Name\":\"x\"},{\"Id\":\"123\",\"Name\":\"OK\"}]","rutor");assertEquals(1,r.items.size());assertEquals("123",r.items.get(0).id);assertEquals("",TorrentResults.canonical("evil.example"));
    }
    @Test public void derivesMagnetOnlyFromValidHashOrMagnet() throws Exception {
        assertEquals("magnet:?xt=urn:btih:0123456789012345678901234567890123456789",TorrentResults.magnet("[{\"Hash\":\"0123456789012345678901234567890123456789\"}]"));
        assertEquals("",TorrentResults.magnet("[{\"Magnet\":\"https://evil.example\",\"Hash\":\"invalid\"}]"));
    }
}
