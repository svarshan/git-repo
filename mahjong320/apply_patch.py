from pathlib import Path
import sys
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '/mnt/data/MoOLVaMahjong_Ultimate_3_2_0_PremiumTiles')
p=ROOT/'app/src/main/java/com/moolva/mahjong/Board3DView.java'
s=p.read_text()
s=s.replace('private final int[] faceTextures=new int[24];','private final int[] faceTextures=new int[24];\n        private int cachedFinish=-1;')
s=s.replace('''            for(int i=0;i<24;i++)try(InputStream in=activity.getAssets().open(String.format(java.util.Locale.US,"tiles/tile_%02d.jpg",i))){
                Bitmap bitmap=BitmapFactory.decodeStream(in);
                faceTextures[i]=newTexture(bitmap);
                bitmap.recycle();
            }catch(Exception e){faceTextures[i]=whiteTexture;}''','''            cachedFinish=-1; // load only the current material: 24 face textures in video memory''')
# Before tile draw prepare texture group, shader programs remain valid
s=s.replace('''            int theme=activity.selectedThemeId();
            float[] sideTint=palette(theme);''','''            int theme=activity.selectedThemeId();
            ensureFinish(Math.floorMod(theme,7));
            float[] sideTint=palette(theme);''')
start=s.index('                float x=(t.col-(cols-1)/2f)*1.09f')
end=s.index('                float[] p1=project',start)
s=s[:start]+'''                float x=(t.col-(cols-1)/2f)*1.09f+t.layer*.20f;
                float y=((rows-1)/2f-t.row)*1.25f+t.layer*.15f;
                boolean free=board.isFree(t);
                boolean sel=board.selected==t.id;
                boolean hint=board.hintA==t.id||board.hintB==t.id;
                float lift=sel?.27f:0f;
                float z=t.layer*.52f+lift;
                float w=1.005f,h=1.20f,depth=.54f;
                float front=z+depth*.5f,back=z-depth*.5f;
                float[] tint=sideTint;
                // Contact shadow is on the underside, not painted into the artwork.
                quad(x+.075f,y-.072f,back-.048f,w*1.11f,h*1.08f,0,0,0,.42f,whiteTexture,false);
                if(sel||hint){
                    quad(x,y,back-.037f,w*1.20f,h*1.16f,1,.61f,.17f,sel?.35f:.26f,whiteTexture,false);
                }
                // Individually lit side panels provide REAL thickness and layering.
                panel(x-w/2,y-h/2,back,x+w/2,y-h/2,back,x+w/2,y-h/2,front,x-w/2,y-h/2,front,
                      tint[0]*.39f,tint[1]*.35f,tint[2]*.28f);
                panel(x+w/2,y-h/2,back,x+w/2,y+h/2,back,x+w/2,y+h/2,front,x+w/2,y-h/2,front,
                      tint[0]*.48f,tint[1]*.44f,tint[2]*.36f);
                panel(x-w/2,y+h/2,back,x+w/2,y+h/2,back,x+w/2,y+h/2,front,x-w/2,y+h/2,front,
                      tint[0]*.70f,tint[1]*.64f,tint[2]*.52f);
                panel(x-w/2,y-h/2,back,x-w/2,y+h/2,back,x-w/2,y+h/2,front,x-w/2,y-h/2,front,
                      tint[0]*.60f,tint[1]*.55f,tint[2]*.45f);
                // Four geometrical chamfer surfaces reflect an overhead warm key-light.
                float edge=.071f;
                float ir=.055f;
                float u=x-w/2,v=x+w/2,b=y-h/2,topY=y+h/2;
                panel(u,b,front, v,b,front, v-ir,b+edge,front+.048f, u+ir,b+edge,front+.048f,
                      tint[0]*.72f,tint[1]*.62f,tint[2]*.50f);
                panel(v,b,front,v,topY,front,v-ir,topY-edge,front+.048f,v-ir,b+edge,front+.048f,
                      tint[0]*.85f,tint[1]*.78f,tint[2]*.64f);
                panel(u,topY,front,v,topY,front,v-ir,topY-edge,front+.048f,u+ir,topY-edge,front+.048f,
                      Math.min(1,tint[0]*1.09f),Math.min(1,tint[1]*1.08f),Math.min(1,tint[2]*1.03f));
                panel(u,b,front,u,topY,front,u+ir,topY-edge,front+.048f,u+ir,b+edge,front+.048f,
                      tint[0]*.93f,tint[1]*.84f,tint[2]*.72f);
                // Whole illustrated ceramic face, not a cropped screenshot fragment.
                float faceLight=free?1.0f:.63f;
                quad(x,y,front+.051f,w-2*ir,h-2*edge,faceLight,faceLight,faceLight,1,
                      faceTextures[Math.floorMod(t.kind,24)],true);
                // Glint along the upper edge & a warm metallic hairline at the left.
                thinLine(u+ir,topY-edge,front+.065f,v-ir,topY-edge,front+.065f,
                        1,.91f,.69f,free?.82f:.27f);
                thinLine(u+ir,b+edge,front+.065f,u+ir,topY-edge,front+.065f,
                        1,.82f,.52f,free?.45f:.16f);
''' + s[end:]
# Original hit test projected old z positions -> update front
s=s.replace('float[] p1=project(x-w/2,y-h/2,z+depth/2),p2=project(x+w/2,y+h/2,z+depth/2);','float[] p1=project(x-w/2,y-h/2,front+.051f),p2=project(x+w/2,y+h/2,front+.051f);')
s=s.replace('float[] p3=project(x+w/2,y-h/2,z+depth/2),p4=project(x-w/2,y+h/2,z+depth/2);','float[] p3=project(x+w/2,y-h/2,front+.051f),p4=project(x-w/2,y+h/2,front+.051f);')
# Insert ensureFinish
pos=s.index('        private int shader(int type,String source)')
s=s[:pos]+'''        private void ensureFinish(int material){
            if(material==cachedFinish)return;
            if(cachedFinish>=0)for(int i=0;i<24;i++){
                if(faceTextures[i]!=whiteTexture && faceTextures[i]!=0){
                    int[] ids={faceTextures[i]};GLES20.glDeleteTextures(1,ids,0);
                }
            }
            cachedFinish=material;
            for(int i=0;i<24;i++){
                try(InputStream in=activity.getAssets().open(String.format(java.util.Locale.US,
                        "premium/finish_%d/%02d.jpg",material,i))){
                    Bitmap b=BitmapFactory.decodeStream(in);
                    if(b!=null){faceTextures[i]=newTexture(b);b.recycle();}
                    else faceTextures[i]=whiteTexture;
                }catch(Exception e){faceTextures[i]=whiteTexture;}
            }
        }
''' + s[pos:]
# Update perspective
s=s.replace('Matrix.perspectiveM(proj,0,40f,aspect,0.8f,75f);','Matrix.perspectiveM(proj,0,34f,aspect,0.8f,75f);')
s=s.replace('float extentX=(cols-1)*1.09f*.5f+0.56f;','float extentX=(cols-1)*1.09f*.5f+0.67f;')
s=s.replace('float extentY=(rows-1)*1.25f*.5f+0.73f;','float extentY=(rows-1)*1.25f*.5f+0.74f;')
s=s.replace('float x0=-extentX,x1=extentX+topLayer*.22f;','float x0=-extentX,x1=extentX+topLayer*.20f;')
s=s.replace('for(float dist=7.4f;dist<34f;dist+=.3f){','for(float dist=5.8f;dist<43f;dist+=.20f){')
s=s.replace('Matrix.setLookAtM(view,0,0,-dist*.30f,dist+topLayer*.20f,\n                        0,0,topLayer*.20f,0,1,0);','Matrix.setLookAtM(view,0,dist*.19f,-dist*.27f,dist+topLayer*.16f,\n                        0,0,topLayer*.18f,0,1,0);')
s=s.replace('for(float z:new float[]{-0.23f,topLayer*.41f+.56f})','for(float z:new float[]{-0.35f,topLayer*.52f+.65f})')
s=s.replace('left>=width*.035f&&right<=width*.965f&&\n                         top>=height*.045f&&bottom<=height*.955f','left>=width*.035f&&right<=width*.965f&&\n                         top>=height*.03f&&bottom<=height*.97f')
# fix incomplete camera rendering old checker loops braces intact
# insert panel helper before quad
pos=s.index('        private void quad(float x,float y,float z,')
s=s[:pos]+'''        private void panel(float x1,float y1,float z1,float x2,float y2,float z2,
                           float x3,float y3,float z3,float x4,float y4,float z4,
                           float r,float g,float b){
            float[] v={x1,y1,z1,0,0,x2,y2,z2,1,0,x3,y3,z3,1,1,
                       x1,y1,z1,0,0,x3,y3,z3,1,1,x4,y4,z4,0,1};
            draw(v,r,g,b,1,whiteTexture,false);
        }
''' +s[pos:]
p.write_text(s)

# GameView changed UI label and case thumbnail
v=ROOT/'app/src/main/java/com/moolva/mahjong/GameView.java'
t=v.read_text();t=t.replace('3 D   R E B O R N','P R E M I U M   T I L E S')
t=t.replace('"tiles/tile_%02d.jpg",kind','"premium/finish_%d/%02d.jpg",activity.selectedThemeId()%7,kind')
# make larger preview and display template asset in gallery when possible
# readPreviewTile old kind-only cache could be stale when theme changes; replace conditional caching with material kind keyed
old='private final Bitmap[] casePreview=new Bitmap[24];\n    private Bitmap readPreviewTile(int kind){\n        if(casePreview[kind]==null)'
new='private final Bitmap[] casePreview=new Bitmap[24];\n    private int previewMaterial=-1;\n    private Bitmap readPreviewTile(int kind){\n        int material=activity.selectedThemeId()%7;\n        if(material!=previewMaterial){\n            for(int k=0;k<24;k++){if(casePreview[k]!=null){casePreview[k].recycle();casePreview[k]=null;}}\n            previewMaterial=material;\n        }\n        if(casePreview[kind]==null)'
if old not in t: print('WARN preview old not found')
else: t=t.replace(old,new)
t=t.replace('new RectF(110,171,134,199)','new RectF(105,171,132,199)')
# Improve gallery top-level theme tiles by removing emoji only inside premium drawing
marker='''        // Intricate visual symbol has its own subtle enamel drop-shadow.
        String emoji=DeluxeSymbols.icon(theme.id,kind);'''
if marker in t:
  t=t.replace(marker,'''        // Premium illustrated enamel, matching the actual 3D stone texture.
        Bitmap faceArt=readPremiumArt(theme.id%7,kind);
        if(faceArt!=null){
            fill(Color.WHITE);
            c.drawBitmap(faceArt,null,new RectF(19,15,157,203),p);
            return;
        }
        String emoji=DeluxeSymbols.icon(theme.id,kind);''')
  # helper
  pos=t.index('    private void paintDeluxeTile(')
  t=t[:pos]+'''    private final java.util.LinkedHashMap<Integer,Bitmap> premiumPreviews=new java.util.LinkedHashMap<Integer,Bitmap>(20,.75f,true){
        @Override protected boolean removeEldestEntry(java.util.Map.Entry<Integer,Bitmap> eldest){
            if(size()>28){eldest.getValue().recycle();return true;}return false;
        }
    };
    private Bitmap readPremiumArt(int material,int kind){
        int key=material*24+Math.floorMod(kind,24);
        Bitmap b=premiumPreviews.get(key);
        if(b!=null&&!b.isRecycled())return b;
        try(InputStream in=getContext().getAssets().open(String.format(Locale.US,
                "premium/finish_%d/%02d.jpg",material,kind))){
            android.graphics.BitmapFactory.Options o=new android.graphics.BitmapFactory.Options();
            o.inSampleSize=2;
            b=android.graphics.BitmapFactory.decodeStream(in,null,o);
            if(b!=null)premiumPreviews.put(key,b);
            return b;
        }catch(Exception ignored){return null;}
    }
''' + t[pos:]
v.write_text(t)

# build identity and notes
f=ROOT/'app/build.gradle'
s=f.read_text().replace('versionCode 13','versionCode 14').replace("versionName '3.1.3'","versionName '3.2.0'")
f.write_text(s)
(ROOT/'RELEASE_NOTES_3.2.0.md').write_text('''# MoOLVa Mahjong 3.2.0 — Premium Tiles

- 168 custom high-resolution premium tile face textures: 24 distinct motifs × 7 finishes.
- Gold enamel medallions, ink paintings, cultural calligraphy, porcelain, obsidian, lacquer, amber, bronze, walnut and moonstone.
- Individually illuminated extruded stone sidewalls and sloped bevels in OpenGL ES 2.0.
- Selected and hinted stones have luminous halos, with stronger depth shadows.
- Theme changes load only current 24 textures; previous GL textures are freed.
- UI collection previews and case tile now use premium materials.
- 1500 levels, 30 collections, shuffle preserving selected case, game progress retained.
- New separate Android Studio project folder; no APK delivered.
- Correct game screenshots must be produced from Android Emulator, not concept art.
''',encoding='utf-8')
print('Done')