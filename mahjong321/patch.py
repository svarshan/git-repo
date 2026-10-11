from pathlib import Path
import sys
p=Path(sys.argv[1])
f=p/'app/src/main/java/com/moolva/mahjong/Board3DView.java'
s=f.read_text()
s=s.replace('Bitmap bitmap=BitmapFactory.decodeStream(in);','Bitmap bitmap=BitmapFactory.decodeStream(in);') # keep unrelated
s=s.replace('''                    Bitmap b=BitmapFactory.decodeStream(in);
                    if(b!=null){faceTextures[i]=newTexture(b);b.recycle();}''','''                    BitmapFactory.Options o=new BitmapFactory.Options();
                    o.inSampleSize=2; // 224x280 is sharp at phone tile size; reduces GL memory 75%
                    Bitmap b=BitmapFactory.decodeStream(in,null,o);
                    if(b!=null){faceTextures[i]=newTexture(b);b.recycle();}''')
needle='''                if(valid&&left>=width*.035f&&right<=width*.965f&&
                         top>=height*.03f&&bottom<=height*.97f)break;
            }
        }
        private float[] palette'''
replacement='''                if(valid&&left>=width*.035f&&right<=width*.965f&&
                         top>=height*.03f&&bottom<=height*.97f)break;
            }
            // Screen-space auto-zoom: use the actual non-removed pieces rather than
            // the theoretical maximum board rectangle (often full of empty cells).
            float left=width,right=0,top=height,bottom=0;
            for(GameEngine.Tile tile:board.tiles){
                if(tile.removed)continue;
                float tx=(tile.col-(cols-1)*.5f)*1.09f+tile.layer*.20f;
                float ty=((rows-1)*.5f-tile.row)*1.25f+tile.layer*.15f;
                float tz=tile.layer*.52f+.32f;
                for(float dx:new float[]{-.54f,.54f})for(float dy:new float[]{-.64f,.64f}){
                    float[] pt=project(tx+dx,ty+dy,tz);
                    left=Math.min(left,pt[0]);right=Math.max(right,pt[0]);
                    top=Math.min(top,pt[1]);bottom=Math.max(bottom,pt[1]);
                }
            }
            if(right>left+1&&bottom>top+1){
                float zoom=Math.min(width*.90f/(right-left),height*.89f/(bottom-top));
                zoom=Math.max(.90f,Math.min(1.38f,zoom));
                proj[0]*=zoom;proj[5]*=zoom;
                Matrix.multiplyMM(mvp,0,proj,0,view,0);
            }
        }
        private float[] palette'''
if needle not in s:raise RuntimeError('camera code not found')
s=s.replace(needle,replacement)
f.write_text(s)
g=p/'app/build.gradle'
t=g.read_text().replace('versionCode 14','versionCode 15').replace("versionName '3.2.0'","versionName '3.2.1'")
g.write_text(t)
v=p/'app/src/main/java/com/moolva/mahjong/GameView.java';txt=v.read_text().replace('P R E M I U M   T I L E S','P R E M I U M   3 D');v.write_text(txt)
(p/'RELEASE_NOTES_3.2.1.md').write_text('MoOLVa Mahjong 3.2.1 — Premium 3D. Improves board zoom using actual visible tiles and cuts GL texture memory by 75%. All 1500 levels and 30 themes retained.\n')
print('Updated 3.2.1')