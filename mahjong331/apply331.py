#!/usr/bin/env python3
"""Apply MoOLVa Premium Tile Rework to an extracted 3.3.0 project."""
from pathlib import Path
import sys, shutil
root=Path(sys.argv[1]); own=Path(__file__).resolve().parent
java=root/'app/src/main/java/com/moolva/mahjong'
shutil.copy2(own/'Board3DView.java', java/'Board3DView.java')
p=java/'GameView.java';s=p.read_text()
a='String.format(Locale.US,"premium/finish_%d/%02d.jpg",ThemeCatalog.premiumFinish(activity.selectedThemeId()),kind)'
b='material==0 ? String.format(Locale.US,"atelier/%02d.jpg",kind) : String.format(Locale.US,"premium/finish_%d/%02d.jpg",material,kind)'
assert a in s,'preview locator mismatch';s=s.replace(a,b)
a='try(InputStream in=getContext().getAssets().open(String.format(Locale.US,\n                "premium/finish_%d/%02d.jpg",material,kind)))'
b='try(InputStream in=getContext().getAssets().open(material==0?\n                String.format(Locale.US,"atelier/%02d.jpg",kind):\n                String.format(Locale.US,"premium/finish_%d/%02d.jpg",material,kind)))'
assert a in s,'gallery locator mismatch';s=s.replace(a,b)
# Mask baked decorative stone silhouettes in the underlying concept image;
# the only visible pieces on the new table are real clickable GL objects.
a='''        grandImage(c,grandGameArt);
        // Real 3D stones are rendered on top by Board3DView in the central play area.'''
b='''        grandImage(c,grandGameArt);
        fill(0xFF1B0F0A);
        c.drawRoundRect(8,118,382,650,24,24,p);
        p.setShader(new RadialGradient(195,374,314,
                new int[]{0xFF68442D,0xFF342016,0xFF170E0B},
                new float[]{0f,.57f,1f}, Shader.TileMode.CLAMP));
        c.drawRoundRect(13,123,377,645,21,21,p);
        p.setShader(null);
        outline(c,14,124,376,645,21,0xCBBA8A53,1.5f);
        outline(c,22,133,368,635,15,0x5DA97843,.8f);
        // Real 3D stones are rendered on top by Board3DView in the central play area.'''
assert a in s,'board background changed';s=s.replace(a,b)
p.write_text(s)
p=root/'app/build.gradle';s=p.read_text();assert "versionName '3.3.0'" in s
p.write_text(s.replace("versionName '3.3.0'","versionName '3.3.1'").replace('versionCode 17','versionCode 18'))
(root/'RELEASE_NOTES_3.3.1.md').write_text('''# MoOLVa Mahjong 3.3.1 — Premium Tile Rework

- 24 original porcelain-face illustrations at 512 × 640 resolution, with no cropped screenshot fragments.
- Rounded corners and multi-layer bevelled sidewalls as true OpenGL ES geometry.
- Warm physically-inspired diffuse and specular shading, contact shadow, golden accent.
- Selected tile lifts in a brief animation; engine remains idle between interactions.
- 1500 levels, 30 collections, save data and case-held shuffle preserved.
- Independent folder for this release and standard Gradle Wrapper.
''',encoding='utf-8')
print('Applied tile renderer & version 3.3.1')