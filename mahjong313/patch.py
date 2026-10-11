#!/usr/bin/env python3
"""3.1.3 Cinematic Fix: adaptive camera, quiet 2D UI and readability tweaks."""
from pathlib import Path
import sys
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/mnt/data/MoOLVaMahjong_Ultimate_3_1_3_CinematicFix')
app=root/'app/src/main/java/com/moolva/mahjong'
board=app/'Board3DView.java'
s=board.read_text(encoding='utf-8')
old='''            Matrix.perspectiveM(proj,0,44f,aspect,1.0f,60f);
            Matrix.setLookAtM(view,0,0,-5.3f,14.0f,0,0,0,0,1,0);
            Matrix.multiplyMM(mvp,0,proj,0,view,0);'''
assert old in s,'Original fixed camera missing'
s=s.replace(old,'''            // Fit real geometry to the screen; avoid tiny pieces on easy boards
            // and clipping on large late-game shapes. Preserve perspective/3D.
            fitCamera(board, rows, cols, aspect);''')
anchor='''        private float[] palette(int id){'''
assert anchor in s
method='''        private void fitCamera(GameEngine board,int rows,int cols,float aspect){
            int topLayer=0;
            for(GameEngine.Tile tile:board.tiles)if(!tile.removed)topLayer=Math.max(topLayer,tile.layer);
            Matrix.perspectiveM(proj,0,40f,aspect,0.8f,75f);
            // Bounds approximate actual board geometry, including thick bevels and layer offset.
            float extentX=(cols-1)*1.09f*.5f+0.56f;
            float extentY=(rows-1)*1.25f*.5f+0.73f;
            float x0=-extentX,x1=extentX+topLayer*.22f;
            float y0=-extentY,y1=extentY+topLayer*.15f;
            // Search from near to far; chooses the largest board that fits safely.
            for(float dist=7.4f;dist<34f;dist+=.3f){
                Matrix.setLookAtM(view,0,0,-dist*.30f,dist+topLayer*.20f,
                        0,0,topLayer*.20f,0,1,0);
                Matrix.multiplyMM(mvp,0,proj,0,view,0);
                float left=width, right=0,top=height,bottom=0;
                boolean valid=true;
                for(float x:new float[]{x0,x1}) for(float y:new float[]{y0,y1})
                    for(float z:new float[]{-0.23f,topLayer*.41f+.56f}){
                        float[] px=project(x,y,z);
                        if(px[0]<-200||px[1]<-200||px[0]>width+200||px[1]>height+200){valid=false;break;}
                        left=Math.min(left,px[0]);right=Math.max(right,px[0]);
                        top=Math.min(top,px[1]);bottom=Math.max(bottom,px[1]);
                    }
                if(valid&&left>=width*.035f&&right<=width*.965f&&
                         top>=height*.045f&&bottom<=height*.955f)break;
            }
        }
'''
s=s.replace(anchor,method+anchor)
# Bound the selected glow alpha for readability and make selection persist bright
old2='''                    float alpha=sel?.32f+.10f*wave:.24f+.09f*wave;'''
assert old2 in s
s=s.replace(old2,'''                    float alpha=sel?.39f+.04f*wave:.31f+.035f*wave;''')
board.write_text(s,encoding='utf-8')
view=app/'GameView.java'
s=view.read_text(encoding='utf-8')
old='''        // ~20fps only on the home/game screen. Reduces battery and CPU use.
        if (canAnimate() && (activity.screen() == MainActivity.Screen.HOME ||
                activity.screen() == MainActivity.Screen.GAME)) postInvalidateDelayed(50);'''
assert old in s
s=s.replace(old,'''        // The 3D scene renders only after a move, not 20 times per second.
        // Constant software Canvas redraw caused heavy emulator CPU load and launcher ANRs.
        if (canAnimate() && activity.screen() == MainActivity.Screen.HOME)
            postInvalidateDelayed(150);
        else if(activity.screen() == MainActivity.Screen.GAME &&
                activity.board()!=null && activity.board().challenge)
            postInvalidateDelayed(1000);''')
# For selected tile, show same full color 3D icon in case rather than plain Unicode glyph
old='''            centered(c,"◆  "+GameEngine.SYMBOLS[Math.floorMod(held.kind,24)]+"   Найдите такую же кость",215,191,14,WHITE,true);'''
assert old in s
s=s.replace(old,'''            Bitmap tileIcon=readPreviewTile(Math.floorMod(held.kind,24));
            if(tileIcon!=null){
                fill(Color.WHITE);
                c.drawBitmap(tileIcon,null,new RectF(110,171,134,199),p);
            }
            centered(c,"Найдите такую же кость",238,191,14,WHITE,true);''')
anchor='''    private void tapBronze(Canvas c,String action,String glyph,float x,float y,float radius){'''
assert anchor in s
method='''    private final Bitmap[] casePreview=new Bitmap[24];
    private Bitmap readPreviewTile(int kind){
        if(casePreview[kind]==null){
            try(InputStream in=getContext().getAssets().open(
                    String.format(Locale.US,"tiles/tile_%02d.jpg",kind))){
                android.graphics.BitmapFactory.Options opts=new android.graphics.BitmapFactory.Options();
                opts.inSampleSize=4;
                casePreview[kind]=BitmapFactory.decodeStream(in,null,opts);
            }catch(Exception ignored){}
        }
        return casePreview[kind];
    }
'''
s=s.replace(anchor,method+anchor)
view.write_text(s,encoding='utf-8')
# bump version, avoid installation collisions from old release folder
build=root/'app/build.gradle'
s=build.read_text(encoding='utf-8')
assert "versionCode 12" in s and "versionName '3.1.2'" in s
build.write_text(s.replace('versionCode 12','versionCode 13').replace("versionName '3.1.2'","versionName '3.1.3'"),encoding='utf-8')
(root/'RELEASE_NOTES_3.1.3.md').write_text('''# MoOLVa Mahjong Ultimate 3.1.3 — Cinematic Fix\n\n- Perspective OpenGL camera automatically fits every layout, for larger and more readable tiles.\n- Stops continual Canvas refresh of the 3D game screen to reduce CPU usage and emulator freezes.\n- Selected tile in the case now shows the actual illustrated picture.\n- Preserves the same app ID, legacy saves, all 1500 levels, 30 worlds and themes.\n- Android Studio source only; release has a fresh versioned project folder.\n- CI verifies Gradle build and Android lint on SDK 35; on-device GPU performance remains to be tested.\n''',encoding='utf-8')
print('Patched',root)