from pathlib import Path
import sys
p=Path(sys.argv[1]); f=p/'app/src/main/java/com/moolva/mahjong/Board3DView.java'
s=f.read_text()
a='setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);'
b='setRenderMode(GLSurfaceView.RENDERMODE_WHEN_DIRTY); // user actions explicitly request a fresh frame'
assert a in s;s=s.replace(a,b)
a='''        private final long created=SystemClock.uptimeMillis();'''
b='''        private final long created=SystemClock.uptimeMillis();
        // Reusable native storage: avoid allocating hundreds of direct ByteBuffers on every frame.
        private final FloatBuffer sharedVertices=ByteBuffer.allocateDirect(128*4)
                .order(ByteOrder.nativeOrder()).asFloatBuffer();'''
assert a in s;s=s.replace(a,b)
a='''            FloatBuffer buffer=ByteBuffer.allocateDirect(verts.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();
            buffer.put(verts).position(0);'''
b='''            FloatBuffer buffer=sharedVertices;
            buffer.clear();buffer.put(verts).position(0);'''
assert a in s;s=s.replace(a,b)
f.write_text(s)
f=p/'app/build.gradle';s=f.read_text().replace('versionCode 11','versionCode 12').replace("versionName '3.1.1'","versionName '3.1.2'");f.write_text(s)
f=p/'settings.gradle';s=f.read_text().replace('3DReborn_3_1_1','3DReborn_3_1_2');f.write_text(s)
(p/'RELEASE_NOTES_3.1.2.md').write_text('''# MoOLVa Mahjong 3.1.2 — Cinematic Stable

Вместо непрерывных сотен OpenGL draw calls при каждом обновлении дисплея рендерер перерисовывает доску только при изменениях игровой сцены. Нативный FloatBuffer повторно используется, устраняя тысячи прямых аллокаций в секунду. Предназначено для снижения нагрузки на Android-эмуляторы и слабые устройства.

Сохранено: 30 коллекций, 1500 уровней, перемешивание с костью в кейсе, офлайн-игра, 3D-модели костей, кофе-стилистика и автоматическое определение SDK.

Рабочая папка: MoOLVaMahjong_Ultimate_3_1_2_CinematicStable. Старые папки не изменяются.
''',encoding='utf-8')
f=p/'README.md';s=f.read_text().replace('3.1.1 —','3.1.2 —').replace('3_1_1','3_1_2')+'\n\n## 3.1.2 Performance hotfix\nOpenGL отрисовывает кадры по запросу и повторно использует нативный буфер; это снижает нагрузку эмулятора.\n';f.write_text(s)
print('patched 3.1.2')