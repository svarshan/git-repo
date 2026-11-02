package ru.moolva.kino;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/** Parses TorAPI data without trusting arbitrary tracker names, links, or identifiers. */
final class TorrentResults {
    static final String[] PROVIDERS={"rutracker","rutor","kinozal","nonameclub"};
    static final class Item {
        final String provider,id,name,size,seeds;
        Item(String p,String id,String n,String s,String sd){this.provider=p;this.id=id;this.name=n;this.size=s;this.seeds=sd;}
    }
    static final class Search {
        final List<Item> items=new ArrayList<>();
        final List<String> unavailable=new ArrayList<>();
    }
    static String canonical(String provider){
        String p=provider.toLowerCase(Locale.ROOT);
        for(String a:PROVIDERS)if(a.equals(p))return p;
        return "";
    }
    static Search parse(String data,String requested)throws JSONException {
        Object root=new JSONTokener(data).nextValue();Search result=new Search();
        if(root instanceof JSONArray){String p=canonical(requested);if(p.isEmpty())throw new JSONException("Unknown provider");append(result,p,(JSONArray)root);return result;}
        if(!(root instanceof JSONObject))throw new JSONException("Invalid response");
        JSONObject object=(JSONObject)root;boolean found=false;
        for(String p:PROVIDERS){String key=p.equals("rutracker")?"RuTracker":p.equals("rutor")?"RuTor":p.equals("kinozal")?"Kinozal":"NoNameClub";if(!object.has(key))continue;found=true;JSONArray entries=object.optJSONArray(key);if(entries==null)result.unavailable.add(p);else append(result,p,entries);}
        if(!found)throw new JSONException("No provider data");return result;
    }
    private static void append(Search out,String provider,JSONArray arr){
        LinkedHashSet<String> known=new LinkedHashSet<>();for(Item i:out.items)known.add(i.provider+":"+i.id);
        for(int i=0;i<arr.length()&&out.items.size()<200;i++){
            JSONObject o=arr.optJSONObject(i);if(o==null)continue;String id=o.optString("Id","").trim();String name=o.optString("Name","").trim();
            if(!id.matches("[0-9]{1,16}")||name.isEmpty()||!known.add(provider+":"+id))continue;
            out.items.add(new Item(provider,id,name,o.optString("Size",""),o.optString("Seeds","")));
        }
    }
    static String magnet(String data)throws JSONException {
        Object root=new JSONTokener(data).nextValue();JSONObject item=root instanceof JSONArray?((JSONArray)root).optJSONObject(0):root instanceof JSONObject?(JSONObject)root:null;
        if(item==null)return "";String magnet=item.optString("Magnet","").trim();if(magnet.toLowerCase(Locale.ROOT).startsWith("magnet:?xt=urn:btih:"))return magnet;
        String hash=item.optString("Hash","").trim();return hash.matches("(?i)[a-f0-9]{40}")?"magnet:?xt=urn:btih:"+hash:"";
    }
}
