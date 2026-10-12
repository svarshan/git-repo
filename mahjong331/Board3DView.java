package com.moolva.mahjong;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.PixelFormat;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.GLUtils;
import android.opengl.Matrix;
import android.os.SystemClock;
import android.view.MotionEvent;

import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * Actual OpenGL ES 2.0 scene (not a 2D screenshot).
 * Mahjong tiles are individually textured 3D prisms with lit side walls, a raised face,
 * perspective projection, depth testing, physical layer spacing, and touch picking.
 * Engine logic remains in GameEngine, so old 3.0.x saves are compatible.
 */
public final class Board3DView extends GLSurfaceView {
    private final MainActivity activity;
    private final TileRenderer renderer;

    Board3DView(MainActivity activity) {
        super(activity);
        this.activity=activity;
        setEGLContextClientVersion(2);
        setEGLConfigChooser(8,8,8,8,16,0);
        getHolder().setFormat(PixelFormat.TRANSLUCENT);
        setZOrderOnTop(true);
        renderer=new TileRenderer(activity,this);
        setRenderer(renderer);
        setRenderMode(GLSurfaceView.RENDERMODE_WHEN_DIRTY); // user actions explicitly request a fresh frame
        setPreserveEGLContextOnPause(true);
    }

    @Override public boolean onTouchEvent(MotionEvent e) {
        if (e.getAction()==MotionEvent.ACTION_UP) {
            final int tileId=renderer.hitTest(e.getX(),e.getY());
            if(tileId>=0) activity.runOnUiThread(()->activity.tapTile(tileId));
            performClick();
        }
        return true;
    }
    @Override public boolean performClick() {super.performClick();return true;}

    private static final class Hit {
        final int id, layer;
        final float left,top,right,bottom;
        Hit(int id,int layer,float l,float t,float r,float b){this.id=id;this.layer=layer;left=l;top=t;right=r;bottom=b;}
        boolean contains(float x,float y){return x>=left&&x<=right&&y>=top&&y<=bottom;}
    }

    private static final class TileRenderer implements GLSurfaceView.Renderer {
        private static final int SEGMENTS = 40;
        private final MainActivity activity;
        private final GLSurfaceView host;
        private volatile ArrayList<Hit> hits = new ArrayList<>();
        private int width=1,height=1,program,ap,auv,an,umvp,uoffset,ucolor,utextured,usampler,umetal,uglow,whiteTexture;
        private final int[] faceTextures = new int[24];
        private int cachedFinish=-1;
        private final float[] proj=new float[16],view=new float[16],mvp=new float[16];
        private Mesh front,bevel,side,shadow;
        private final float[] tileOffset = new float[3];
        private long selectionStarted=0;
        private int lastSelection=-2;
        private float selectionProgress=1f;

        private static final class Mesh {
            final FloatBuffer data;
            final int count;
            Mesh(ArrayList<Float> values){
                count=values.size()/8;
                data=ByteBuffer.allocateDirect(values.size()*4).order(ByteOrder.nativeOrder()).asFloatBuffer();
                for(Float f:values)data.put(f);
                data.position(0);
            }
        }
        TileRenderer(MainActivity a,GLSurfaceView host){activity=a;this.host=host;}
        @Override public void onSurfaceCreated(GL10 unused,EGLConfig cfg){
            String vs="attribute vec3 aPosition;attribute vec2 aUv;attribute vec3 aNormal;"+
                    "uniform mat4 uMvp;uniform vec3 uOffset;varying vec2 vUv;varying vec3 vNormal;varying vec3 vPosition;"+
                    "void main(){vec3 p=aPosition+uOffset;gl_Position=uMvp*vec4(p,1.);vUv=aUv;vNormal=aNormal;vPosition=p;}";
            String fs="precision mediump float;varying vec2 vUv;varying vec3 vNormal;varying vec3 vPosition;"+
                    "uniform sampler2D uSampler;uniform vec4 uColor;uniform float uTextured;uniform float uMetal;uniform float uGlow;"+
                    "void main(){vec4 tex=mix(vec4(1.),texture2D(uSampler,vUv),uTextured);"+
                    "vec3 n=normalize(vNormal);vec3 lightDir=normalize(vec3(-.55,.76,1.20));"+
                    "float lambert=max(dot(n,lightDir),0.);"+
                    "vec3 v=normalize(vec3(.25,-.40,1.60));vec3 h=normalize(lightDir+v);"+
                    "float spec=pow(max(dot(n,h),0.),mix(24.,74.,uMetal));"+
                    "float rim=pow(1.-abs(dot(n,v)),3.);"+
                    "vec3 base=tex.rgb*uColor.rgb;"+
                    "vec3 shaded=base*(.47+.54*lambert)+vec3(1.,.81,.52)*spec*(.10+.48*uMetal)+"+
                    "vec3(.89,.64,.30)*rim*(.04+.23*uMetal)+vec3(1.,.74,.24)*uGlow*.16;"+
                    "gl_FragColor=vec4(min(shaded,vec3(1.)),tex.a*uColor.a);}";
            int v=shader(GLES20.GL_VERTEX_SHADER,vs),f=shader(GLES20.GL_FRAGMENT_SHADER,fs);
            program=GLES20.glCreateProgram();GLES20.glAttachShader(program,v);GLES20.glAttachShader(program,f);GLES20.glLinkProgram(program);
            ap=GLES20.glGetAttribLocation(program,"aPosition");auv=GLES20.glGetAttribLocation(program,"aUv");
            an=GLES20.glGetAttribLocation(program,"aNormal");umvp=GLES20.glGetUniformLocation(program,"uMvp");
            uoffset=GLES20.glGetUniformLocation(program,"uOffset");ucolor=GLES20.glGetUniformLocation(program,"uColor");
            utextured=GLES20.glGetUniformLocation(program,"uTextured");usampler=GLES20.glGetUniformLocation(program,"uSampler");
            umetal=GLES20.glGetUniformLocation(program,"uMetal");uglow=GLES20.glGetUniformLocation(program,"uGlow");
            GLES20.glEnable(GLES20.GL_DEPTH_TEST);GLES20.glDepthFunc(GLES20.GL_LEQUAL);
            GLES20.glEnable(GLES20.GL_BLEND);GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA,GLES20.GL_ONE_MINUS_SRC_ALPHA);
            GLES20.glDisable(GLES20.GL_CULL_FACE);
            whiteTexture=makeSolidTexture();cachedFinish=-1;
            buildMeshes();
        }
        private int shader(int type,String source){
            int id=GLES20.glCreateShader(type);GLES20.glShaderSource(id,source);GLES20.glCompileShader(id);
            int[] status=new int[1];GLES20.glGetShaderiv(id,GLES20.GL_COMPILE_STATUS,status,0);
            if(status[0]==0)throw new IllegalStateException("Mahjong 3D shader: "+GLES20.glGetShaderInfoLog(id));
            return id;
        }
        private int makeSolidTexture(){Bitmap b=Bitmap.createBitmap(1,1,Bitmap.Config.ARGB_8888);b.eraseColor(-1);int id=newTexture(b);b.recycle();return id;}
        private int newTexture(Bitmap bitmap){
            int[] a=new int[1];GLES20.glGenTextures(1,a,0);GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,a[0]);
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);
            GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);
            GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,bitmap,0);return a[0];
        }
        private void ensureFinish(int finish){
            if(finish==cachedFinish)return;
            if(cachedFinish>=0){for(int id:faceTextures)if(id!=0&&id!=whiteTexture)GLES20.glDeleteTextures(1,new int[]{id},0);}
            cachedFinish=finish;
            for(int kind=0;kind<24;kind++){
                String path=finish==0?String.format(java.util.Locale.US,"atelier/%02d.jpg",kind):
                        String.format(java.util.Locale.US,"premium/finish_%d/%02d.jpg",finish,kind);
                try(InputStream in=activity.getAssets().open(path)){
                    BitmapFactory.Options o=new BitmapFactory.Options();o.inPreferredConfig=Bitmap.Config.RGB_565;
                    o.inSampleSize=1; // a true high-resolution face, with 24 textures loaded only for active finish
                    Bitmap b=BitmapFactory.decodeStream(in,null,o);
                    if(b!=null){faceTextures[kind]=newTexture(b);b.recycle();}
                    else faceTextures[kind]=whiteTexture;
                }catch(Exception e){faceTextures[kind]=whiteTexture;}
            }
        }
        private static void vertex(ArrayList<Float> dst,float x,float y,float z,float u,float v,float nx,float ny,float nz){
            Collections.addAll(dst,x,y,z,u,v,nx,ny,nz);
        }
        private static void tri(ArrayList<Float> dst,float[] a,float[] b,float[] c,float nx,float ny,float nz){
            vertex(dst,a[0],a[1],a[2],a[3],a[4],nx,ny,nz);
            vertex(dst,b[0],b[1],b[2],b[3],b[4],nx,ny,nz);
            vertex(dst,c[0],c[1],c[2],c[3],c[4],nx,ny,nz);
        }
        private static float[][] perimeter(float w,float h,float r,int seg){
            float[][] p=new float[seg][2];
            // CCW rounded rectangle, each corner has its own circular arc.
            for(int i=0;i<seg;i++){
                int n=seg/4,corner=i/n,k=i%n;
                double angle=(-90.+90.*k/n+90.*corner)*Math.PI/180.;
                float cx=(corner==0||corner==1)?w/2-r:-w/2+r;
                float cy=(corner==0||corner==3)?-h/2+r:h/2-r;
                p[i][0]=cx+r*(float)Math.cos(angle);p[i][1]=cy+r*(float)Math.sin(angle);
            }
            return p;
        }
        private void buildMeshes(){
            float width=1.015f,height=1.205f,radius=.135f;
            float[][] outer=perimeter(width,height,radius,SEGMENTS);
            float[][] inset=perimeter(width-.11f,height-.11f,radius-.026f,SEGMENTS);
            ArrayList<Float> frontV=new ArrayList<>(), bevelV=new ArrayList<>(),sideV=new ArrayList<>(),shadowV=new ArrayList<>();
            for(int i=0;i<SEGMENTS;i++){
                int j=(i+1)%SEGMENTS;
                float[] a=outer[i],b=outer[j],c=inset[i],d=inset[j];
                float nx=(a[0]+b[0])*.5f,ny=(a[1]+b[1])*.5f;
                float length=(float)Math.sqrt(nx*nx+ny*ny);nx/=Math.max(.001f,length);ny/=Math.max(.001f,length);
                // Side wall with curved cylindrical corner normals.
                float[] aa={a[0],a[1],-.285f,0,0},bb={b[0],b[1],-.285f,1,0};
                float[] af={a[0],a[1],.217f,0,1},bf={b[0],b[1],.217f,1,1};
                tri(sideV,aa,bb,bf,nx,ny,.045f);tri(sideV,aa,bf,af,nx,ny,.045f);
                // Chamfer catches the warm overhead light. Its 3D profile is modelled geometry.
                float[] ci={c[0],c[1],.302f,(c[0]/width)+.5f,.5f-c[1]/height};
                float[] cj={d[0],d[1],.302f,(d[0]/width)+.5f,.5f-d[1]/height};
                tri(bevelV,af,bf,cj,nx*.68f,ny*.68f,.73f);
                tri(bevelV,af,cj,ci,nx*.68f,ny*.68f,.73f);
                // Flat upper inset: only artwork is drawn here, no square corners.
                float[] center={0,0,.305f,.5f,.5f};
                tri(frontV,center,ci,cj,0,0,1);
                // Translucent silhouette behind each piece, size larger than body.
                float sx=1.10f,sy=1.10f;
                float[] sc={0,0,-.37f,.5f,.5f};
                float[] si={a[0]*sx+.065f,a[1]*sy-.075f,-.37f,0,0};
                float[] sj={b[0]*sx+.065f,b[1]*sy-.075f,-.37f,1,1};
                tri(shadowV,sc,si,sj,0,0,1);
            }
            front=new Mesh(frontV);bevel=new Mesh(bevelV);side=new Mesh(sideV);shadow=new Mesh(shadowV);
        }
        private void drawMesh(Mesh mesh,float r,float g,float b,float alpha,int texture,boolean textured,float metal,float glow){
            GLES20.glUseProgram(program);
            GLES20.glUniformMatrix4fv(umvp,1,false,mvp,0);
            GLES20.glUniform3fv(uoffset,1,tileOffset,0);
            GLES20.glUniform4f(ucolor,r,g,b,alpha);
            GLES20.glUniform1f(utextured,textured?1f:0f);
            GLES20.glUniform1f(umetal,metal);GLES20.glUniform1f(uglow,glow);
            GLES20.glActiveTexture(GLES20.GL_TEXTURE0);GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,texture);
            GLES20.glUniform1i(usampler,0);
            FloatBuffer data=mesh.data;
            data.position(0);GLES20.glVertexAttribPointer(ap,3,GLES20.GL_FLOAT,false,32,data);GLES20.glEnableVertexAttribArray(ap);
            data.position(3);GLES20.glVertexAttribPointer(auv,2,GLES20.GL_FLOAT,false,32,data);GLES20.glEnableVertexAttribArray(auv);
            data.position(5);GLES20.glVertexAttribPointer(an,3,GLES20.GL_FLOAT,false,32,data);GLES20.glEnableVertexAttribArray(an);
            GLES20.glDrawArrays(GLES20.GL_TRIANGLES,0,mesh.count);
        }
        @Override public void onSurfaceChanged(GL10 unused,int w,int h){width=Math.max(1,w);height=Math.max(1,h);GLES20.glViewport(0,0,width,height);}
        @Override public void onDrawFrame(GL10 unused){
            GLES20.glViewport(0,0,width,height);GLES20.glClearColor(0,0,0,0);
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT|GLES20.GL_DEPTH_BUFFER_BIT);
            GameEngine board=activity.board();
            if(board==null||activity.screen()!=MainActivity.Screen.GAME||board.won()){hits=new ArrayList<>();return;}
            int rows=board.rows(),cols=board.columns();
            fitCamera(board,rows,cols,(float)width/(float)height);
            ArrayList<GameEngine.Tile> sorted=new ArrayList<>(board.tiles);
            sorted.sort((a,b)->{int z=Integer.compare(a.layer,b.layer);return z!=0?z:Integer.compare(a.id,b.id);});
            int finish=ThemeCatalog.premiumFinish(activity.selectedThemeId());ensureFinish(finish);
            float[] tint=palette(finish);
            ArrayList<Hit> newHits=new ArrayList<>();
            int selected=board.selected;
            long now=SystemClock.uptimeMillis();
            if(lastSelection!=selected){lastSelection=selected;selectionStarted=now;}
            float t=Math.min(1f,(now-selectionStarted)/230f);
            selectionProgress=1f-(1f-t)*(1f-t);
            for(GameEngine.Tile tile:sorted){
                if(tile.removed)continue;
                boolean free=board.isFree(tile),chosen=selected==tile.id;
                boolean hinted=board.hintA==tile.id||board.hintB==tile.id;
                float x=(tile.col-(cols-1)*.5f)*1.09f+tile.layer*.20f;
                float y=((rows-1)*.5f-tile.row)*1.25f+tile.layer*.15f;
                float z=tile.layer*.52f+(chosen?.26f*selectionProgress:0);
                tileOffset[0]=x;tileOffset[1]=y;tileOffset[2]=z;
                // Ambient occlusion/contact-shadow stays below actual geometry.
                GLES20.glDepthMask(false);
                drawMesh(shadow,.10f,.065f,.035f,.43f,whiteTexture,false,0,0);
                GLES20.glDepthMask(true);
                float r=tint[0],g=tint[1],b=tint[2];
                drawMesh(side,r*.71f,g*.69f,b*.59f,1,whiteTexture,false,.79f,0);
                drawMesh(bevel,Math.min(1,r*1.07f),Math.min(1,g*1.03f),b*.87f,1,
                        whiteTexture,false,.94f,chosen?1f:hinted?.50f:0f);
                float brightness=free?1.0f:.73f;
                drawMesh(front,brightness,brightness,brightness,1,faceTextures[Math.floorMod(tile.kind,24)],true,.18f,chosen?0.24f:0f);
                float[] p1=project(x-.52f,y-.61f,z+.31f),p2=project(x+.52f,y+.61f,z+.31f);
                float[] p3=project(x+.52f,y-.61f,z+.31f),p4=project(x-.52f,y+.61f,z+.31f);
                float l=Math.min(Math.min(p1[0],p2[0]),Math.min(p3[0],p4[0]));
                float rr=Math.max(Math.max(p1[0],p2[0]),Math.max(p3[0],p4[0]));
                float top=Math.min(Math.min(p1[1],p2[1]),Math.min(p3[1],p4[1]));
                float bottom=Math.max(Math.max(p1[1],p2[1]),Math.max(p3[1],p4[1]));
                newHits.add(new Hit(tile.id,tile.layer,l,top,rr,bottom));
            }
            newHits.sort((a,b)->Integer.compare(b.layer,a.layer));hits=newHits;
            if(selected>=0&&selectionProgress<1f){
                host.postDelayed(()->host.requestRender(),16);
            }
        }
        private void fitCamera(GameEngine board,int rows,int cols,float aspect){
            int topLayer=0;
            for(GameEngine.Tile tile:board.tiles)if(!tile.removed)topLayer=Math.max(topLayer,tile.layer);
            Matrix.perspectiveM(proj,0,34f,aspect,0.8f,75f);
            // Bounds approximate actual board geometry, including thick bevels and layer offset.
            float extentX=(cols-1)*1.09f*.5f+0.67f;
            float extentY=(rows-1)*1.25f*.5f+0.74f;
            float x0=-extentX,x1=extentX+topLayer*.20f;
            float y0=-extentY,y1=extentY+topLayer*.15f;
            // Search from near to far; chooses the largest board that fits safely.
            for(float dist=5.8f;dist<43f;dist+=.20f){
                Matrix.setLookAtM(view,0,dist*.19f,-dist*.27f,dist+topLayer*.16f,
                        0,0,topLayer*.18f,0,1,0);
                Matrix.multiplyMM(mvp,0,proj,0,view,0);
                float left=width, right=0,top=height,bottom=0;
                boolean valid=true;
                for(float x:new float[]{x0,x1}) for(float y:new float[]{y0,y1})
                    for(float z:new float[]{-0.35f,topLayer*.52f+.65f}){
                        float[] px=project(x,y,z);
                        if(px[0]<-200||px[1]<-200||px[0]>width+200||px[1]>height+200){valid=false;break;}
                        left=Math.min(left,px[0]);right=Math.max(right,px[0]);
                        top=Math.min(top,px[1]);bottom=Math.max(bottom,px[1]);
                    }
                if(valid&&left>=width*.035f&&right<=width*.965f&&
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
        private float[] palette(int id){
            switch(Math.floorMod(id,7)){
                case 1:return new float[]{.27f,.30f,.38f}; // moonlit stone
                case 2:return new float[]{.37f,.21f,.23f}; // cinema lacquer
                case 3:return new float[]{.31f,.25f,.19f}; // bronze
                case 4:return new float[]{.56f,.44f,.29f}; // warm amber
                case 5:return new float[]{.37f,.24f,.15f}; // walnut
                case 6:return new float[]{.26f,.25f,.28f}; // obsidian
                default:return new float[]{.92f,.83f,.69f}; // ivory porcelain
            }
        }
        private float[] project(float x,float y,float z){
            float[] v={x,y,z,1},out=new float[4];Matrix.multiplyMV(out,0,mvp,0,v,0);
            if(Math.abs(out[3])<.0001f)return new float[]{-100,-100};
            return new float[]{(out[0]/out[3]*.5f+.5f)*width,(.5f-out[1]/out[3]*.5f)*height};
        }
        int hitTest(float x,float y){for(Hit h:hits)if(h.contains(x,y))return h.id;return -1;}
    }
}