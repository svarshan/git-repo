package ru.moolva.kino;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Parses search and topic pages received directly from the user's RuTracker session. */
final class RuTrackerSearch {
    static List<TorrentResults.Item> parse(String html) throws java.io.IOException {
        Document d=Jsoup.parse(html);
        if(d.selectFirst("form#login-form-full, form[action*=login.php]")!=null && d.selectFirst("#tor-tbl")==null)throw new java.io.IOException("LOGIN_REQUIRED");
        if(d.selectFirst("#tor-tbl")==null)throw new java.io.IOException("SEARCH_PAGE_UNAVAILABLE");
        List<TorrentResults.Item> result=new ArrayList<>();
        for(Element row:d.select("#tor-tbl tbody tr")){
            Element title=row.selectFirst("a.tLink, a.med.tLink, a[data-topic_id]");if(title==null)continue;
            String id=title.attr("data-topic_id").trim(), name=title.text().trim();
            if(!id.matches("[0-9]{1,16}")||name.isEmpty())continue;
            Element size=row.selectFirst("td.tor-size");Element seed=row.selectFirst("td.seedmed b, b.seedmed");
            result.add(new TorrentResults.Item("rutracker",id,name,size==null?"":size.text(),seed==null?"":seed.text()));if(result.size()>=100)break;
        }
        return result;
    }
    static String magnet(String html){
        Document d=Jsoup.parse(html);Element link=d.selectFirst("a.magnet-link, a[href^=magnet:]");
        if(link!=null){String value=link.attr("href").trim();if(value.toLowerCase(Locale.ROOT).startsWith("magnet:?")&&value.toLowerCase(Locale.ROOT).contains("urn:btih:"))return value;}
        Element hash=d.selectFirst("#tor-hash, span.tor-hash, .post_body .tor-hash");String h=hash==null?"":hash.text().trim();
        return h.matches("(?i)[a-f0-9]{40}")?"magnet:?xt=urn:btih:"+h+"&tr=http%3A%2F%2Fbt.t-ru.org%2Fann":"";
    }
}
