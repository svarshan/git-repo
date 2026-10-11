from pathlib import Path
import sys
root=Path(sys.argv[1]);src=root/'app/src/main/java/com/moolva/mahjong'
t=src/'ThemeCatalog.java';s=t.read_text()
anchor='    private ThemeCatalog() {}'
assert anchor in s
s=s.replace(anchor,'''    // Curated physical finish per collection. Classical Japanese garden uses warm ivory;
    // the original id%7 shortcut accidentally assigned it a dark bronze body.
    private static final int[] PREMIUM_FINISH={
        2,3,1,6,3,4,5,0,2,6,
        0,1,0,5,1,2,0,4,3,4,
        1,6,4,6,3,4,0,0,4,1
    };
    public static int premiumFinish(int themeId){
        return PREMIUM_FINISH[Math.max(0,Math.min(PREMIUM_FINISH.length-1,themeId))];
    }
''' + anchor);t.write_text(s)
p=src/'Board3DView.java';s=p.read_text();s=s.replace('ensureFinish(Math.floorMod(theme,7));','ensureFinish(ThemeCatalog.premiumFinish(theme));').replace('float[] sideTint=palette(theme);','float[] sideTint=palette(ThemeCatalog.premiumFinish(theme));');p.write_text(s)
p=src/'GameView.java';s=p.read_text().replace('activity.selectedThemeId()%7','ThemeCatalog.premiumFinish(activity.selectedThemeId())').replace('int material=theme.id%7;','int material=ThemeCatalog.premiumFinish(theme.id);').replace('readPremiumArt(theme.id%7,kind)','readPremiumArt(ThemeCatalog.premiumFinish(theme.id),kind)');p.write_text(s)
p=root/'app/build.gradle';s=p.read_text().replace('versionCode 15','versionCode 16').replace("versionName '3.2.1'","versionName '3.2.2'");p.write_text(s)
(root/'RELEASE_NOTES_3.2.2.md').write_text('MoOLVa Mahjong 3.2.2: Correct premium material-to-theme mapping. Default Classical Garden now uses warm ivory porcelain instead of dark bronze. Independent Android Studio folder, same game logic.\n')
print('v3.2.2 material map applied')