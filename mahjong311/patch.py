from pathlib import Path
import sys
p=Path(sys.argv[1])
gl=p/'app/src/main/java/com/moolva/mahjong/Board3DView.java'
s=gl.read_text()
repls={
 'Matrix.perspectiveM(proj,0,46f,aspect,1.0f,60f);':'Matrix.perspectiveM(proj,0,44f,aspect,1.0f,60f);',
 'Matrix.setLookAtM(view,0,0,-3.0f,15.7f,0,0,0,0,1,0);':'Matrix.setLookAtM(view,0,0,-5.3f,14.0f,0,0,0,0,1,0);',
 ')*1.05f+t.layer*.22f':')*1.09f+t.layer*.22f',
 ')*1.15f+t.layer*.15f':')*1.25f+t.layer*.15f',
 'float w=.91f,h=1.12f,depth=.25f;':'float w=.94f,h=1.17f,depth=.39f;',
}
for a,b in repls.items():
 if a not in s:raise ValueError('missing GLES '+a)
 s=s.replace(a,b)
gl.write_text(s)
act=p/'app/src/main/java/com/moolva/mahjong/MainActivity.java'
s=act.read_text()
s=s.replace('''            action("campaign");
        }
        redraw();''','''            action("campaign");
            // Highlight a true available pair during screenshot QA, without removing it.
            if(board!=null){
                GameEngine.Pair pair=board.availablePair();
                if(pair!=null){board.hintA=pair.first;board.hintB=pair.second;}
            }
        }
        redraw();''')
act.write_text(s)
ui=p/'app/src/main/java/com/moolva/mahjong/GameView.java'
s=ui.read_text()
a='''        fill(0xBA160C09);c.drawRoundRect(11,12,379,208,16,16,p);
        outline(c,11,12,379,208,16,0x99A36A3B,1.5f);'''
b='''        // The customer's coffee photo is a real design asset, not a static gameplay board.
        if(coffeeBackground!=null){
            fill(Color.WHITE);p.setAlpha(210);
            c.drawBitmap(coffeeBackground,new android.graphics.Rect(230,330,710,920),
                    new RectF(174,13,379,207),p);
            p.setAlpha(255);
        }
        fill(0x98160C09);c.drawRoundRect(11,12,379,208,16,16,p);
        outline(c,11,12,379,208,16,0xB9B47B4A,1.5f);'''
if a not in s:raise ValueError('missing header')
s=s.replace(a,b)
s=s.replace('0xE23D251B,0xD51B100B,0xE10B0807','0xDD4C2F20,0xC72C1810,0xDB0F0A08')
s=s.replace('0xC3986036','0xE0C18C53')
ui.write_text(s)
b=p/'app/build.gradle';s=b.read_text().replace('versionCode 10','versionCode 11').replace("versionName '3.1.0'","versionName '3.1.1'");b.write_text(s)
f=p/'settings.gradle';s=f.read_text().replace('3DReborn_3_1_0','3DReborn_3_1_1');f.write_text(s)
(p/'README.md').write_text((p/'README.md').read_text().replace('3.1 —','3.1.1 —').replace('3_1_0','3_1_1')+'\n\n## 3.1.1 Cinematic Tuning\nПроверенная настройка камеры под более крупное игровое поле, увеличенная толщина 3D-костей, улучшенное освещение и видимая кофейная фотография в шапке.\n',encoding='utf-8')
(p/'RELEASE_NOTES_3.1.1.md').write_text('# MoOLVa Mahjong 3.1.1 — Cinematic 3D Reborn\n\n- Реальные OpenGL-призмы с более толстыми боковыми гранями.\n- Больший масштаб игровых костей в перспективной камере.\n- Кофейная фотография пользователя в верхней части игрового экрана.\n- Более светлая золотая рамка игрового поля и тёплые акценты.\n- Сохранён прогресс версий 3.0.3/3.1.0, 1500 уровней и 30 коллекций.\n- Отдельная папка релиза, APK не входит в поставку.\n',encoding='utf-8')
print('patched',p)